# EyeEP／IEP 個別化教育計畫系統

EyeEP 是以學生個別化教育計畫（IEP）為核心的教學與評量管理系統，提供學生資料、年度 IEP、能力與需求評估、評量紀錄，以及遊戲與 AI 文件分析結果的整合檢視。

本專案目前以 Windows + XAMPP + MariaDB 作為主要開發環境。第一次使用時，請依序準備資料庫、後端與前端。

## 目前功能與開發進度

- 學生與年度 IEP 建立、讀取及編輯
- 人工評量紀錄新增、查看、編輯與刪除
- 評估文件 OCR（Tesseract.js）與去識別化文字整理
- Gemini AI 評估文件分析，依七大能力向度整理摘要與 evidence
- Gemini AI 能力優弱勢與整體需求摘要：先預覽、修改草稿，再選擇欄位套用
- Monkey 工作記憶遊戲與 CPT 持續注意力遊戲
- Monkey／CPT 結果持久化至 MariaDB，支援查看、刪除與歷史紀錄
- 七大能力向度相關評量參考面板已實作，但目前尚未完成完整實測

AI 文件分析與摘要需要有效且有可用額度的 Gemini API Key；其他不需要 AI 的功能仍可在沒有 Key 時啟動。

## AI 使用說明

本次新增的 AI 摘要功能包含：

- 串接 Google Gemini，依目前能力現況、優弱勢紀錄及已儲存評量，產生優勢說明、弱勢說明與整體需求摘要。
- 提供可修改的草稿、需核對事項與逐欄套用，並沿用「儲存 IEP」保存及 PDF 匯出。
- 遮蔽已知識別資訊，提供取消生成、資料變更後重新產生，以及金鑰、額度、逾時與格式錯誤提示。

### 使用前準備

1. 先依下方「系統啟動順序」啟動 MySQL、backend 與 frontend，再開啟要編輯的學生及學年度 IEP。
2. 由管理者在本機 `backend/.env` 填入 `GEMINI_API_KEY`，確認金鑰所屬專案有可用額度，並重啟 backend。金鑰不填在前端，也不要提交到 GitHub。
3. 教師先填寫能力現況、觀察紀錄或優弱勢說明。若要引用文件、人工評量或遊戲結果，先在同一份 IEP 建立並儲存這些評量紀錄。

### 產生能力優弱勢與整體需求摘要

1. 進入「壹、學生能力現況、家庭狀況及需求評估 → 三、學生教育需求評估與能力優弱勢分析」。
2. 滑到最下方「學生現況能力優弱勢分析」，確認勾選的優勢、弱勢向度及補充說明。
3. 在「AI 協助產生摘要」區展開「查看送出的參考資料」核對內容。系統會遮蔽已知識別資訊；自由填寫的觀察仍需人工確認，如有遺漏，先修改原填寫欄位再產生摘要。
4. 點「AI 協助產生摘要」，等待草稿出現；等待期間可按「取消產生」。
5. 核對「優勢能力補充說明」「弱勢能力補充說明」「整體需求摘要」三段草稿及「需核對的資料」，必要時直接修改草稿文字。
6. 勾選要更新的欄位，再按「套用勾選欄位」。已有內容的優勢、弱勢補充說明預設不勾選；空白的補充說明與整體需求摘要預設勾選，套用前可自行調整。優弱勢向度的原勾選不會被 AI 改動。
7. 按頁面上方「儲存 IEP」。看到儲存成功後，重新整理仍可讀到套用後的摘要，匯出 PDF 也會使用已填寫的內容。

「產生摘要」與「套用勾選欄位」都不會自動寫入資料庫，最後一定要按「儲存 IEP」。不採用草稿時可按「捨棄草稿」；修改原表單中的能力現況、既有摘要或參考資料後，須按「重新產生摘要」取得新草稿。草稿內的文字可直接修改，不必因此重新產生。

AI 只協助整理已有資料，內容須由教師核對；缺少資料不代表能力正常或無需求，遊戲結果也不能當作診斷。各能力向度內另列的「AI 協助分析（尚未開放）」目前仍未啟用，這次開放的是頁面下方的摘要功能。

### AI 辨識評估文件

1. 進入「壹 → 二、學生能力現況評量紀錄」，開啟「AI 辨識評估文件」，再按「選擇 PDF」。
2. 等待文字辨識完成；掃描文件會使用 OCR。核對「去識別化後文字預覽」，修正辨識錯字，並移除仍可辨識學生身分的文字。
3. 勾選已檢查去識別化內容，再按「確認去識別化內容」送交 AI 分析。
4. 檢查文件摘要、七大能力向度的證據與注意事項，再按「確認分析結果」加入目前 IEP 的評量紀錄。這一步會直接儲存該份文件分析；可回評量列表查看結果。
5. 回到「壹 → 三」即可在相關向度查看文件參考資料，之後產生需求摘要時也會納入已儲存的文件證據。

### AI 常見情況與處理方式

| 畫面情況 | 處理方式 |
| --- | --- |
| 摘要按鈕無法點選、提示尚無資料 | 先填寫能力觀察或優弱勢資料，或建立評量紀錄；等待參考資料載入完成。 |
| 評量參考資料尚未完整載入 | 確認 backend 與 MySQL 正常，按「重新載入」，完成後再產生。 |
| 尚未設定 AI 摘要服務 | 由管理者設定 `backend/.env` 的 `GEMINI_API_KEY`，並重啟 backend。 |
| Google AI 專案預付額度已用完 | 由管理者在該金鑰所屬的 AI Studio 專案補充額度後再試。 |
| 請求過多、逾時或摘要格式不完整 | 稍後重試；失敗不會覆蓋原有摘要。 |
| 參考資料超過 40,000 字 | 先精簡較長的觀察或評量摘要；系統不會自行截斷資料後送出。 |
| 提示資料已更新，無法套用 | 先重新產生草稿，再核對與套用。 |
| 重新整理後看不到新摘要 | 確認已按「套用勾選欄位」，且最後有按「儲存 IEP」並顯示成功。 |

### 摘要資料來源與後端儲存

在「壹 → 三、學生教育需求評估與能力優弱勢分析」下方按「AI 協助產生摘要」。系統整理目前表單的有效觀察、教師優弱勢紀錄及此份 IEP 已儲存的人工評量、文件證據與遊戲摘要，遮蔽已知識別資訊後送到後端。可展開「查看送出的參考資料」核對自由填寫文字；不傳送整份基本資料、附件、評量者姓名或遊戲逐題資料。

後端 `POST /api/education-summary/generate` 只接受 `{ deidentifiedText }`（最多 40,000 字），共用 `backend/src/config/gemini.ts` 的模型與 30 秒逾時設定，並驗證三段摘要與核對提示的 JSON 結構。沒有金鑰、預付額度不足、逾時及無效回覆均顯示可理解的錯誤，不以假摘要代替。`GEMINI_API_KEY` 僅放於被 Git 忽略的 `backend/.env`，修改後須重啟 backend。

草稿可修改並逐欄勾選套用；既有優弱勢說明預設不勾選覆蓋，整體需求摘要預設勾選。參考資料變更後須重新產生；切換學生、切換 IEP 或離開此章時會中止前端請求，避免舊結果套入其他學生。按「套用勾選欄位」只更新畫面，仍須按「儲存 IEP」才會寫入 `iep_assessments.strength_weakness_summary`，匯出 PDF 沿用該欄位。產生草稿本身不寫入資料庫。

本機合約與錯誤處理測試：在 `backend/` 執行 `npm run test:education-summary`，不呼叫外部 AI，也不修改學生資料。

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

程式會依序執行 migration 001 至 007，不需要手動逐一貼 SQL。`backend/src/db/migrate.ts` 管理啟動順序，006 的資料搬移邏輯位於 `backend/src/db/migrations/iepChapterMigration.ts`，007 的欄位清理位於 `unusedColumnMigration.ts`。同目錄的 006／007 SQL 是 DDL 參考，應啟動後端完成資料搬移、清理前檢查及版本記錄。

確認是否完成：

~~~sql
SELECT version, applied_at
FROM schema_migrations
ORDER BY version;
~~~

正常應包含：001_initial、002_assessment_records、003_assessment_document_analyses、004_game_assessment_results、005_game_assessment_result_shape、006_iep_chapter_tables、007_unused_columns。

## 資料庫結構

### schema_migrations

Migration 追蹤表。主鍵為 version，另有 applied_at。

### students

學生基本資料。主鍵 id；重要欄位為 name、gender、birth_date、national_id、student_number、created_at、updated_at。national_id 有唯一限制。

### ieps

年度 IEP。主鍵 id；外鍵 student_id → students.id；重要欄位為 academic_year、content、created_at、updated_at。(student_id, academic_year) 唯一，刪除學生時 IEP 依外鍵設定 cascade。

006 起，`content` 只保留沿用基本資料通知及未知／未來欄位等延伸資訊，壹到伍與會議紀錄的正式資料來源改為以下六張表。沒有延伸資訊時，`ieps.content` 為 `{}` 是正常狀態。

### IEP 章節資料表

| 資料表 | 章節 | JSON 欄位 |
|---|---|---|
| `iep_assessments` | 壹：學生現況、家庭及需求評估 | `student_family_form`、`assessment_selections`、`assessment_details`、`strength_weakness_summary` |
| `iep_services` | 貳：特殊教育、相關服務與支持策略 | `special_education_support`、`inclusive_education_plan`、`curriculum_adjustment`、`course_plan_items`、`weekly_schedule` |
| `iep_goals` | 參：學年／學期目標及達成情形 | `goal_domains`、`semester_goals`、`learning_notes` |
| `iep_behavior_interventions` | 肆：行為介入及行政支援 | `behavior_intervention` |
| `iep_transitions` | 伍：轉銜服務及追蹤 | `transition_support` |
| `iep_meetings` | IEP 會議紀錄 | `meeting_records` |

各表每份 IEP 各一列，以 `iep_id` 作為主鍵及外鍵，連到 `ieps.id`。建立與更新時間統一由父表 `ieps.created_at`、`ieps.updated_at` 記錄。子項目的勾選、巢狀明細與清單保留 JSON 結構。`students` 保存學生基本身分，`ieps` 保存年度歸屬，六張表透過 IEP 對應學生及學年度。評量紀錄、文件及遊戲仍使用原本三張評量資料表。

SQL `NULL` 代表該 API 欄位未提供；JSON `null`、空字串及空陣列是不同的已提供值，讀回時會保持區別。新建空白年度 IEP 仍會建立六列章節資料，各欄位可為 SQL `NULL`。

**既有資料搬移：** 升級前先備份資料庫。後端啟動時，006 先建立可重試的空表，再以同一個 transaction 搬移所有 IEP 的 15 個章節欄位，移除父表中的舊章節副本，最後記錄 migration 版本。搬移失敗會還原資料變更；空表會保留供重試。已完成的 migration 不會重跑覆寫新資料；如發現未記錄版本但章節表已有資料，會停止搬移以避免覆寫。

**API 相容性：** 原有 IEP 新增、年度建立、查詢及更新 API 維持相同 `content` 格式。後端負責拆寫及組合六張表；一次儲存的學生、年度與所有章節在同一個 transaction 中完成。讀取會鎖住對應父層 IEP，避免同一回應混入不同次儲存的章節。沿用基本資料會從壹的資料表讀取來源。刪除 IEP 會連帶移除六列章節，但有評量資料時仍依原本的外鍵保護拒絕刪除。

資料已搬移後，回復舊版程式也需要搭配變更前的資料庫備份；舊版無法從六張新表組合章節內容。

在 `backend/` 執行 `npm run test:chapter-migration` 與 `npm run test:chapter-storage`，可驗證搬移、重跑、錯誤還原、API 相容性、跨年度、清空欄位、並行讀寫及刪除連動。測試使用獨立的 `eyeep_chapter_*_test_<隨機識別碼>` 資料庫並於結束移除，連線帳號需具備建立／刪除測試資料庫及建立測試 trigger 的權限。

### 未使用及重複時間欄位清理

007 移除六張章節表各自的 `created_at`、`updated_at`，以及 `game_assessment_results.updated_at`，共 13 個未被畫面或 API 回傳使用的冗餘欄位。章節時間由 `ieps` 保存；遊戲結果為不可修改的歷史紀錄，保留 `created_at` 與 `played_at`。學生、年度、章節內容、關聯識別碼、評量及資料沿用通知均維持原有功能；`ieps.content` 仍保存沿用通知及延伸資訊。

執行前先備份資料庫。清理程式會先檢查所有候選欄位：章節時間須與父表相同，遊戲更新時間須與建立時間相同；如有不同的歷史時間，會在變更任何表之前停止，交由管理者確認。MariaDB DDL 會自動提交，因此程式會檢查仍存在的欄位，讓中途中斷的清理可以續跑；完成後才記錄 007 版本。

在 `backend/` 執行 `npm run test:unused-columns`，會使用獨立的 `eyeep_cleanup_test_<隨機識別碼>` 資料庫，驗證歷史時間保護、部分 DDL 續跑、重跑及內容保存，測試完成後移除。舊版程式仍會寫入已移除的時間欄位，回復舊版須同時還原變更前的資料庫備份。

### assessment_records

所有評量的共同索引資料。主鍵 id；外鍵 student_id → students.id 與 iep_id → ieps.id。重要欄位為 source（manual／document／monkey／cpt）、assessment_date、assessment_type、assessment_tool、evaluator、summary、created_at、updated_at。學生與 IEP 外鍵使用 ON DELETE RESTRICT。

### assessment_document_analyses

文件 AI 分析結果。主鍵與外鍵都是 assessment_record_id → assessment_records.id；analysis_id 唯一。重要欄位為 document_info、overall_summary、domains、warnings、analyzed_at、created_at。

### game_assessment_results

Monkey／CPT 完整結果。migration 005 後的主鍵為 id；外鍵 assessment_record_id → assessment_records.id 且唯一；result_id 唯一。重要欄位為 game_type、result_summary、result_payload（完整 JSON）、played_at、created_at。007 已移除未使用的 updated_at。

## 資料庫關聯圖

~~~mermaid
erDiagram
    students ||--o{ ieps : "擁有年度 IEP"
    students ||--o{ assessment_records : "學生評量"
    ieps ||--o{ assessment_records : "年度評量"
    ieps ||--|| iep_assessments : "壹"
    ieps ||--|| iep_services : "貳"
    ieps ||--|| iep_goals : "參"
    ieps ||--|| iep_behavior_interventions : "肆"
    ieps ||--|| iep_transitions : "伍"
    ieps ||--|| iep_meetings : "會議紀錄"
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

### 評量紀錄後端整合測試

在 `backend/` 執行 `npm run test:assessments`，可驗證人工評量的新增、讀取、更新與刪除，以及文件分析、Monkey／CPT 結果的保存、重複匯入與跨學生／學年度 IEP 的資料隔離。

測試會依 `.env` 的 MariaDB 連線設定，建立名稱為 `eyeep_assessment_test_<隨機識別碼>` 的獨立資料庫，執行 migration，並於結束後移除；連線帳號需有建立及刪除資料庫的權限。測試不寫入 `DB_NAME` 指定的既有資料庫，也不呼叫 Gemini，文件及遊戲結果使用合成資料。

文件分析詳情 API `GET /api/assessments/:assessmentId/document-analysis` 必須帶入 `iepId` query 參數；沒有提供時回傳 400，不屬於該 IEP 時回傳 404。前端評量紀錄與七大能力向度參考面板均會帶入目前 IEP。

人工與遊戲評量的日期必須是實際存在且可存入 MariaDB 的 `YYYY-MM-DD` 日期，否則回傳 400。文件分析日期若無法作為日期索引，會以匯入當日建立評量索引，並保留分析中的原始日期文字。

## 常見錯誤

### 特殊教育及支持服務需求的儲存

「貳 → 一、特殊教育及支持服務需求」使用頁面上方的「儲存 IEP」，透過既有的 IEP 新增／更新 API 寫入 `iep_services.special_education_support`（API 欄位為 `content.specialEducationSupport`）。特殊教育服務、專業服務明細、家庭、人力、行政設備、交通及經濟支持均會保存；清空欄位或取消勾選後也需再次儲存。

後端允許保存尚未填完的草稿，會為缺少的欄位補上空值。人力支持時數須為非負數；專業服務日期須有效，已勾選服務的結束日期不可早於開始日期。取消勾選專業服務時會保留其明細草稿，但不會自動視為本年度仍需該服務。

在 `backend/` 執行 `npm run test:support-services` 可驗證全欄位保存、修改／清空、不同學生與學年度、部分舊資料的預設值，以及驗證失敗時不覆寫資料。測試使用獨立的 `eyeep_support_test_<隨機識別碼>` 資料庫並於結束後移除，MariaDB 帳號需有建立及刪除資料庫的權限。

### 融合教育規劃的儲存

「貳 → 二、融合教育規劃」使用頁面上方的「儲存 IEP」，將年級、班級、參與方式、抽離課程、活動與支持策略等 13 個欄位保存至 `iep_services.inclusive_education_plan`。API 沿用 `content.inclusiveEducationPlan` 格式。

後端驗證選項、欄位型別與文字長度，允許空白草稿，並保留隱藏欄位及未來欄位。取消勾選或清空後需再按「儲存 IEP」才會更新。前端讀取缺少本章或部分欄位的舊資料時會補上預設值。

在 `backend/` 執行 `npm run test:inclusive-education` 可測試 schema 與前端預設值處理；此指令不連線資料庫，也不建立學生資料。實際 API／資料庫測試使用本機指定的學生 IEP。

### 課程調整、課程規劃與每週課表的儲存

「貳 → 三、課程調整方式」「四、學生課程規劃表」「五、學生每週課表」均透過「儲存 IEP」保存，分別寫入 `iep_services` 的 `curriculum_adjustment`、`course_plan_items`、`weekly_schedule`；API 欄位維持 `curriculumAdjustment`、`coursePlanItems`、`weeklySchedule`。

課程視窗的「儲存課程」、課表視窗的「儲存安排」會先更新目前畫面，完成後仍須按上方「儲存 IEP」才能寫入資料庫。刪除課程後儲存 IEP，會一併移除該課程的課表安排。課表以課程 ID 連結名稱、教師等資料，修改課程後會同步顯示新內容。

後端驗證四種課程調整策略、課程欄位與節數，並拒絕重複課程 ID、重複時段，以及課表引用不存在於同份 IEP 的課程。超過規劃每週節數仍依畫面提示處理，不阻擋儲存。舊資料缺少欄位時會補上預設值；舊課表會依既有畫面邏輯保留每時段第一筆有效安排，忽略無法對應課程的項目。

在 `backend/` 執行 `npm run test:curriculum-schedule` 可測試欄位驗證、課程與課表關聯、刪除連動及舊資料處理。此指令不連線資料庫或建立學生；實際資料庫測試使用本機指定的學生 IEP。

### 學年／學期教育目標與目標達成情形的儲存

「參 → 一、領域與學年教育目標」「二、學期教育目標與評量」「三、目標達成情形」統一透過「儲存 IEP」保存至 `iep_goals.goal_domains`、`semester_goals`、`learning_notes`；API 欄位維持 `goalDomains`、`semesterGoals`、`learningNotes`。評量紀錄、教學決定及其說明保存在對應的學期目標內；目標達成摘要由目前學期／領域的目標與教學決定計算。

各視窗的「儲存」與教學決定選項會先更新目前畫面，完成後仍須按上方「儲存 IEP」才會寫入資料庫。刪除領域或學年目標時，畫面會一併移除相關學期目標及評量紀錄；API 也會拒絕保留失去父層關聯的學期目標。

後端檢查領域、學年／學期目標與評量紀錄的識別碼及關聯，驗證日期和起迄順序。機會與成功次數須為非負整數，成功次數不得超過總機會；達成率介於 0 至 100，等級介於 1 至 5。日期與尚未完成的達成標準可以留白保存草稿。舊資料缺少欄位時會補上預設值，不顯示無法對應領域及學年目標的學期資料。

在 `backend/` 執行 `npm run test:education-goals` 可驗證欄位、四種達成標準、父子關聯、刪除連動與舊資料處理；此指令不連線資料庫或建立學生資料。實際資料庫測試使用本機指定學生的 IEP。

### 行為介入與轉銜服務的儲存

「肆、行為功能介入方案及行政支援」及「伍、轉銜輔導及服務內容」透過上方「儲存 IEP」，分別寫入 `iep_behavior_interventions.behavior_intervention` 與 `iep_transitions.transition_support`；API 欄位維持 `behaviorIntervention`、`transitionSupport`。行為評估、各類策略、行政支援、執行成效、跨階段計畫、六類轉銜服務及追蹤紀錄都包含在其中。

切換為無需求、關閉跨階段計畫或追蹤輔導時會保留明細草稿；重新開啟後可繼續編輯。追蹤視窗的「儲存紀錄」及刪除會先更新畫面，仍須按「儲存 IEP」才會永久保存。

後端驗證選項、日期、追蹤紀錄的識別碼及文字長度；有需求的行為介入計畫與轉銜服務，結束日期不可早於開始日期。日期和未完成欄位可以留白保存草稿。舊資料缺少深層欄位時，前端會補上各服務、計畫與追蹤紀錄的預設值。

在 `backend/` 執行 `npm run test:behavior-transition` 可驗證欄位、日期、需求開關、草稿保存、追蹤紀錄與舊資料處理；此指令不連線資料庫或建立學生。實際保存與讀回測試使用本機指定學生的 IEP。

### IEP 會議紀錄的儲存

「IEP 會議紀錄」透過上方「儲存 IEP」保存至 `iep_meetings.meeting_records`，API 欄位維持 `content.meetingRecords`。每筆會議的基本資料、與會人員及出席狀態、九類討論事項、決議及臨時動議均會保存。會議視窗顯示目前學生與學年度，資料歸屬於開啟的那份年度 IEP。

視窗內「儲存會議紀錄」、新增／編輯明細及刪除會先更新畫面，完成後仍須按上方「儲存 IEP」才會寫入資料庫。取消勾選討論事項或切換「無臨時動議」時，會保留其文字供後續編輯；刪除個別項目或清空會議列表後儲存，才會移除該資料。

會議日期、地點及「其他」會議類型說明與現有表單一樣必填。後端驗證有效日期、選項、姓名、內容、文字長度，以及每份會議和各明細列表內的唯一識別碼。缺少明細欄位的舊資料會補上預設值；前端也會補齊尚未列出的標準討論項目，缺少本章的年度 IEP 顯示空列表。

在 `backend/` 執行 `npm run test:iep-meetings` 可驗證欄位、識別碼、明細修改／清空、隱藏內容保留與舊資料處理；此指令不連線資料庫或建立學生。實際 API／資料庫測試使用本機指定學生的 IEP。

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
