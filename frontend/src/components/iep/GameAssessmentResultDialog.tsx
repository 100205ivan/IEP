import { useEffect, useRef } from 'react'
import type { AssessmentRecord } from '../../types/assessmentRecord'
import type { AttentionReport } from '../../types/attention'
import type { CptResults, MonkeyResults, StoredGameAssessmentResult } from '../../types/gameAssessment'
import { expressionLabels } from '../games/attention/attentionLabels'
import { evaluateCpt } from '../games/cpt/cptNorms'
import { CptNormReport } from '../games/cpt/CptNormReport'
import { evaluateMonkey, gradeLabel } from '../games/monkey/monkeyNorms'
import { MonkeyNormReport } from '../games/monkey/MonkeyNormReport'

const gameNames = { monkey: 'Monkey 工作記憶遊戲', cpt: '數字注意力挑戰（CPT）' } as const
const sourceLabels = { monkey: 'Monkey', cpt: 'CPT' } as const
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
/** The game comment (AI or rule-based) saved in the summary as 「評語：…」, up to the camera note. */
const commentFrom = (summary: string) => /評語：([\s\S]+?)(?:\s*攝影機觀察（|$)/.exec(summary)?.[1].trim() ?? ''

/** 評量紀錄 for a game: record details, then the game result, then every
 * camera label with its count. `record` adds the saved record's own wording. */
export function GameAssessmentResultDialog({ result, record, onClose }: { result: StoredGameAssessmentResult; record?: AssessmentRecord; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, [])
  const type = record ? (record.assessmentType === '其他' ? record.otherAssessmentType : record.assessmentType) : result.gameType === 'monkey' ? '工作記憶遊戲評量' : '注意力遊戲評量'
  const comment = commentFrom(result.summary || record?.summary || '')
  return <dialog className="assessment-record-dialog game-record-dialog" ref={ref} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2>評量紀錄</h2><button className="text-button" type="button" onClick={onClose}>關閉</button></header>
    <div className="game-record-scroll">
      <dl className="assessment-record-view">
        <div><dt>評量日期</dt><dd>{record?.assessmentDate ?? result.assessmentDate}</dd></div>
        <div><dt>評量類型</dt><dd>{type}</dd></div>
        <div><dt>評量工具／方式</dt><dd>{record?.assessmentTool || gameNames[result.gameType]}</dd></div>
        <div><dt>評量者</dt><dd>{record?.evaluator || 'EyeEP 遊戲評量'}</dd></div>
        <div><dt>資料來源</dt><dd>{sourceLabels[result.gameType]}</dd></div>
      </dl>
      <section className="game-record-section" aria-labelledby="game-record-result">
        <h3 id="game-record-result">遊戲測驗結果</h3>
        <p>完成時間：{new Date(result.completedAt).toLocaleString('zh-TW')}；{result.gameType === 'monkey' && (result.result as MonkeyResults).grade ? `受測年級：${gradeLabel((result.result as MonkeyResults).grade!)}` : `測驗年齡：${result.age} 歲`}</p>
        {result.gameType === 'monkey' ? <MonkeyDetail result={result.result as MonkeyResults} /> : <CptDetail result={result.result as CptResults} age={result.age} />}
      </section>
      {comment && <section className="game-record-section" aria-labelledby="game-record-comment">
        <h3 id="game-record-comment">評語</h3>
        <p className="game-record-comment">{comment}</p>
      </section>}
      <section className="game-record-section" aria-labelledby="game-record-camera">
        <h3 id="game-record-camera">鏡頭偵測結果</h3>
        <CameraCounts report={result.result.attention} />
      </section>
    </div>
  </dialog>
}

function MonkeyDetail({ result }: { result: MonkeyResults }) {
  // Results saved since the grade-based norms carry the grade.
  const evaluation = result.grade ? evaluateMonkey(result, result.grade) : null
  if (evaluation) return <>
    <MonkeyNormReport results={result} evaluation={evaluation} />
    <details><summary>查看每題結果（{result.questionResults.length} 題）</summary><ol>{result.questionResults.map(question => <li key={question.id}>Level {question.level}：聽到 {question.sequence.join('、')}；作答 {question.playerAnswer.join('、') || '—'}；答對 {question.correctPositions}／{question.totalPositions} 個位置</li>)}</ol></details>
  </>
  return <>
    <dl className="game-record-counts">
      <div><dt>總分</dt><dd>{Math.round(result.totalScore * 100)}%（{result.correctPositions}／{result.totalPositions} 個位置）</dd></div>
      {result.levelScores.map((score, index) => <div key={index}><dt>Level {index + 1}</dt><dd>{Math.round(score * 100)}%</dd></div>)}
    </dl>
    <details><summary>查看每題結果（{result.questionResults.length} 題）</summary><ol>{result.questionResults.map(question => <li key={question.id}>Level {question.level}：答對 {question.correctPositions}／{question.totalPositions} 個位置</li>)}</ol></details>
  </>
}

function CptDetail({ result, age }: { result: CptResults; age: number }) {
  const metrics = result.metrics
  // Results saved since the Kanaka et al. (2008) rules carry d′ and the other parameters.
  if (metrics.dPrime !== undefined) return <>
    <p>測驗時間：{Math.floor(result.durationMs / 60000)} 分 {Math.round((result.durationMs % 60000) / 1000)} 秒；共 {result.trials.length} 題</p>
    <CptNormReport rows={evaluateCpt(metrics, age)} age={age} />
    <TrialList result={result} />
  </>
  return <>
    <dl className="game-record-counts">
      <div><dt>命中率（Hit）</dt><dd>{Math.round(metrics.hitRate * 100)}%</dd></div>
      <div><dt>漏答（Omission）</dt><dd>{metrics.omissionCount} 次</dd></div>
      <div><dt>誤按（Commission）</dt><dd>{metrics.commissionCount} 次</dd></div>
      <div><dt>平均反應時間（RT）</dt><dd>{Math.round(metrics.meanReactionTime)} ms</dd></div>
      <div><dt>反應時間變異（RTV）</dt><dd>{Math.round(metrics.reactionTimeSD)} ms</dd></div>
      <div><dt>測驗時間</dt><dd>{Math.round(result.durationMs / 1000)} 秒</dd></div>
    </dl>
    <TrialList result={result} />
  </>
}

function TrialList({ result }: { result: CptResults }) {
  return <details><summary>查看每題結果（{result.trials.length} 題）</summary><ol>{result.trials.map(trial => <li key={trial.trialIndex}>第 {trial.trialIndex} 題：{trial.isTarget ? '目標刺激' : '非目標刺激'}；{trial.anticipatory ? '預期反應（150 ms 內）' : trial.hit ? 'Hit' : trial.omission ? 'Omission' : trial.commission ? 'Commission' : '正確未反應'}{trial.reactionTime === null ? '' : `；RT ${Math.round(trial.reactionTime)} ms`}</li>)}</ol></details>
}

/** Every head-orientation and expression label with its count,
 * zeros included, so the record shows the complete camera tally. */
function CameraCounts({ report }: { report?: AttentionReport }) {
  if (!report) return <p>本次未啟用攝影機偵測。</p>
  const prototypes = report.prototypes
  return <>
    <h4>頭部朝向（正式測驗 {seconds(report.durationMs)}）</h4>
    {report.calibrated
      ? <dl className="game-record-counts"><div><dt>面向螢幕</dt><dd>{seconds(report.forwardMs)}</dd></div><div><dt>頭部轉向</dt><dd>{seconds(report.turnedMs)}</dd></div><div><dt>無法判讀</dt><dd>{seconds(report.unknownMs)}</dd></div></dl>
      : <p>本次未完成正面校準，無法判讀頭部朝向。</p>}
    {prototypes?.available
      ? <>
        <h4>表情（共 {prototypes.sampleCount} 次取樣）</h4>
        <dl className="game-record-counts">{(Object.keys(expressionLabels) as (keyof typeof expressionLabels)[]).map(label => <div key={label}><dt>{expressionLabels[label]}</dt><dd>{prototypes.expressionCounts[label]} 次</dd></div>)}</dl>
      </>
      : <p>本次未能載入表情模型。</p>}
    <p className="game-record-note">僅供參考：頭部朝向不等於專注，表情是模型分類，不代表內心情緒。</p>
  </>
}
