import type { AttentionTracker } from './useAttentionTracker'
import { engagementLabels, expressionLabels } from './attentionLabels'
import './attention.css'

export function AttentionPanel({ tracker, playing, recording = false, finished = false }: { tracker: AttentionTracker; playing: boolean; recording?: boolean; finished?: boolean }) {
  const { videoRef, status, prototypeStatus, message, observation, previewPrediction, start, stop, calibrate } = tracker
  const on = !['off', 'error'].includes(status)
  return <aside className={`attention-panel${playing ? ' attention-panel--playing' : ''}`} aria-label="攝影機觀察設定" hidden={finished}>
    <div className="attention-panel-heading"><h2>攝影機觀察 <span>選用</span></h2>
      {on ? <button type="button" className="attention-control" onClick={stop}>關閉偵測</button>
        : !playing && <button type="button" className="attention-control" onClick={() => void start()}>{status === 'error' ? '重試開啟偵測' : '開啟偵測'}</button>}
    </div>
    <video className="attention-preview" ref={videoRef} autoPlay muted playsInline hidden={!on || playing || status === 'calibrated'} aria-label="攝影機預覽" />
    <p role="status">{playing ? (!on ? '偵測未開啟，可繼續完成遊戲。' : status !== 'calibrated' ? '尚未完成校準；正式測驗期間將記為資料不足。' : recording ? '正在背景記錄頭部朝向。' : '校準已完成；正式測驗開始後才會記錄。') : message || '開啟並校準後，可記錄面向螢幕與轉頭的時間。'}</p>
    {!playing && on && status !== 'loading' && <button type="button" className="attention-control" onClick={calibrate} disabled={status === 'calibrating'}>{status === 'calibrating' ? '校準中…' : '校準正面朝向'}</button>}
    {!playing && status === 'calibrated' && <p>預覽：{observation === 'forward' ? '面向螢幕' : observation === 'turned' ? '頭部轉向' : '暫時無法追蹤'}</p>}
    {!playing && on && <p className="attention-help">表情／參與樣態研究原型：{prototypeStatus === 'ready' ? '已載入；可先查看即時分類，正式統計會在遊戲完成後顯示。' : prototypeStatus === 'loading' ? '載入中…' : '暫時無法載入，仍可使用頭部追蹤。'}</p>}
    {!playing && on && prototypeStatus === 'ready' && <div className="attention-model-preview" aria-label="模型即時預覽">
      <p><strong>模型即時預覽</strong><br />表情：{previewPrediction ? expressionLabels[previewPrediction.emotion.label] : '等待有效畫面'}<br />參與樣態：{previewPrediction ? engagementLabels[previewPrediction.engagement.label] : '等待有效畫面'}</p>
      <p className="attention-help">準備階段僅供預覽，不納入測驗紀錄。分類約每秒更新，請先面向鏡頭，再試著微笑。</p>
    </div>}
    {!playing && <p className="attention-help">影像在此裝置處理，不錄影、不上傳。表情、參與樣態與頭部朝向供研究觀察，不代表內心情緒或專注度分數；不開啟也能玩。</p>}
  </aside>
}
