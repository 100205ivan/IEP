# Word 與 PDF 匯出

匯出流程：原 PDF → 保留原座標的可編輯 Word 範本 → 帶入資料 → 溢出內容接續表 → 本機轉 PDF。

`iep-word-template.docx` 保存原 PDF 的 A4 頁面、欄寬、列高、合併關係與框線位置；`iep-word-template.json` 保存原 PDF 幾何及文字資訊。文字是原生 Word 文字方塊，原頁使用 Word 表格網格與向量框線，沒有把整頁 PDF 貼成圖片。使用者可編輯文字，但手動增加文字或更換字型後仍須檢查版面。

Word 及 PDF 使用相同的欄位映射與資料來源，保留原章節、選項、附件及未勾選分支排除規則。原頁不隨資料增長而改變列高或推移欄位；放不下時原欄顯示可容納的文字與省略號，完整內容列於該章續表。續表為原生 Word 表格，可自動增高、跨頁及重複表頭。額外評量、目標及會議複製對應原頁；原格式沒有對應欄位的擴充資料也列於該章續表。原頁幾何保持固定，總頁數仍隨紀錄數與續表內容改變。

## 本機依賴

1. Python 3 及 `pip install -r requirements-word.txt`。`pdfplumber` 僅重建範本時使用；Pillow 用於字寬量測。
2. LibreOffice，僅用來在本機將 DOCX 轉成 PDF。學生文件不送到線上轉檔服務。
3. 後端 `.env` 可設定 `IEP_WORD_PYTHON_PATH` 和 `IEP_SOFFICE_PATH`，值為相應執行檔的完整路徑。Windows 預設尋找 Codex bundled Python，以及 `backend/data/libreoffice/program/soffice.exe` 或標準 LibreOffice 安裝位置；其他系統預設使用 `python3` 與 `soffice`。
4. 目前版面以 Windows 標楷體及 Times New Roman 驗證；量測需有 `C:/Windows/Fonts/kaiu.ttf` 及 `times.ttf`。其他平台部署前須提供相同字型與調整量測字型路徑，再重新驗證版面。不同 Word 排版引擎仍可能有細微字形差異。

每次匯出使用獨立暫存目錄及 LibreOffice profile；完成或失敗後均移除該請求的暫存資料。設定錯誤會回傳可理解的錯誤，不會退回舊版 PDF 冒充新流程。匯出不寫入學生或 IEP 資料。

## 維護與驗證

- `python scripts/iep_word.py --build-template`：從已清理範例答案的 `iep-reference.pdf` 重建兩個範本資產；會覆蓋手動範本修改。
- `npx tsx --test src/tests/iepWordExport.test.ts`：檢查長內容完整保留、未啟用資料排除、空白選項不誤勾，以及產出真正的 DOCX。
- `npm run build`：後端型別檢查。
- 變更範本後用實際資料與長文字產生 Word 及 PDF，逐頁檢查文字邊界、表格分頁、勾選及簽名欄。

API：`POST /api/iep-export/word` 下載 DOCX；`POST /api/iep-export/pdf` 以同一 Word 流程產生 PDF。兩者共用既有的學生與 IEP 所屬檢查、證明附件及評量資料載入。
