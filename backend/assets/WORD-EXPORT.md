# Word 與 PDF 匯出

Word 與 PDF 共用學生、IEP、評量及附件的欄位映射，提供不同的編輯與列印用途。匯出不修改已儲存資料，也不將學生文件送到線上轉檔服務。

## Word 填寫版

按「下載 Word」取得 `.docx`：直接把資料填進官方空白表單 `iep-form-template.docx`，標楷體、底線填空、紅藍字標示、表格與章節編號都沿用原表單，可直接在 Word 修改。

`iep_word_form.py` 將原 PDF 版面文字（`iep-word-template.json`）與空白表單逐字對齊，再依欄位在 PDF 上的位置找到 Word 中對應的標籤或儲存格：

- 標籤後的值接在冒號之後；底線 Tab 保留為填寫線（表單靠它換行），值本身加底線。
- 「＿年＿月＿日」拆成年、月、日分別填寫；「國中＿年級」等單位保留，值寫在填寫線上。
- 空白儲存格以同列標籤或上方欄名定位；勾選的 □ 改為 ■（沿用表單字型，不使用字型缺字的 ☑）。
- 每個領域的學年目標、每學期的學期目標與每次會議各自複製一份表單頁，說明清單編號重新起算。
- 原表單沒有位置的擴充資訊，以「補充資料」段落接在該頁之後；`generateIepWord` 回傳 `unplaced` 筆數。補充資料標題對齊表格文字，各筆內縮兩字，同一筆的後續行再內縮兩字。
- 學期目標表只保留有填寫的目標，空白目標至少留 3 組供手寫，其餘空白列刪除。
- 方式／標準／支持等約 32pt 的窄欄以 10pt 填寫；超過 3 行時格內改寫 ※1，完整內容列於該頁補充資料。
- 填入值的儲存格段落採 1.25 倍行距、上下各 3pt；原表單為細明體設定的固定行高改為最小行高，避免標楷體被壓擠。
- 每週課表維持原 PDF 的固定列高，課程與教師以 9pt 兩行填入；封面維持原表單間距，確保一頁內排完。

Word 適合後續修改，頁數會隨文字與字型調整，可能和 PDF 不同。未啟用的分支仍不匯出。

## PDF 定稿版

按「產生 PDF 預覽」或下載 PDF，先產生與「下載 Word」相同的填寫版，再在本機經 LibreOffice 轉成 PDF，因此 PDF 與 Word 內容、樣式一致。範本建置時已將原表單的中文字型統一為標楷體（英文與數字維持 Times New Roman），與原參考 PDF 相同；長內容在原儲存格內換行增高，不截斷、不另產生續頁。

`iep_word_fixed.py` 與 `iep-word-template.docx` 的固定座標版面仍可用 `--layout reference` 產生，但匯出 API 已不使用。

## 本機依賴

1. Python 3 及 `pip install -r requirements-word.txt`。`pdfplumber` 僅重建範本時使用；Pillow 用於字寬量測。
2. LibreOffice，僅用來在本機將 DOCX 轉成 PDF。學生文件不送到線上轉檔服務。
3. 後端 `.env` 可設定 `IEP_WORD_PYTHON_PATH` 和 `IEP_SOFFICE_PATH`，值為相應執行檔的完整路徑。Windows 預設尋找 Codex bundled Python，以及 `backend/data/libreoffice/program/soffice.exe` 或標準 LibreOffice 安裝位置；其他系統預設使用 `python3` 與 `soffice`。
4. 目前版面以 Windows 標楷體及 Times New Roman 驗證；量測需有 `C:/Windows/Fonts/kaiu.ttf` 及 `times.ttf`。其他平台部署前須提供相同字型與調整量測字型路徑，再重新驗證版面。不同 Word 排版引擎仍可能有細微字形差異。

每次匯出使用獨立暫存目錄及 LibreOffice profile；完成或失敗後均移除該請求的暫存資料。設定錯誤會回傳可理解的錯誤，不會退回舊版 PDF 冒充新流程。匯出不寫入學生或 IEP 資料。

## 維護與驗證

- `python scripts/iep_word.py --build-template`：從已清理範例答案的 `iep-reference.pdf` 重建兩個範本資產；會覆蓋手動範本修改。
- `python scripts/iep_word.py --build-form-template <官方空白表單.docx>`：清除原表單第 13～14 頁目標表的範例答案、將中文字型統一為標楷體，重建 `iep-form-template.docx`。表單改版時須同步檢查 `iep_word_form.py` 的 `PARTS`（各 PDF 頁對應的 Word 段落與表格列）。
- `python scripts/iep_word.py --model data.json --output form.docx`：產生 Word 填寫版，預設為 `--layout form`；無法放入表單的欄位會列於 stderr。
- `--layout reference`：僅供 PDF 定稿流程使用，保留固定列印版面。
- `npx tsx --test src/tests/iepWordExport.test.ts`：以 `src/tests/fixtures/iep-word-sample.json`（虛構測試資料）檢查每個欄位與勾選都放入表單、日期填入年月日、第二學期目標頁、不含範例答案，以及長內容完整保留、沒有固定列高。
- 版面檢查：每次產生 PDF 時，`checkPdfLayout`（`scripts/check_layout.py`）會自動檢查填入值被擠成直排、超出頁面、幾乎空白的頁面、未放入表單的欄位，以及 ☑／☐ 或範例答案。只比對填入的值，表單本身的直排標籤不會誤報。結果經 `X-IEP-Layout` 標頭回傳，PDF 預覽上方會顯示，點頁碼可直接跳到該頁；檢查失敗不影響匯出。Word 下載不轉 PDF，因此不另外檢查。
- `npm run check:word-layout [-- 請求.json]`：在終端機執行同一套檢查（預設為虛構測試資料），另存逐頁 PNG 於 `backend/data/layout-check/`（不進版控）；有需修正項目時結束代碼為 1。LibreOffice 的字型量測與 Word 可能略有差異，最後仍以 Word 開啟確認。
- `npm run build`：後端型別檢查。
- 變更範本後用實際資料與長文字產生 Word 及 PDF，逐頁檢查文字邊界、表格分頁、勾選及簽名欄。

API：`POST /api/iep-export/word` 下載正常編輯版 DOCX；`POST /api/iep-export/pdf` 使用定稿版產生 PDF。兩者共用既有的學生與 IEP 所屬檢查、證明附件及評量資料載入。
