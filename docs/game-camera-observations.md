# 遊戲攝影機觀察

猴子工作記憶與 CPT 共用 MediaPipe Face Landmarker 0.10.32，並在背景執行表情與影像參與樣態研究模型。此版本提供相對於正面校準的頭部朝向、資料集表情分類與影像參與樣態，不提供螢幕注視座標、內心情緒判定、專注度分數或診斷功能。

## 操作

先開啟並儲存學生與年度 IEP，從「壹 → 二、學生能力現況評量紀錄 → EyeEP 遊戲評量」進入，讓遊戲綁定正確學生與學年度。

1. 在任一遊戲的準備頁按「開啟偵測」，允許攝影機。
2. 看向螢幕中央，按「校準正面朝向」，保持正面約三秒。校準失敗可重試。
   準備頁會約每秒更新「模型即時預覽」的表情與參與樣態，可先微笑核對反應；這些預覽不納入正式紀錄。
3. 依原本流程練習、選擇年齡與正式遊玩。攝影機為選用；權限拒絕或載入失敗仍可遊玩。
4. 正式測驗結束顯示各狀態時間與有效追蹤涵蓋率。選擇「匯入 IEP 評量紀錄」時，既有結果 JSON 會一併保存 `result.attention`；舊結果不需遷移。

按「匯入 IEP 評量紀錄 → 確認匯入」才會永久保存，之後回到同一份 IEP 評量清單按「查看」核對。未綁定學生／IEP 的直接試玩無法匯入；準備頁預覽、遊戲結果畫面及本機測試檔案都不會自動建立資料庫紀錄，離頁或重玩前請先完成匯入。

猴子遊戲分開統計聆聽與作答；CPT 統計正式數字作答。練習和設定不計入結果。結果出現、返回選擇頁、重玩、手動關閉或元件卸載會釋放攝影機與 worker。關閉偵測後若仍在正式遊玩，剩餘時間列為無法判讀。

## 模型與資產

- [官方使用說明](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- npm 套件固定為 `@mediapipe/tasks-vision@0.10.32`。執行時與 WASM 由 Vite 從此套件提供到 `/vision/`，只在使用者開啟偵測時下載到瀏覽器。
- 官方預訓練模型：<https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task>
- 本機檔案：`frontend/public/vision/face_landmarker.task`，3,758,596 bytes。
- SHA-256：`64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`。
- MediaPipe 原始碼及授權：<https://github.com/google-ai-edge/mediapipe>。發布時保留相關第三方授權資訊。

採用 classic Web Worker 執行 CPU 推論，避免臉部偵測阻塞遊戲 UI。每個推論結束後等待 180ms 再送下一幀，只有一幀在處理；輸入縮放為 320×240。Worker 結束會釋放模型記憶體。

所有影像、特徵點與矩陣在裝置端暫時處理，不錄影、不上傳、不持久保存。匯入 IEP 時，攝影機部分只傳送頭部朝向時間摘要、校準狀態、模型版本／權重雜湊、朝向角度門檻，以及表情／參與樣態分類次數。分類信心門檻保存在發布的模型 manifest。

表情使用官方 ONNX Model Zoo FER+ 預訓練模型；影像參與樣態使用本專案訓練的小型 CNN。額外分類約每秒取樣一次；只在正式遊玩期間累計，低於驗證集所選門檻時保留「不確定」。分類次數不是持續時間或專注度比例。比較結果與訓練方法記錄於 `ml/reports/` 與 `ml/README.md`。

MediaPipe、TensorFlow.js、ONNX Runtime 和權重檔均由此網站自己的 `/vision/` 供應，只有使用者主動開啟偵測才載入。分類模型載入失敗時，保留頭部追蹤並在介面標示表情／參與模型不可用。

## 分類與限制

- 要求畫面只有一張臉，正面校準至少八個有效且穩定的樣本。
- 相對校準朝向，水平偏轉不超過 25 度且垂直不超過 20 度，標為「面向螢幕」，超過則標為「頭部轉向」。門檻是原型設計值，尚未經目標學生驗證。
- 沒有校準、沒有臉、多人入鏡、切換分頁、關閉攝影機或模型回傳無效結果時，均列為「無法判讀」（舊版稱「資料不足」）。最後一筆有效觀察超過 700ms 亦不繼續推算。
- 以實際經過時間積分，不以每個狀態的幀數計算；各階段時間合計等於正式測驗時間。
- 頭部面向螢幕不代表注視題目或專心；移開也可能是在聽、回想、休息或使用其他溝通方式。應搭配遊戲表現、學生回饋及教師觀察。
- 未驗證真實學生的準確率。若下一步需要「看向哪個選項」，需另行整合與驗證 WebEyeTrack 等視線模型和校準流程。

## 驗證

前端：`npm run build`、`npm run lint`、`npm run test:attention`、`npm run test:camera-startup`。

瀏覽器整合：`node scripts/verify-games-browser.cjs --attention`。使用專用無頭 Chrome、模擬攝影機與可控制的姿態回傳，檢查兩款完整遊戲、權限拒絕／重試、校準、資源釋放及手機版面；另外以真實 worker／WASM／模型處理空白影像，確認實際推論鏈可用。這些測試不代表已驗證真人辨識準確率。

後端：`npm run test:attention`。驗證新舊兩款結果格式、觀察資料保留及不一致時間的拒絕。`npm run test:assessments` 另以獨立測試資料庫驗證攝影機結果保存／讀回與 IEP 隔離。

兩款完整真人測試及準備頁微笑核對見 [測試摘要](game-camera-test-results.md)。

## 組員同步與部署

更新程式後在 `frontend/` 執行 `npm ci`，依 lockfile 安裝 MediaPipe、TensorFlow.js 與 ONNX Runtime Web，再啟動或重啟前後端。模型權重、manifest 與授權已放在 `frontend/public/vision/`；一般使用無需安裝 Python 或重新訓練。公開資料訓練／評估才需要 `ml/requirements.txt`。

正式部署使用 `npm run build` 的完整 `frontend/dist/`，包含 `/vision/` 靜態資產；保留 JavaScript 與 WASM 正確 MIME type。攝影機須在 HTTPS 或 localhost 使用。此功能沿用 `game_assessment_results.result_payload` 的 JSON，不新增 migration；應同步更新後端 schema，避免舊後端移除新的觀察欄位。
