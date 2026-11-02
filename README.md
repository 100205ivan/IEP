# EyeEP／IEP 個別化教育計畫系統

EyeEP 是以學生個別化教育計畫（IEP）為核心的教學與評量管理系統，提供學生資料、年度 IEP、能力與需求評估、評量紀錄，以及遊戲與 AI 文件分析結果的整合檢視。

本專案目前以 Windows + XAMPP + MariaDB 作為主要開發環境。第一次使用時，請依序準備資料庫、後端與前端。

## 目前功能與開發進度

- 學生與年度 IEP 建立、讀取及編輯
- 人工評量紀錄新增、查看、編輯與刪除
- 評估文件 OCR（Tesseract.js）與去識別化文字整理
- Gemini AI 評估文件分析，依七大能力向度整理摘要與 evidence
- Monkey 工作記憶遊戲與 CPT 持續注意力遊戲
- Monkey／CPT 結果持久化至 MariaDB，支援查看、刪除與歷史紀錄
- 七大能力向度相關評量參考面板已實作，但目前尚未完成完整實測

AI 文件分析需要有效的 Gemini API Key；其他不需要 AI 的功能仍可在沒有 Key 時啟動。

## 技術架構

- 前端：React 19、TypeScript、Vite、React Router
- 後端：Node.js 20 以上、TypeScript、Express 5、Zod
- 資料庫：MariaDB／MySQL，使用 mysql2
- OCR：瀏覽器端 Tesseract.js，包含繁體中文與英文模型
- AI：Google Gemini Developer API；模型設定於 backend/src/config/gemini.ts
- 遊戲：Monkey 工作記憶遊戲、CPT 持續注意力遊戲
- Vite proxy：前端 /api 轉送至 http://localhost:3001

## 專案目錄

~~~text
.
├─ frontend/       React + TypeScript + Vite 前端
├─ backend/        Node.js + Express + MariaDB 後端
│  └─ src/db/      migration 與資料庫初始化程式
├─ references/     開發參考資料，不是執行必要檔案
└─ README.md
~~~

references/ 僅供開發參考，依目前 .gitignore 設定不需上傳 GitHub。請勿放入學生個資、評量文件或資料庫備份。

## 安裝前需求

請先安裝 Git、Node.js 20 以上、npm、XAMPP。npm 通常會隨 Node.js 一起安裝。

~~~powershell
git --version
node --version
npm --version
~~~

## 下載與安裝依賴

請將 <GitHub 儲存庫網址> 與 <專案資料夾> 替換成實際值：

~~~powershell
git clone <GitHub 儲存庫網址>
cd <專案資料夾>
~~~

安裝前端：

~~~powershell
cd frontend
npm install
~~~

安裝後端：

~~~powershell
cd ..\backend
npm install
~~~

若 package.json 或 lockfile 有更新，請在對應的 frontend/ 或 backend/ 重新執行 npm install。

## MariaDB 與 .env

1. 開啟 XAMPP Control Panel。
2. 啟動 MySQL。
3. 開啟 phpMyAdmin，建立 eyeep 資料庫。
4. 使用 utf8mb4_unicode_ci 編碼與排序規則：

~~~sql
CREATE DATABASE eyeep
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
~~~

後端會從 backend/.env 載入環境變數。請複製安全範例：

~~~powershell
cd backend
copy .env.example .env
~~~

目前 backend/.env.example 的實際變數如下：

~~~dotenv
GEMINI_API_KEY=

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=eyeep
DB_USER=root
DB_PASSWORD=
~~~

說明：

- GEMINI_API_KEY：Google Gemini Developer API Key，只放在本機 backend/.env。
- DB_HOST：XAMPP 本機通常為 127.0.0.1。
- DB_PORT：預設 3306；若 XAMPP 使用其他 port，請改成實際值。
- DB_NAME：預設 eyeep。
- DB_USER：本機 XAMPP 常見為 root。
- DB_PASSWORD：依本機 MariaDB 設定填寫；空值只適用於本機確實沒有密碼的情況。

禁止提交真實 API Key、密碼、學生資料或評量文件。真正的 backend/.env 已被 .gitignore 排除。

## Migration 與資料表初始化

目前沒有獨立的 npm run migrate 指令。實際執行方式是後端啟動時，backend/src/server.ts 呼叫 runMigrations()，由 backend/src/db/migrate.ts 依序建立或更新資料表。

從空白 eyeep 資料庫初始化：

1. 啟動 XAMPP MySQL。
2. 建立 eyeep 資料庫。
3. 完成 backend/.env。
4. 在 backend/ 執行：

~~~powershell
npm run dev
~~~

程式會依序執行 migration 001 至 005，不需要手動逐一貼 SQL。backend/src/db/migrations/ 保存對應 SQL；目前真正由程式執行的 migration SQL 由 backend/src/db/migrate.ts 管理。

確認是否完成：

~~~sql
SELECT version, applied_at
FROM schema_migrations
ORDER BY version;
~~~

正常應包含：001_initial、002_assessment_records、003_assessment_document_analyses、004_game_assessment_results、005_game_assessment_result_shape。

## 資料庫結構

### schema_migrations

Migration 追蹤表。主鍵為 version，另有 applied_at。

### students

學生基本資料。主鍵 id；重要欄位為 name、gender、birth_date、national_id、student_number、created_at、updated_at。national_id 有唯一限制。

### ieps

年度 IEP。主鍵 id；外鍵 student_id → students.id；重要欄位為 academic_year、content、created_at、updated_at。(student_id, academic_year) 唯一，刪除學生時 IEP 依外鍵設定 cascade。

### assessment_records

所有評量的共同索引資料。主鍵 id；外鍵 student_id → students.id 與 iep_id → ieps.id。重要欄位為 source（manual／document／monkey／cpt）、assessment_date、assessment_type、assessment_tool、evaluator、summary、created_at、updated_at。學生與 IEP 外鍵使用 ON DELETE RESTRICT。

### assessment_document_analyses

文件 AI 分析結果。主鍵與外鍵都是 assessment_record_id → assessment_records.id；analysis_id 唯一。重要欄位為 document_info、overall_summary、domains、warnings、analyzed_at、created_at。

### game_assessment_results

Monkey／CPT 完整結果。migration 005 後的主鍵為 id；外鍵 assessment_record_id → assessment_records.id 且唯一；result_id 唯一。重要欄位為 game_type、result_summary、result_payload（完整 JSON）、played_at、created_at、updated_at。

## 資料庫關聯圖

~~~mermaid
erDiagram
    students ||--o{ ieps : "擁有年度 IEP"
    students ||--o{ assessment_records : "學生評量"
    ieps ||--o{ assessment_records : "年度評量"
    assessment_records ||--o| assessment_document_analyses : "文件分析"
    assessment_records ||--o| game_assessment_results : "遊戲結果"

    students {
        CHAR36 id PK
        VARCHAR name
        VARCHAR gender
        DATE birth_date
        VARCHAR national_id UK
        VARCHAR student_number
        DATETIME created_at
        DATETIME updated_at
    }
    ieps {
        CHAR36 id PK
        CHAR36 student_id FK
        SMALLINT academic_year
        JSON content
        DATETIME created_at
        DATETIME updated_at
    }
    assessment_records {
        CHAR36 id PK
        CHAR36 student_id FK
        CHAR36 iep_id FK
        VARCHAR source
        DATE assessment_date
        VARCHAR assessment_type
        VARCHAR assessment_tool
        VARCHAR evaluator
        TEXT summary
        DATETIME created_at
        DATETIME updated_at
    }
    assessment_document_analyses {
        CHAR36 assessment_record_id PK, FK
        CHAR36 analysis_id UK
        JSON document_info
        TEXT overall_summary
        JSON domains
        JSON warnings
        DATETIME analyzed_at
        DATETIME created_at
    }
    game_assessment_results {
        CHAR36 id PK
        CHAR36 assessment_record_id FK, UK
        CHAR36 result_id UK
        VARCHAR game_type
        TEXT result_summary
        JSON result_payload
        DATETIME played_at
        DATETIME created_at
        DATETIME updated_at
    }
    schema_migrations {
        VARCHAR version PK
        DATETIME applied_at
    }
~~~

schema_migrations 只追蹤 migration，沒有和學生或評量資料的外鍵關聯。

## 系統啟動順序

建議使用三個 PowerShell 視窗，順序如下：

### 1. XAMPP MySQL

在 XAMPP Control Panel 按 MySQL 的 Start。

### 2. 後端 API

~~~powershell
cd <專案資料夾>\backend
npm run dev
~~~

API 預設為 port 3001。健康檢查網址：http://localhost:3001/api/health。

### 3. 前端

~~~powershell
cd <專案資料夾>\frontend
npm run dev
~~~

Vite 預設網址通常為 http://localhost:5173。前端 /api 會 proxy 到後端 3001。

## 常用指令

~~~powershell
# frontend
cd frontend
npm run dev
npm run lint
npm run build

# backend
cd ..\backend
npm run dev
npm run build
npm start
~~~

後端另外提供 npm run diagnose:gemini 與 npm run test:gemini-document-analysis。

## 常見錯誤

### MySQL 未啟動

若出現連線失敗或 ECONNREFUSED，請啟動 XAMPP MySQL，並確認 DB_PORT 與 XAMPP 實際 port 相同。

### 資料庫不存在

確認 phpMyAdmin 有 eyeep 資料庫，且 DB_NAME=eyeep。資料庫編碼建議為 utf8mb4_unicode_ci。

### 後端未啟動

前端 /api 失敗時，確認後端終端機仍在執行，並開啟 http://localhost:3001/api/health 測試。

### 環境變數未設定

確認檔案是 backend/.env，不是根目錄或 frontend/.env。資料庫變數必須正確；AI 文件分析另需 GEMINI_API_KEY。

### Migration 未執行

確認後端有成功啟動，再執行：

~~~sql
SELECT * FROM schema_migrations ORDER BY version;
~~~

空白資料庫只要重新啟動後端即可初始化。不要為排錯直接刪除既有資料庫。

## GitHub 協作流程

避免多人直接修改 main，每項功能使用自己的分支：

~~~powershell
git pull origin main
git switch -c feature/your-feature-name
~~~

完成後：

~~~powershell
git status
git add <修改的檔案>
git commit -m "簡短描述此次修改"
git push -u origin feature/your-feature-name
~~~

接著到 GitHub 建立 Pull Request。合併前請確認沒有提交 .env、API Key、密碼、學生個資、評量文件或資料庫備份，並執行前端 lint/build 與後端 build。

## 資料與安全注意事項

目前 .gitignore 已排除 .env／.env.*（保留 .env.example）、node_modules/、dist/、backend/data/、references/ 及本機暫存檔。提交前仍請使用 git status 檢查檔案清單。

請不要上傳真實學生資料、身分證字號、評量文件、資料庫備份、Gemini API Key 或資料庫密碼。修改資料表時，請新增並同步維護 migration，不要只在 phpMyAdmin 手動修改。
