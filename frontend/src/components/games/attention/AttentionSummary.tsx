import type { AttentionPhase, AttentionReport, PrototypeReport } from '../../../types/attention'
import { engagementLabels, expressionLabels } from './attentionLabels'
import './attention.css'

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
const phaseLabels: Record<AttentionPhase, string> = { listening: '聆聽詞語', answering: '記憶作答', cpt: '數字作答' }
export function AttentionSummary({ report }: { report?: AttentionReport }) {
  if (!report) return <p className="attention-help">本次未啟用攝影機觀察。</p>
  const coverage = report.durationMs ? (report.forwardMs + report.turnedMs) / report.durationMs : 0
  return <section className="attention-summary" aria-label="攝影機觀察結果">
    <h3>攝影機觀察結果</h3>
    <p>有效追蹤涵蓋率：{(coverage * 100).toFixed(1)}%（正式測驗 {seconds(report.durationMs)}）</p>
    {!report.calibrated && <p>本次未完成正面校準，無法判定頭部朝向。</p>}
    <dl className="attention-totals"><div><dt>面向螢幕</dt><dd>{seconds(report.forwardMs)}</dd></div><div><dt>頭部轉向</dt><dd>{seconds(report.turnedMs)}</dd></div><div><dt>資料不足</dt><dd>{seconds(report.unknownMs)}</dd></div></dl>
    <div className="attention-table-wrap"><table><caption>依遊戲階段記錄</caption><thead><tr><th scope="col">階段</th><th scope="col">面向螢幕</th><th scope="col">轉頭</th><th scope="col">資料不足</th></tr></thead><tbody>
      {(Object.entries(report.phases) as [AttentionPhase, NonNullable<AttentionReport['phases'][AttentionPhase]>][]).map(([phase, row]) => <tr key={phase}><th scope="row">{phaseLabels[phase]}</th><td>{seconds(row.forwardMs)}</td><td>{seconds(row.turnedMs)}</td><td>{seconds(row.unknownMs)}</td></tr>)}
    </tbody></table></div>
    <p className="attention-help">這是頭部朝向觀察，不是眼動追蹤或專注度分數。遮擋、多人入鏡、切換分頁、關閉偵測或追蹤中斷均可能造成資料不足。{report.phases.listening && '聆聽與回想時移開視線可能是正常行為，請搭配作答與教師觀察解讀。'}</p>
    {report.prototypes && <PrototypeSummary report={report.prototypes} />}
  </section>
}

function PrototypeSummary({ report }: { report: PrototypeReport }) {
  if (!report.available) return <p className="attention-help">本次未能載入表情與參與樣態模型，沒有模型分類紀錄。</p>
  return <div className="prototype-summary">
    <h3>表情與參與樣態 · 研究原型</h3>
    <p>正式測驗共 {report.sampleCount} 次取樣。以下為模型對影像的分類次數。</p>
    <details><summary>查看表情分類</summary><dl className="prototype-counts">{(Object.entries(report.expressionCounts) as [keyof typeof expressionLabels, number][]).map(([label, count]) => <div key={label}><dt>{expressionLabels[label]}</dt><dd>{count} 次</dd></div>)}</dl></details>
    <dl className="prototype-counts">{(Object.entries(report.engagementCounts) as [keyof typeof engagementLabels, number][]).map(([label, count]) => <div key={label}><dt>{engagementLabels[label]}</dt><dd>{count} 次</dd></div>)}</dl>
    <p className="attention-help">模型使用公開資料訓練，尚未在本系統學生中驗證。分類不確定時保留「不確定」，不將表情或影像參與樣態換算為學生真實情緒、專注程度或 IEP 評分。</p>
  </div>
}
