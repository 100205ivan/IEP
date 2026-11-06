import { CPT_GROUPS, CPT_LEVEL_LABELS, CPT_NORM_SAMPLE, CPT_NORM_SOURCE, CPT_STANDARD_TEXT, type CptEvaluationRow, type CptGroup } from './cptNorms'
import './cpt-norm-report.css'

/** The bar shows −3 to +3 SD with the favourable side on the right. */
const RANGE = 3
const position = (score: number) => `${(Math.max(-RANGE, Math.min(RANGE, score)) + RANGE) / (2 * RANGE) * 100}%`

function overview(rows: CptEvaluationRow[]) {
  const count = (...levels: CptEvaluationRow['level'][]) => rows.filter(row => levels.includes(row.level)).length
  const flagged = rows.filter(row => row.level === 'watch' || row.level === 'concern')
  const groups = [...new Set(flagged.map(row => CPT_GROUPS[row.group].title))]
  const sentence = flagged.length === 0
    ? '各項指標都落在同齡孩子的一般範圍內，本次專注力與衝動控制表現穩定。'
    : `${groups.join('、')}有指標偏離同齡平均，建議搭配課堂觀察再確認。`
  return { typical: count('typical'), better: count('better'), flagged: flagged.length, sentence }
}

/** The CPT result against same-age norms, written for readers new to CPT:
 * a summary first, then each ability with a position bar, the numbers last. */
export function CptNormReport({ rows, age }: { rows: CptEvaluationRow[]; age: number }) {
  const summary = overview(rows)
  return <section className="cpt-report" aria-label={`與 ${age} 歲同齡常模比較`}>
    <h3>與 {age} 歲同齡孩子比較</h3>
    <div className="cpt-report-overview">
      <div className="cpt-report-tile cpt-report-tile--typical"><strong>{summary.typical}</strong><span>項在一般範圍</span></div>
      <div className="cpt-report-tile cpt-report-tile--better"><strong>{summary.better}</strong><span>項優於同齡</span></div>
      <div className="cpt-report-tile cpt-report-tile--flagged"><strong>{summary.flagged}</strong><span>項需要留意</span></div>
    </div>
    <p className="cpt-report-sentence">{summary.sentence}</p>
    <p className="cpt-report-how"><span className="cpt-report-how-band" aria-hidden="true" />灰色區域是同齡孩子的一般範圍，<span className="cpt-report-how-dot" aria-hidden="true" />圓點是本次結果；<strong>圓點越靠右表現越好</strong>。</p>
    {(Object.keys(CPT_GROUPS) as CptGroup[]).map(group => {
      const groupRows = rows.filter(row => row.group === group)
      if (!groupRows.length) return null
      return <div className="cpt-report-group" key={group}>
        <h4>{CPT_GROUPS[group].title}<small>{CPT_GROUPS[group].question}</small></h4>
        {groupRows.map(row => <div className="cpt-report-row" key={row.key}>
          <div className="cpt-report-name"><strong>{row.label}</strong><small>{row.meaning}</small></div>
          <div className="cpt-report-value">{row.value}</div>
          {row.score === null
            ? <div className="cpt-report-bar cpt-report-bar--none">研究資料無法比較，僅列出數值</div>
            : <div className="cpt-report-bar" role="img" aria-label={`${row.label}：${CPT_LEVEL_LABELS[row.level]}`}>
              <span className="cpt-report-band" /><span className={`cpt-report-dot cpt-report-dot--${row.level}`} style={{ left: position(row.score) }} />
            </div>}
          <span className={`cpt-report-level cpt-report-level--${row.level}`}>{CPT_LEVEL_LABELS[row.level]}</span>
        </div>)}
      </div>
    })}
    <details className="cpt-report-details">
      <summary>詳細數據（同齡平均、標準差與 Z 分數）</summary>
      <p>Z 分數代表與同齡平均相差幾個標準差（SD）：0 表示剛好等於平均，±1 以內屬於一般範圍。</p>
      <div className="cpt-norm-table-wrap"><table className="cpt-norm-table">
        <thead><tr><th scope="col">指標</th><th scope="col">本次結果</th><th scope="col">同齡平均（SD）</th><th scope="col">Z 分數</th><th scope="col">判讀</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.value}</td><td>{row.reference}</td><td>{row.z === null ? '—' : row.z.toFixed(2)}</td><td>{CPT_LEVEL_LABELS[row.level]}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="cpt-report-source">判讀標準：{CPT_STANDARD_TEXT}<br />常模來源：{CPT_NORM_SOURCE}<br />樣本：{CPT_NORM_SAMPLE}。結果僅供教學與研究參考，不作任何診斷用途。</p>
  </section>
}
