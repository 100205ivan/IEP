# Word 與 PDF 匯出

Word 與 PDF 共用學生、IEP、評量及附件的欄位映射，提供不同的編輯與列印用途。匯出不修改已儲存資料，也不將學生文件送到線上轉檔服務。

## Word 正常編輯版

按「下載 Word」取得 `.docx`，可直接點進正文或表格儲存格打字、刪字及貼上內容。正文、學生資料與電話等欄位都是一般 Word 文字，不使用浮動文字框、整頁畫布或背景截圖。欄位標籤和資料位於相同段落，圖片為行內圖片。

`iep_word_editable.py` 依 `iep-word-template.json` 的原表單欄寬、合併關係、格線及選項建立 A4 原生 Word 表格；文字採正常行距，填寫內容至少 11pt，封面法規註記使用 10pt。原列高作為最小書寫空間，長內容會在原儲存格完整換行、增高並跨頁，不以省略號取代。章節以實際標題分頁，同章內容連續流動，不插入空白分頁段落；可重複的表頭會於跨頁時保留。封面沿用原表單欄寬，姓名超過一行時正常換行，簽名欄維持空白。

Word 適合後續修改，頁數會隨文字與字型調整，可能和 PDF 不同。原表單沒有對應欄位的擴充資訊，以正常段落接在該章之後。未啟用的分支仍不匯出。

## PDF 定稿版

按「產生 PDF 預覽」或下載 PDF，仍使用 `iep_word_fixed.py` 和 `iep-word-template.docx` 保留原 PDF 的固定欄位、框線及列印座標，放不下的完整文字列於該章續表。此內部列印範本使用固定座標文字層，並在本機經 LibreOffice 轉成 PDF；不作為「下載 Word」的編輯檔。這次 Word 編輯修正不改動 PDF 的定稿排版。

## 本機依賴

1. Python 3 及 `pip install -r requirements-word.txt`。`pdfplumber` 僅重建範本時使用；Pillow 用於字寬量測。
2. LibreOffice，僅用來在本機將 DOCX 轉成 PDF。學生文件不送到線上轉檔服務。
3. 後端 `.env` 可設定 `IEP_WORD_PYTHON_PATH` 和 `IEP_SOFFICE_PATH`，值為相應執行檔的完整路徑。Windows 預設尋找 Codex bundled Python，以及 `backend/data/libreoffice/program/soffice.exe` 或標準 LibreOffice 安裝位置；其他系統預設使用 `python3` 與 `soffice`。
4. 目前版面以 Windows 標楷體及 Times New Roman 驗證；量測需有 `C:/Windows/Fonts/kaiu.ttf` 及 `times.ttf`。其他平台部署前須提供相同字型與調整量測字型路徑，再重新驗證版面。不同 Word 排版引擎仍可能有細微字形差異。

每次匯出使用獨立暫存目錄及 LibreOffice profile；完成或失敗後均移除該請求的暫存資料。設定錯誤會回傳可理解的錯誤，不會退回舊版 PDF 冒充新流程。匯出不寫入學生或 IEP 資料。

## 維護與驗證

- `python scripts/iep_word.py --build-template`：從已清理範例答案的 `iep-reference.pdf` 重建兩個範本資產；會覆蓋手動範本修改。
- `python scripts/iep_word.py --model data.json --output editable.docx`：產生正常編輯版 Word，預設為 `--layout editable`。
- `--layout reference`：僅供 PDF 定稿流程使用，保留固定列印版面。
- `npx tsx --test src/tests/iepWordExport.test.ts`：檢查長內容完整保留、未啟用資料排除、空白選項不誤勾、電話標籤與資料在同一段落，以及編輯檔沒有文字框、浮動物件、固定列高或空白分頁段落。
- `npm run build`：後端型別檢查。
- 變更範本後用實際資料與長文字產生 Word 及 PDF，逐頁檢查文字邊界、表格分頁、勾選及簽名欄。

API：`POST /api/iep-export/word` 下載正常編輯版 DOCX；`POST /api/iep-export/pdf` 使用定稿版產生 PDF。兩者共用既有的學生與 IEP 所屬檢查、證明附件及評量資料載入。
