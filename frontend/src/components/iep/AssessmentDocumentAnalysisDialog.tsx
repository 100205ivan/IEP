import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { AssessmentDocument } from '../../types/assessmentDocument'
import { extractAssessmentDocumentText } from '../../services/assessmentReportTextExtraction'
import { confirmAssessmentDocument, deidentifyAssessmentReport, REDACTION_LABELS } from '../../services/assessmentReportDeidentification'
import { analyzeAssessmentDocument, DocumentAnalysisApiError } from '../../services/assessmentDocumentAnalysisApi'
import type { DocumentAnalysisResult } from '../../types/assessmentAnalysis'
import { DocumentAnalysisResultDialog } from './DocumentAnalysisResultDialog'
import '../../styles/assessment-document-dialog.css'

const analysisErrorMessages = {
  AI_UNAVAILABLE: 'AI 文件分析服務暫時無法使用，請稍後再試。',
  AI_RESPONSE_INVALID: 'AI 分析結果格式異常，請重新分析。',
  INVALID_REQUEST: '文件內容無法進行分析，請確認內容後再試。',
  UNKNOWN: 'AI 文件分析暫時無法完成，請稍後再試。',
} as const

export function AssessmentDocumentAnalysisDialog({ studentName, onClose, onConfirmAnalysis }: { studentName: string; onClose: () => void; onConfirmAnalysis: (analysis: DocumentAnalysisResult) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef<AbortController | null>(null)
  const [step, setStep] = useState<'upload' | 'extracting' | 'preview' | 'analyzing' | 'analysis-preview'>('upload')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [document, setDocument] = useState<AssessmentDocument | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [analysis, setAnalysis] = useState<DocumentAnalysisResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const abortPendingRequest = useCallback(() => pending.current?.abort(), [])

  useEffect(() => {
    const element = dialog.current
    const root = window.document.documentElement, body = window.document.body
    const previousRootOverflow = root.style.overflow, previousBodyOverflow = body.style.overflow
    // Lock the background while the native modal is open. This also prevents
    // wide IEP tables from expanding the mobile layout viewport behind it.
    root.style.overflow = 'hidden'; body.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      abortPendingRequest(); element?.close()
      root.style.overflow = previousRootOverflow; body.style.overflow = previousBodyOverflow
    }
  }, [abortPendingRequest])

  const reset = () => {
    pending.current?.abort(); pending.current = null
    setDocument(null); setReviewed(false); setAnalysis(null); setError(''); setStatus(''); setFileName(''); setStep('upload')
    if (input.current) input.current.value = ''
  }
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setDocument(null); setReviewed(false); setAnalysis(null); setError(''); setFileName(file.name); setStatus('正在讀取 PDF...'); setStep('extracting')
    try {
      const extracted = await extractAssessmentDocumentText(file, controller.signal, progress => {
        if (!controller.signal.aborted && pending.current === controller) setStatus(progress.message)
      })
      controller.signal.throwIfAborted()
      setStatus('正在去識別化...')
      const masked = deidentifyAssessmentReport(extracted.normalizedText, { studentName: [studentName] })
      if (pending.current !== controller) return
      setDocument({ ...extracted, ...masked, deidentificationCompleted: true, confirmedAt: null })
      setStep('preview')
    } catch (cause) {
      if (!controller.signal.aborted && pending.current === controller) {
        setDocument(null); setStep('upload')
        setError(cause instanceof Error ? cause.message : '文件辨識失敗，請重新選擇 PDF。')
      }
    } finally {
      if (pending.current === controller) pending.current = null
      if (input.current && !controller.signal.aborted) input.current.value = ''
    }
  }
  const confirm = async () => {
    if (!document) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    try {
      const result = confirmAssessmentDocument(document, reviewed)
      setDocument(result.document); setError(''); setStep('analyzing')
      const nextAnalysis = await analyzeAssessmentDocument(result.input.deidentifiedText, controller.signal)
      if (pending.current !== controller) return
      setAnalysis(nextAnalysis); setStep('analysis-preview')
    } catch (cause) {
      if (controller.signal.aborted || pending.current !== controller) return
      setStep('preview')
      setError(cause instanceof DocumentAnalysisApiError ? analysisErrorMessages[cause.code] : cause instanceof Error ? cause.message : '請先確認去識別化內容。')
    } finally { if (pending.current === controller) pending.current = null }
  }
  const returnToEdit = () => { if (importing) return; setImportError(''); setAnalysis(null); setDocument(current => current ? { ...current, confirmedAt: null } : current); setStep('preview') }
  const importAnalysis = async () => {
    if (!analysis || importing) return
    setImporting(true); setImportError('')
    try { await onConfirmAnalysis(analysis); onClose() }
    catch (cause) { setImportError(cause instanceof Error ? cause.message : '儲存分析結果失敗，請稍後再試。') }
    finally { setImporting(false) }
  }
  const counts = document?.redactions.reduce<Record<string, number>>((result, item) => ({ ...result, [item.type]: (result[item.type] ?? 0) + 1 }), {}) ?? {}

  return <dialog className="assessment-document-dialog" ref={dialog} aria-labelledby="assessment-document-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="assessment-document-header"><h2 id="assessment-document-title">AI 辨識評估文件</h2><button className="text-button" type="button" onClick={onClose} aria-label="關閉文件辨識">關閉</button></header>
    <div className="assessment-document-body">
      <input ref={input} className="assessment-document-file" type="file" accept=".pdf,application/pdf" aria-label="選擇 PDF" onChange={event => { void selectFile(event) }} />
      {step === 'upload' && <section><h3>① 上傳評估文件</h3><button className="button button--primary" type="button" onClick={() => input.current?.click()}>選擇 PDF</button><p>支援 PDF 評估報告。<br />文件會先進行文字辨識與去識別化，確認後才可進行 AI 分析。</p></section>}
      {step === 'extracting' && <section><h3>② 文件辨識</h3><p className="assessment-document-filename">文件：{fileName}</p><p role="status" aria-live="polite">{status}</p><button className="button button--secondary" type="button" onClick={reset}>重新選擇文件</button></section>}
      {step === 'preview' && document && <section>
        <h3>③ 去識別化確認</h3>
        <dl className="assessment-document-metadata"><div><dt>文件</dt><dd>{document.fileName}</dd></div><div><dt>頁數</dt><dd>{document.pageCount}</dd></div><div><dt>辨識方式</dt><dd>{document.extractionMethod === 'text-layer' ? 'PDF 文字層' : 'OCR（繁體中文＋英文）'}</dd></div></dl>
        {document.truncated && <p className="assessment-document-warning">文件超過原有 60,000 字擷取上限，目前僅顯示擷取範圍，請留意後續內容可能未包含。</p>}
        <p role="status">已遮蔽 {document.redactions.length} 項可能的個人識別資訊</p>
        {Object.keys(counts).length > 0 && <ul className="assessment-document-redactions">{Object.entries(counts).map(([type, count]) => <li key={type}>{REDACTION_LABELS[type as keyof typeof REDACTION_LABELS]}：{count} 項</li>)}</ul>}
        <label className="assessment-document-preview">去識別化後文字預覽<textarea value={document.deidentifiedText} rows={14} spellCheck={false} onChange={event => { setDocument({ ...document, deidentifiedText: event.target.value, confirmedAt: null }); setReviewed(false); setAnalysis(null) }} /></label>
        <p>請確認內容中沒有仍可辨識學生身分的資訊；如有遺漏，可直接編修上方文字。</p>
        <label className="assessment-document-review"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />我已檢查去識別化內容，確認沒有仍可辨識學生身分的資訊。</label>
        <div className="assessment-document-actions"><button className="button button--secondary" type="button" onClick={reset}>重新選擇文件</button><button className="button button--primary" type="button" disabled={!reviewed || !document.deidentifiedText.trim() || !document.deidentificationCompleted} onClick={() => { void confirm() }}>確認去識別化內容</button></div>
      </section>}
      {step === 'analyzing' && <section><h3>④ AI 文件分析</h3><p className="assessment-document-confirmed" role="status" aria-live="polite">AI 分析中…</p></section>}
      {error && <p className="assessment-document-error" role="alert">{error}</p>}
    </div>
    {step === 'analysis-preview' && analysis && <DocumentAnalysisResultDialog analysis={analysis} onClose={returnToEdit} onBackToEdit={returnToEdit} onConfirm={() => { void importAnalysis() }} confirming={importing} confirmError={importError} />}
  </dialog>
}
