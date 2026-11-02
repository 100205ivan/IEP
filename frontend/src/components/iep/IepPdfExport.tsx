import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { IepContent } from '../../types/studentIep'
import type { IepPdfOptions } from '../../models/iepPdfOptions'
import { IepCertificateFields, IepTeamFields } from './IepExportExtras'

interface Props { content: IepContent; options: IepPdfOptions; onOptionsChange: (value: IepPdfOptions) => void; academicYear: number; studentName: string; studentId?: string; iepId?: string; disabled: boolean }

export function IepPdfExport({ content, options, onOptionsChange, academicYear, studentName, studentId, iepId, disabled }: Props) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [preview, setPreview] = useState<{ document: PDFDocumentProxy; close: () => void; url: string; pages: number; supplements: number; filename: string } | null>(null)
  const [page, setPage] = useState(1), [rendering, setRendering] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(preview), controller = useRef<AbortController | null>(null)
  const [renderError, setRenderError] = useState('')
  useEffect(() => () => { controller.current?.abort(); if (current.current) { URL.revokeObjectURL(current.current.url); current.current.close() } }, [])
  useEffect(() => {
    if (!preview || !canvas.current) return
    let cancelled = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    void (async () => {
      try {
        setRendering(true); setRenderError('')
        const pdfPage = await preview.document.getPage(page)
        if (cancelled || !canvas.current) return
        const viewport = pdfPage.getViewport({ scale: 1.5 }), target = canvas.current
        target.width = viewport.width; target.height = viewport.height
        task = pdfPage.render({ canvas: target, viewport })
        await task.promise
      } catch (reason) {
        if (!cancelled) setRenderError(reason instanceof Error ? reason.message : '預覽載入失敗，仍可下載 PDF。')
      } finally { if (!cancelled) setRendering(false) }
    })()
    return () => { cancelled = true; task?.cancel() }
  }, [preview, page])
  const generate = async () => {
    setBusy(true); setError(''); controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    try {
      if (!Number.isInteger(academicYear) || academicYear < 1 || academicYear > 999) throw new Error('請先填寫有效的學年度。')
      const response = await fetch('/api/iep-export/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, academicYear, studentId, iepId, options }), signal: abort.signal })
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.error?.message || 'PDF 產生失敗，請稍後重試。') }
      const bytes = new Uint8Array(await response.arrayBuffer())
      abort.signal.throwIfAborted()
      const pdfjs = await import('pdfjs-dist'), { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker
      const assets = `${import.meta.env.BASE_URL}pdfjs/`
      const task = pdfjs.getDocument({ data: bytes.slice(), cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` })
      const cancel = () => { void task.destroy() }; abort.signal.addEventListener('abort', cancel, { once: true })
      let document: PDFDocumentProxy
      try { document = await task.promise; abort.signal.throwIfAborted() } catch (reason) { cancel(); throw reason } finally { abort.signal.removeEventListener('abort', cancel) }
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const result = { document, close: cancel, url, pages: document.numPages, supplements: Number(response.headers.get('X-IEP-PDF-Supplements') || 0), filename: `${studentName}_${academicYear}學年度_IEP.pdf` }
      const previous = current.current; current.current = result
      setPreview(result); setPage(1)
      if (previous) { URL.revokeObjectURL(previous.url); previous.close() }
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'PDF 產生失敗。') }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  const change = <K extends keyof IepPdfOptions>(key: K, value: IepPdfOptions[K]) => onOptionsChange({ ...options, [key]: value })
  return <section className="content-panel pdf-export" id="chapter-export" role="tabpanel" aria-labelledby="chapter-tab-export">
    <div className="section-heading"><p className="eyebrow">匯出</p><h1>個別化教育計畫 PDF</h1><p>匯出壹至伍與 IEP 會議紀錄。</p></div>
    <div className="pdf-export-summary"><strong>{studentName || '未填姓名'} · {academicYear || '未填'} 學年度</strong><p>使用目前畫面上的填寫內容與已儲存的評量紀錄。超出表格的文字會附在該節續頁，簽名欄保留供紙本簽署。</p></div>
    <details className="pdf-export-options"><summary>封面與課表設定<span>隨「儲存 IEP」保存</span></summary><p>選填，空白欄位會留白。修改後請點上方「儲存 IEP」，下次開啟會自動帶入；產生預覽不會自動儲存。</p><fieldset className="pdf-export-fields" disabled={disabled} aria-label="封面與課表設定">
      {([['schoolName', '學校名稱'], ['caseManager', '個管教師'], ['caseManagerTitle', '個管教師職稱']] as const).map(([key, label]) => <label key={key}>{label}<input maxLength={200} value={options[key]} onChange={e => change(key, e.target.value)} /></label>)}
      <label>學生身分<select value={options.studentStatus} onChange={e => change('studentStatus', e.target.value as IepPdfOptions['studentStatus'])}><option value="">留白</option>{['新生', '轉學生', '舊生'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>預設課表學期<select value={options.weeklyScheduleSemester} onChange={e => change('weeklyScheduleSemester', e.target.value as IepPdfOptions['weeklyScheduleSemester'])}><option>第一學期</option><option>第二學期</option></select><small>兩學期課表都會一併匯出。</small></label>
      {([['draftedDate', 'IEP 訂定日期'], ['committeeApprovalDate', '特推會審議日期'], ['curriculumApprovalDate', '課發會通過日期'], ['newStudentReviewDate', '新生檢討日期'], ['firstReviewDate', '第一次檢討日期'], ['secondReviewDate', '第二次檢討日期']] as const).map(([key, label]) => <label key={key}>{label}<input type="date" value={options[key]} onChange={e => change(key, e.target.value)} /></label>)}
    </fieldset></details>
    <IepTeamFields value={options.teamMembers ?? []} onChange={value => change('teamMembers', value)} disabled={disabled} />
    <IepCertificateFields key={`${studentId}/${iepId}`} studentId={studentId} iepId={iepId} disabled={disabled} />
    <div className="pdf-export-actions"><button type="button" className="button button--primary" disabled={disabled || busy} onClick={() => void generate()}>{busy ? '正在產生 PDF…' : preview ? '重新產生預覽' : '產生 PDF 預覽'}</button>{preview && <a className="button button--secondary" href={preview.url} download={preview.filename}>下載 PDF</a>}</div>
    {error && <p className="student-list-error" role="alert">{error}</p>}
    {!preview && !busy && <p className="pdf-export-empty">產生後可在這裡逐頁檢查，再下載 PDF。</p>}
    {busy && <p role="status">正在排版各章節，請稍候…</p>}
    {preview && <section className="pdf-preview" aria-label="PDF 預覽"><div className="pdf-preview-toolbar"><span role="status">共 {preview.pages} 頁{preview.supplements ? `，含 ${preview.supplements} 頁續頁` : ''}</span><div><button className="button button--secondary" type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</button><label>第 <select aria-label="預覽頁碼" value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: preview.pages }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select> 頁</label><button className="button button--secondary" type="button" disabled={page >= preview.pages} onClick={() => setPage(p => p + 1)}>下一頁</button></div></div>{renderError && <p role="alert">{renderError}</p>}<div className="pdf-preview-paper" aria-busy={rendering}><canvas ref={canvas} role="img" aria-label={`IEP PDF 第 ${page} 頁`} /></div><p className="pdf-preview-note">預覽為最近一次產生的內容；修改表單或設定後，請重新產生。</p></section>}
  </section>
}
