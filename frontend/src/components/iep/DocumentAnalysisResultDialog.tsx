import { useEffect, useRef } from 'react'
import { ABILITY_DOMAIN_LABELS, ABILITY_DOMAINS, type DocumentAnalysisResult, type StoredDocumentAnalysis } from '../../types/assessmentAnalysis'
import '../../styles/assessment-document-dialog.css'

export function DocumentAnalysisResultDialog({ analysis, onClose, onBackToEdit, onConfirm, confirming = false, confirmError = '' }: { analysis: DocumentAnalysisResult | StoredDocumentAnalysis; onClose: () => void; onBackToEdit?: () => void; onConfirm?: () => void; confirming?: boolean; confirmError?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogNode = dialog.current
    dialogNode?.showModal()
    return () => dialogNode?.close()
  }, [])

  const { documentInfo } = analysis
  return <dialog className="assessment-document-dialog assessment-analysis-result-dialog" ref={dialog} aria-labelledby="document-analysis-result-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="assessment-document-header"><h2 id="document-analysis-result-title">評估文件 AI 分析結果</h2><button className="text-button" type="button" onClick={onClose}>關閉</button></header>
    <div className="assessment-document-body">
      <dl className="assessment-document-metadata">
        <div><dt>文件類型</dt><dd>{documentInfo.documentType ?? '未提供'}</dd></div>
        <div><dt>評量日期</dt><dd>{documentInfo.assessmentDate ?? '未提供'}</dd></div>
        <div><dt>評量工具</dt><dd>{documentInfo.assessmentTools.length ? documentInfo.assessmentTools.join('、') : '未提供'}</dd></div>
        <div><dt>評量者</dt><dd>{documentInfo.evaluator ?? '未提供'}</dd></div>
      </dl>
      <section className="assessment-analysis-section"><h3>整體摘要</h3><p>{analysis.overallSummary}</p></section>
      <section className="assessment-analysis-section"><h3>能力向度</h3><div className="assessment-analysis-domains">{ABILITY_DOMAINS.map(domain => {
        const domainAnalysis = analysis.domains[domain]
        return <article key={domain} className="assessment-analysis-domain"><h4>{ABILITY_DOMAIN_LABELS[domain]}</h4>{domainAnalysis.hasEvidence ? <><p>已整理 {domainAnalysis.evidence.length} 項評量資訊</p><details><summary>查看評量資訊</summary>{domainAnalysis.summary && <p>{domainAnalysis.summary}</p>}<ul>{domainAnalysis.evidence.map(evidence => <li key={evidence.id}>{evidence.content}</li>)}</ul></details></> : <p>文件未提供相關資訊</p>}</article>
      })}</div></section>
      {analysis.warnings.length > 0 && <section className="assessment-analysis-warnings"><h3>需要老師確認</h3><ul>{analysis.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></section>}
      {confirmError && <p className="assessment-document-error" role="alert">{confirmError}</p>}
      {onConfirm && <footer className="assessment-analysis-actions"><button className="button button--secondary" type="button" disabled={confirming} onClick={onBackToEdit ?? onClose}>返回修改</button><button className="button button--primary" type="button" disabled={confirming} onClick={onConfirm}>{confirming ? '儲存中…' : '確認分析結果'}</button></footer>}
    </div>
  </dialog>
}
