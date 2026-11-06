import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AssessmentScope } from '../../context/assessmentRecordsStore'
import { AssessmentReferencesContext, useAssessmentReferences } from '../../context/assessmentReferencesContext'
import { getDocumentAnalysis, getGameAssessmentResult, listPersistedAssessments } from '../../services/assessmentRecordsApi'
import type { AssessmentRecord } from '../../types/assessmentRecord'
import { ABILITY_DOMAIN_LABELS, type AbilityDomain, type StoredDocumentAnalysis } from '../../types/assessmentAnalysis'
import type { StoredGameAssessmentResult } from '../../types/gameAssessment'
import { DocumentAnalysisResultDialog } from './DocumentAnalysisResultDialog'
import { GameAssessmentResultDialog } from './GameAssessmentResultDialog'

type ReferenceProviderProps = { scope: AssessmentScope; scopeActive: boolean; isCurrentScope: (scope: AssessmentScope) => boolean; children: ReactNode }

export function AssessmentReferenceProvider(props: ReferenceProviderProps) {
  const { scope, scopeActive } = props
  // A different student/IEP gets fresh state before any previous references can render.
  return <ScopedAssessmentReferences key={`${scope.studentId}:${scope.iepId}:${scopeActive}`} {...props} />
}

function ScopedAssessmentReferences({ scope, scopeActive, isCurrentScope, children }: ReferenceProviderProps) {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [documents, setDocuments] = useState<StoredDocumentAnalysis[]>([])
  const [games, setGames] = useState<StoredGameAssessmentResult[]>([])
  const [loading, setLoading] = useState(Boolean(scope.iepId && scopeActive))
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const retry = useCallback(() => {
    setRecords([]); setDocuments([]); setGames([]); setError('')
    setLoading(Boolean(scope.iepId && scopeActive))
    setRetryKey(value => value + 1)
  }, [scope.iepId, scopeActive])

  useEffect(() => {
    let active = true
    const iepId = scope.iepId
    if (!iepId || !scopeActive) return () => { active = false }
    listPersistedAssessments(iepId).then(async nextRecords => {
      if (!active || !isCurrentScope(scope)) return
      setRecords(nextRecords)
      const documentResults = await Promise.allSettled(nextRecords.filter(record => record.source === 'document').map(record => getDocumentAnalysis(record.id, iepId)))
      const gameResults = await Promise.allSettled(nextRecords.filter(record => record.source === 'monkey' || record.source === 'cpt').map(record => getGameAssessmentResult(record.id, iepId)))
      if (!active || !isCurrentScope(scope)) return
      setDocuments(documentResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))
      setGames(gameResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))
      if (documentResults.some(result => result.status === 'rejected') || gameResults.some(result => result.status === 'rejected')) setError('部分評量詳情載入失敗；可按「重試」或使用評量紀錄中的「查看」。')
    }).catch((reason: unknown) => {
      if (active && isCurrentScope(scope)) setError(reason instanceof Error ? reason.message : '無法載入相關評量資料。')
    }).finally(() => { if (active && isCurrentScope(scope)) setLoading(false) })
    return () => { active = false }
  }, [isCurrentScope, retryKey, scope, scopeActive])

  const value = useMemo(() => ({ records, documents, games, loading, error, retry }), [documents, error, games, loading, records, retry])
  return <AssessmentReferencesContext.Provider value={value}>{children}</AssessmentReferencesContext.Provider>
}

const documentDomainMap: Record<AbilityDomain, AbilityDomain> = {
  sensory: 'sensory', perceptualMotor: 'perceptualMotor', selfCare: 'selfCare', cognitive: 'cognitive', communication: 'communication', socialEmotional: 'socialEmotional', academicLearning: 'academicLearning',
}

export function AssessmentReferencePanel({ domain }: { domain: AbilityDomain }) {
  const { records, documents, games, loading, error, retry } = useAssessmentReferences()
  const [documentToView, setDocumentToView] = useState<StoredDocumentAnalysis | null>(null)
  const [gameToView, setGameToView] = useState<StoredGameAssessmentResult | null>(null)
  const domainDocuments = documents.filter(document => document.domains[documentDomainMap[domain]]?.hasEvidence)
  const domainGames = domain === 'cognitive' ? games : []
  const hasReferences = domainDocuments.length > 0 || domainGames.length > 0
  return <section className="assessment-reference" aria-label={`${ABILITY_DOMAIN_LABELS[domain]}相關評量資料`}>
    <h5>相關評量資料</h5>
    {loading && <p className="assessment-reference-muted">正在載入已儲存的評量資料…</p>}
    {error && <p className="assessment-reference-error" role="alert">{error} <button type="button" className="text-button" onClick={retry}>重試</button></p>}
    {!loading && !hasReferences && <p className="assessment-reference-muted">目前沒有此向度的文件分析或遊戲評量資料。</p>}
    {domainDocuments.map(document => {
      const analysis = document.domains[documentDomainMap[domain]]
      return <article className="assessment-reference-item" key={document.assessmentRecordId}><div><strong>評估文件</strong><span>{document.documentInfo.assessmentDate ?? '日期未提供'}・{document.documentInfo.assessmentTools.join('、') || '工具未提供'}・{document.documentInfo.evaluator ?? '評量者未提供'}</span></div>{analysis.summary && <p>{analysis.summary}</p>}<ul>{analysis.evidence.map(evidence => <li key={evidence.id}>{evidence.content}</li>)}</ul><button type="button" className="text-button" onClick={() => setDocumentToView(document)}>查看完整文件分析</button></article>
    })}
    {domainGames.map(game => <GameReferenceItem key={game.assessmentRecordId} game={game} onView={() => setGameToView(game)} />)}
    {documentToView && <DocumentAnalysisResultDialog analysis={documentToView} onClose={() => setDocumentToView(null)} />}
    {gameToView && <GameAssessmentResultDialog result={gameToView} record={records.find(record => record.id === gameToView.assessmentRecordId)} onClose={() => setGameToView(null)} />}
  </section>
}

function GameReferenceItem({ game, onView }: { game: StoredGameAssessmentResult; onView: () => void }) {
  if (game.gameType === 'monkey') {
    const result = game.result as Extract<StoredGameAssessmentResult['result'], { totalScore: number }>
    return <article className="assessment-reference-item"><div><strong>Monkey 工作記憶</strong><span>{game.assessmentDate}</span></div><p>總分 {Math.round(result.totalScore * 100)}%（{result.correctPositions}／{result.totalPositions} 個位置）</p><button type="button" className="text-button" onClick={onView}>查看完整 Monkey 結果</button></article>
  }
  const result = game.result as Extract<StoredGameAssessmentResult['result'], { metrics: { hitRate: number } }>
  return <article className="assessment-reference-item"><div><strong>CPT 持續注意力</strong><span>{game.assessmentDate}</span></div><p>Hit {Math.round(result.metrics.hitRate * 100)}%・漏答 {result.metrics.omissionCount} 次・誤按 {result.metrics.commissionCount} 次・平均反應 {Math.round(result.metrics.meanReactionTime)} ms</p><button type="button" className="text-button" onClick={onView}>查看完整 CPT 結果</button></article>
}

export function OtherManualAssessmentReferences() {
  const { records } = useAssessmentReferences()
  const manualRecords = records.filter(record => record.source === 'manual')
  return <section className="assessment-reference assessment-reference-manual"><h5>其他人工評量（未標註能力向度）</h5>{manualRecords.length === 0 ? <p className="assessment-reference-muted">目前沒有未標註向度的人工評量。</p> : manualRecords.map(record => <details className="assessment-reference-manual-item" key={record.id}><summary>{record.assessmentDate}・{record.assessmentType || '人工評量'}・{record.assessmentTool}</summary><dl><div><dt>評量者</dt><dd>{record.evaluator}</dd></div><div><dt>摘要</dt><dd>{record.summary}</dd></div></dl></details>)}</section>
}
