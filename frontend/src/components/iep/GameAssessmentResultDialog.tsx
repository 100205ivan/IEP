import { useEffect, useRef } from 'react'
import type { CptResults, MonkeyResults, StoredGameAssessmentResult } from '../../types/gameAssessment'

export function GameAssessmentResultDialog({ result, onClose }: { result: StoredGameAssessmentResult; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, [])
  return <dialog className="assessment-record-dialog" ref={ref} onCancel={event => { event.preventDefault(); onClose() }}><header><h2>{result.gameType === 'monkey' ? 'Monkey 遊戲評量結果' : 'CPT 遊戲評量結果'}</h2><button className="text-button" type="button" onClick={onClose}>關閉</button></header><div className="assessment-record-dialog-body"><p>評量日期：{result.assessmentDate}</p><p>完成時間：{new Date(result.completedAt).toLocaleString('zh-TW')}</p><p>評量摘要：{result.summary}</p>{result.gameType === 'monkey' ? <MonkeyDetail result={result.result as MonkeyResults} /> : <CptDetail result={result.result as CptResults} />}</div></dialog>
}

function MonkeyDetail({ result }: { result: MonkeyResults }) {
  return <><h3>完整工作記憶結果</h3><p>總分：{Math.round(result.totalScore * 100)}%（{result.correctPositions}／{result.totalPositions} 個位置）</p><p>各 Level：{result.levelScores.map((score, index) => `Level ${index + 1} ${Math.round(score * 100)}%`).join('、')}</p><details><summary>查看每題結果（{result.questionResults.length} 題）</summary><ol>{result.questionResults.map(question => <li key={question.id}>Level {question.level}：答對 {question.correctPositions}／{question.totalPositions} 個位置</li>)}</ol></details></>
}

function CptDetail({ result }: { result: CptResults }) {
  const metrics = result.metrics
  return <><h3>完整持續注意力結果</h3><p>Hit：{Math.round(metrics.hitRate * 100)}%；Omission：{metrics.omissionCount}；Commission：{metrics.commissionCount}</p><p>RT：{Math.round(metrics.meanReactionTime)} ms；RTV：{Math.round(metrics.reactionTimeSD)} ms</p><p>測驗時間：{Math.round(result.durationMs / 1000)} 秒</p><details><summary>查看每題結果（{result.trials.length} 題）</summary><ol>{result.trials.map(trial => <li key={trial.trialIndex}>第 {trial.trialIndex} 題：{trial.isTarget ? '目標刺激' : '非目標刺激'}；{trial.hit ? 'Hit' : trial.omission ? 'Omission' : trial.commission ? 'Commission' : '正確未反應'}{trial.reactionTime === null ? '' : `；RT ${Math.round(trial.reactionTime)} ms`}</li>)}</ol></details></>
}
