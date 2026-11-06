import type { MonkeyResults } from '../../../types/gameAssessment'
import { CPT_LEVEL_LABELS } from '../cpt/cptNorms'
import { gradeLabel, longestSpan, MONKEY_NORM_SAMPLE, MONKEY_NORM_SOURCE, MONKEY_STANDARD_TEXT, type MonkeyEvaluation } from './monkeyNorms'
import '../cpt/cpt-norm-report.css'

const RANGE = 3
const position = (z: number) => `${(Math.max(-RANGE, Math.min(RANGE, z)) + RANGE) / (2 * RANGE) * 100}%`
const sentences = {
  better: '工作記憶高於同年級平均，能把較長的詞語串記住並倒過來說出。',
  typical: '工作記憶落在同年級孩子的一般範圍內。',
  watch: '工作記憶略低於同年級平均，較長的詞語串容易遺漏或順序錯誤。',
  concern: '工作記憶明顯低於同年級平均，建議搭配課堂觀察與其他評量確認。',
  reference: '',
} as const

/** The Monkey result against same-grade norms, laid out like the CPT report:
 * the verdict first, a position bar, then how each Level went. */
export function MonkeyNormReport({ results, evaluation }: { results: MonkeyResults; evaluation: MonkeyEvaluation }) {
  const span = longestSpan(results)
  return <section className="cpt-report" aria-label={`與${gradeLabel(evaluation.grade)}比較`}>
    <h3>與{gradeLabel(evaluation.grade)}孩子比較</h3>
    <div className="cpt-report-overview">
      <div className="cpt-report-tile cpt-report-tile--typical"><strong>{evaluation.value}</strong><span>工作記憶總分</span></div>
      <div className="cpt-report-tile cpt-report-tile--better"><strong>{span || '—'}</strong><span>最長完整倒序詞數</span></div>
      <div className={`cpt-report-tile ${evaluation.level === 'watch' || evaluation.level === 'concern' ? 'cpt-report-tile--flagged' : 'cpt-report-tile--typical'}`}><strong className="cpt-report-tile-word">{CPT_LEVEL_LABELS[evaluation.level]}</strong><span>與同年級相比</span></div>
    </div>
    <p className="cpt-report-sentence">{sentences[evaluation.level]}</p>
    <p className="cpt-report-how"><span className="cpt-report-how-band" aria-hidden="true" />灰色區域是同年級孩子的一般範圍，<span className="cpt-report-how-dot" aria-hidden="true" />圓點是本次結果；<strong>圓點越靠右表現越好</strong>。</p>
    <div className="cpt-report-group">
      <h4>工作記憶<small>聽完一串詞語後，能不能記在腦中並倒過來點出來？</small></h4>
      <div className="cpt-report-row">
        <div className="cpt-report-name"><strong>工作記憶總分</strong><small>20 題各題答對比例的平均（共答對 {results.correctPositions} / {results.totalPositions} 個位置），越高越好</small></div>
        <div className="cpt-report-value">{evaluation.value}</div>
        <div className="cpt-report-bar" role="img" aria-label={`工作記憶總分：${CPT_LEVEL_LABELS[evaluation.level]}`}><span className="cpt-report-band" /><span className={`cpt-report-dot cpt-report-dot--${evaluation.level}`} style={{ left: position(evaluation.z) }} /></div>
        <span className={`cpt-report-level cpt-report-level--${evaluation.level}`}>{CPT_LEVEL_LABELS[evaluation.level]}</span>
      </div>
    </div>
    <div className="cpt-report-group">
      <h4>各 Level 表現<small>詞語越多越難；看看在幾個詞時開始出錯（研究未提供各 Level 的同年級資料）</small></h4>
      {results.levelScores.map((score, index) => <div className="cpt-report-row monkey-level-row" key={index}>
        <div className="cpt-report-name"><strong>Level {index + 1}</strong><small>{index + 2} 個詞，共 4 題</small></div>
        <div className="cpt-report-value">{Math.round(score * 100)}%</div>
        <div className="cpt-report-bar monkey-level-bar"><span className="monkey-level-fill" style={{ width: `${Math.round(score * 100)}%` }} /></div>
        <span className="cpt-report-level cpt-report-level--reference">答對比例</span>
      </div>)}
    </div>
    <details className="cpt-report-details">
      <summary>詳細數據（同年級平均、標準差與 Z 分數）</summary>
      <p>Z 分數代表與同年級平均相差幾個標準差（SD）：0 表示剛好等於平均，±1 以內屬於一般範圍。</p>
      <div className="cpt-norm-table-wrap"><table className="cpt-norm-table">
        <thead><tr><th scope="col">指標</th><th scope="col">本次結果</th><th scope="col">同年級平均（SD）</th><th scope="col">Z 分數</th><th scope="col">判讀</th></tr></thead>
        <tbody><tr><th scope="row">工作記憶總分</th><td>{evaluation.value}</td><td>{evaluation.reference}</td><td>{evaluation.z.toFixed(2)}</td><td>{CPT_LEVEL_LABELS[evaluation.level]}</td></tr>
          <tr><th scope="row">答對位置</th><td>{results.correctPositions} / {results.totalPositions}</td><td>—</td><td>—</td><td>僅供對照</td></tr></tbody>
      </table></div>
    </details>
    <p className="cpt-report-source">判讀標準：{MONKEY_STANDARD_TEXT}<br />常模來源：{MONKEY_NORM_SOURCE}<br />樣本：{MONKEY_NORM_SAMPLE}。結果僅供教學與研究參考，不作任何診斷用途。</p>
  </section>
}
