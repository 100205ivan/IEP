# 表情與影像參與樣態原型

兩款遊戲（猴子工作記憶、CPT）共用本機攝影機追蹤、表情分類及影像參與樣態分類。影像只在瀏覽器背景執行緒處理；正式遊戲完成後顯示摘要，可隨遊戲結果匯入 IEP。模型不判定學生內心感受，也不產生專注度或 IEP 達成分數。

## 實際測試結果

| 模型／任務 | 測試影像數 | 整體正確率 | Balanced accuracy | Macro F1 |
|---|---:|---:|---:|---:|
| 部署的官方 FER+ 八類表情模型 | 3,226 | **81.15%** | 55.10% | 57.44% |
| 本次自行訓練的二類影像參與 CNN | 2,459 | **93.09%** | 93.12% | 93.07% |
| 初始自行訓練的 FER2013 七類 CNN（比較基準，未部署） | 3,572 | 53.19% | 53.78% | 49.63% |

以上整體成績都沒有使用模型信心門檻刪掉難題。FER+ 的任務定義保留八種表情；排除作者標註為 unknown／non-face 的資料，並移除評估影像中與上游訓練／驗證集完全重複的像素。原始 FER2013 標籤與 FER+ 多人標籤是不同評估任務，不能直接混用成績；部署模型在同一批影像的原始 FER2013 標籤下只有 58.15%。

**81.15% 不代表每一種表情都達到 80%。** FER+ 測試集以中性與開心為主：開心召回率 91.73%，生氣 70.38%，難過 51.22%，害怕 37.50%，厭惡 17.65%，輕蔑 0%。少數類別仍有明顯弱項，所以原型不能當作各類情緒均可靠的評量工具。完整混淆矩陣、各類 precision／recall／F1 與排除規則見 JSON 報告。

- [官方模型比較報告](reports/emotion-ferplus.json)
- [參與樣態訓練與測試報告](reports/engagement.json)
- [初始表情 CNN 報告](reports/emotion.json)

## 資料與來源

### 表情

初始模型實際使用 [FER2013](https://www.kaggle.com/datasets/deadskull7/fer2013) 訓練；此發布頁標示 CC0。檔案為 `data/fer2013.zip`，101,279,992 bytes，SHA-256 `0053fdef247c8db3c1967c7a81898485eaa1d75489f43493fb4d8fa727f14698`。原始 Usage 分割：Training／PublicTest／PrivateTest，去除完全重複影像後分別為 26,942／3,520／3,572 張。

為改善表情分類，部署版改用 [官方 ONNX Model Zoo FER+ checkpoint](https://github.com/onnx/models/tree/main/validated/vision/body_analysis/emotion_ferplus)，MIT。該 checkpoint 由上游以 CNTK cross-entropy 訓練；本次沒有宣稱重新訓練這個 checkpoint。標籤來自 [Microsoft FERPlus](https://github.com/microsoft/FERPlus)，每張圖有多位標註者的票數。評估使用 PublicTest 3,260 張與 PrivateTest 3,226 張，沒有用 PrivateTest 調整模型參數或拒絕門檻。

輸入為 64×64 灰階、float32、0–255，輸出八類 logits 後作 softmax。Python 評估採 Pillow LANCZOS 縮放；遊戲採瀏覽器 canvas 臉部裁切與縮放，實際攝影機成績需要另外測試。這次保留測試集成績不能取代瀏覽器場景的驗證。

### 影像參與樣態

[E-learning Student Engagement and Disengagement Image Dataset for Educational Research](https://zenodo.org/records/16731734)，作者 Parinita Chate、Kailas Patil，CC BY 4.0。原檔 `Final Dataset 256.zip`，191,946,625 bytes；作者發布 MD5 `897ecb874df4c1ded4993d5264edfd3b`，已核對。

原資料約 16,000 張，去除相同縮放像素後剩下 12,571 張；另發現 11 張相同影像被標成不同類別，已全部排除，最終保留 12,560 張。以 dHash 群組作固定 seed 42 的分割，訓練／驗證／測試為 7,446／2,655／2,459 張；同一個 dHash 群組不跨集合。排除矛盾標註時，其餘影像保留原來的分割。清理前的初始結果為 93.79%，清理並重新訓練後的最終結果為 93.09%；前者僅保留作資料稽核紀錄。**資料未提供完整人物 ID，因此這不是受試者互斥分割，相同人物或背景造成的偏差仍可能存在。**

模型是三層 Conv2D（16／32／64 filters，各接 2×2 MaxPool）、Flatten、Dense 64、Dense 2，輸入整張 64×64 RGB 影像並除以 255。訓練使用類別權重、水平翻轉、Adam、驗證 loss early stopping；最多 12 epochs，這次執行 10 epochs 並還原最佳驗證 loss 的權重。93.09% 是對資料集「參與／未參與」影像標籤的正確率，模型也可能利用姿勢、背景或場景；它不是測量心智專注度的正確率。

## 使用與重現

本次 CNN 訓練環境為 TensorFlow 2.21.0、scikit-learn 1.5.1、CPU，使用本機 Anaconda Python；FER+ 評估使用 ONNX Runtime 1.23.2。兩個 Python 環境不同，執行前請確認目前選用的 Python 有對應依賴。

原始資料保留在 `data/`，訓練歷程、固定分割索引與 `.keras` 權重在 `runs/`，這兩個目錄不提交到版本控制。發布權重與 manifest 在 `frontend/public/vision/prototypes/`，各 manifest 及每次遊戲報告會保留權重 SHA-256。

```powershell
# 從 IEP 專案目錄執行。需先取得 FER2013 zip；公開發布頁見上文。
python -m pip install -r ml/requirements.txt
python ml/download_engagement.py
python ml/train_prototypes.py --task engagement --epochs 12

# 取得上游官方表情模型與多人標註，再重新評估。
python ml/download_ranges.py ferplus
python ml/evaluate_ferplus.py

# 可選：重現未部署的七類小型表情 CNN 基準。
python ml/train_prototypes.py --task emotion --epochs 12
```

遊戲開始前，按「開啟偵測」，允許攝影機，再按「校準正面朝向」。準備頁提供約每秒更新的表情／參與樣態即時預覽，可先微笑確認模型反應；預覽不納入正式紀錄。影像不錄影、不上傳；只在正式遊玩累計。每秒約一次表情／參與分類取樣；低信心或無法判定時保留 uncertain。拒絕門檻只從驗證集選取，遊戲摘要的次數不當作時間比例。聆聽與作答的頭部朝向分開統計。

## 驗證

- 前後端建置、前端 ESLint、時間統計單元驗證與後端資料格式驗證。
- `node scripts/verify-games-browser.cjs --attention`（在 frontend 目錄）：兩款完整遊戲、模擬攝影機、權限拒絕／重試、校準、正式結果、停止與離頁釋放、手機版面。
- 真實 MediaPipe／WASM／分類模型載入與空白影像推論。
- 合成輸入的 Python／瀏覽器數值一致性：表情最大 softmax 誤差約 `4.83e-8`，參與 CNN 約 `5.22e-8`。這驗證部署權重與網路計算，沒有驗證真人辨識準確率。
- 2026-11-04 已完成兩款真人攝影機完整遊戲，並分別觀察到準備頁微笑由中性變為開心樣態；[真人功能測試摘要](../docs/game-camera-test-results.md) 說明取樣數、保存範圍及限制。

尚未測試目標學生、實際教室、不同鏡頭與光線、跨學生泛化或個別溝通方式。正式評量仍需設計與標註符合兩款遊戲的觀察資料，保留獨立學生作為最終測試集，並由教師／專業人員核對。
