import type { AttentionPhase, AttentionReport, PrototypeReport } from '../../../types/attention'
import { engagementLabels, expressionLabels } from './attentionLabels'
import { countsText, engagementShortLabels, expressionShortLabels } from './attentionLogic'
import './attention.css'

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
const phaseLabels: Record<AttentionPhase, string> = { listening: '聆聽詞語', answering: '記憶作答', cpt: '數字作答' }

/** Key figures first, the caveat once, and the full counts behind 詳細資料. */
export function AttentionSummary({ report }: { report?: AttentionReport }) {
  if (!report) return <p className="attention-help">本次未啟用攝影機觀察。</p>
  const coverage = report.durationMs ? (report.forwardMs + report.turnedMs) / report.durationMs : 0
  const prototypes = report.prototypes?.available && report.prototypes.sampleCount > 0 ? report.prototypes : undefined
  return <section className="attention-summary" aria-label="攝影機觀察結果">
    <h3>攝影機觀察</h3>
    {report.calibrated
      ? <dl className="attention-totals"><div><dt>面向螢幕</dt><dd>{seconds(report.forwardMs)}</dd></div><div><dt>頭部轉向</dt><dd>{seconds(report.turnedMs)}</dd></div><div><dt>無法判讀</dt><dd>{seconds(report.unknownMs)}</dd></div></dl>
      : <p>本次未完成正面校準，無法判讀頭部朝向。</p>}
    {prototypes && <>
      <h4 className="attention-subheading">表情與參與樣態 · 研究原型</h4>
      <dl className="attention-lines">
        <div><dt>表情</dt><dd>{countsText(prototypes.expressionCounts, expressionShortLabels) || '—'}</dd></div>
        <div><dt>參與樣態</dt><dd>{countsText(prototypes.engagementCounts, engagementShortLabels) || '—'}</dd></div>
      </dl>
    </>}
    {report.prototypes && !report.prototypes.available && <p className="attention-help">本次未能載入表情與參與樣態模型。</p>}
    <p className="attention-help">僅供參考：頭部朝向不等於專注，表情與參與樣態模型尚未在本系統學生中驗證；影像未錄影、未上傳。{report.phases.listening && '聆聽與回想時移開視線可能是正常行為。'}</p>
    <details className="attention-details">
      <summary>詳細資料</summary>
      <p>正式測驗 {seconds(report.durationMs)}；有效追蹤涵蓋率 {(coverage * 100).toFixed(1)}%。「無法判讀」包含遮擋、多人入鏡、切換分頁、關閉偵測或追蹤中斷。</p>
      <div className="attention-table-wrap"><table><caption>依遊戲階段記錄</caption><thead><tr><th scope="col">階段</th><th scope="col">面向螢幕</th><th scope="col">轉頭</th><th scope="col">無法判讀</th></tr></thead><tbody>
        {(Object.entries(report.phases) as [AttentionPhase, NonNullable<AttentionReport['phases'][AttentionPhase]>][]).map(([phase, row]) => <tr key={phase}><th scope="row">{phaseLabels[phase]}</th><td>{seconds(row.forwardMs)}</td><td>{seconds(row.turnedMs)}</td><td>{seconds(row.unknownMs)}</td></tr>)}
      </tbody></table></div>
      {prototypes && <PrototypeCounts report={prototypes} />}
    </details>
  </section>
}

function PrototypeCounts({ report }: { report: PrototypeReport }) {
  return <>
    <p>表情與參與樣態共 {report.sampleCount} 次取樣（約每秒一次），以下為所有分類次數。模型使用公開資料訓練，分類不確定時保留「不確定」。</p>
    <dl className="prototype-counts">{(Object.entries(report.expressionCounts) as [keyof typeof expressionLabels, number][]).map(([label, count]) => <div key={label}><dt>{expressionLabels[label]}</dt><dd>{count} 次</dd></div>)}</dl>
    <dl className="prototype-counts">{(Object.entries(report.engagementCounts) as [keyof typeof engagementLabels, number][]).map(([label, count]) => <div key={label}><dt>{engagementLabels[label]}</dt><dd>{count} 次</dd></div>)}</dl>
  </>
}
