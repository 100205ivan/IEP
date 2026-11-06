import type { FaceBox, PrototypePrediction } from '../../../types/attention'
import type { AttentionTracker } from './useAttentionTracker'
import { expressionLabels } from './attentionLabels'
import { expressionShortLabels } from './attentionLogic'
import './attention.css'

const observationLabels = { forward: '面向螢幕', turned: '頭部轉向', unknown: '暫時無法追蹤' } as const

/** Outlines each detected face on the mirrored preview; with one face, its
 * current expression class sits on the outline. */
function FaceOverlay({ boxes, prediction }: { boxes: FaceBox[]; prediction: PrototypePrediction | null }) {
  return <div className="attention-faces" aria-hidden="true">
    {boxes.map((box, index) => <div key={index} className="attention-face" style={{ left: `${(1 - box.x - box.width) * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}>
      {boxes.length === 1 && prediction && <span className={`attention-face-label${box.y < .12 ? ' attention-face-label--inside' : ''}`}>{expressionShortLabels[prediction.emotion.label]}</span>}
    </div>)}
  </div>
}

export function AttentionPanel({ tracker, playing, finished = false }: { tracker: AttentionTracker; playing: boolean; recording?: boolean; finished?: boolean }) {
  const { videoRef, status, prototypeStatus, message, observation, previewPrediction, faceBoxes, start, stop, calibrate } = tracker
  const on = !['off', 'error'].includes(status)
  const setup = !playing
  const videoHidden = !on || (setup && status === 'calibrated')
  // During practice and the test only the camera picture stays, beside the
  // game, so the teacher can watch the child; without a camera nothing shows.
  // One element tree throughout, so the <video> holding the stream is kept.
  return <aside className={playing ? 'attention-monitor' : 'attention-panel'} aria-label={playing ? '測驗監看' : '攝影機觀察設定'} hidden={finished || (playing && !on)}>
    {setup && <div className="attention-panel-heading">
      <h2>攝影機觀察 <span>選用</span></h2>
      {on ? <button type="button" className="attention-control" onClick={stop}>關閉偵測</button>
        : <button type="button" className="attention-control" onClick={() => void start()}>{status === 'error' ? '重試開啟偵測' : '開啟偵測'}</button>}
    </div>}
    <div className="attention-camera">
      <video className="attention-preview" ref={videoRef} autoPlay muted playsInline hidden={videoHidden} aria-label="攝影機畫面" />
      {!videoHidden && <FaceOverlay boxes={faceBoxes} prediction={previewPrediction} />}
    </div>
    {setup && <p role="status">{message || '開啟並校準後，可記錄面向螢幕與轉頭的時間。'}</p>}
    {setup && on && status !== 'loading' && <button type="button" className="attention-control" onClick={calibrate} disabled={status === 'calibrating'}>{status === 'calibrating' ? '校準中…' : '校準正面朝向'}</button>}
    {setup && status === 'calibrated' && <p>預覽：{observationLabels[observation]}</p>}
    {setup && on && <p className="attention-help">表情研究原型：{prototypeStatus === 'ready' ? '已載入；可先查看即時分類，正式統計會在遊戲完成後顯示。' : prototypeStatus === 'loading' ? '載入中…' : '暫時無法載入，仍可使用頭部追蹤。'}</p>}
    {setup && on && prototypeStatus === 'ready' && <div className="attention-model-preview" aria-label="模型即時預覽">
      <p><strong>模型即時預覽</strong><br />表情：{previewPrediction ? expressionLabels[previewPrediction.emotion.label] : '等待有效畫面'}</p>
      <p className="attention-help">準備階段僅供預覽，不納入測驗紀錄。分類約每秒更新，請先面向鏡頭，再試著微笑。</p>
    </div>}
    {setup && <p className="attention-help">影像在此裝置處理，不錄影、不上傳。測驗中鏡頭畫面會顯示在畫面旁供老師監看。表情與頭部朝向供研究觀察，不代表內心情緒或專注度分數；不開啟也能玩。</p>}
  </aside>
}
