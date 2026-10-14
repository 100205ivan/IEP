import type { ExtractedAssessmentText } from '../types/assessmentDocument'
import { postProcessOcrText } from '../utils/recognizedRegionText'

// Preserve the thresholds and rendering scale from the old EyeEP service.
export const MAX_REPORT_CHARACTERS = 60_000
export const MINIMUM_TEXT_LENGTH = 20
export interface ExtractionProgress { message: string; pageNumber?: number; pageCount?: number; percent?: number }
type Progress = (progress: ExtractionProgress) => void

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}

export async function validateAssessmentPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) throw new Error('僅支援 PDF 評估報告，請重新選擇 PDF。')
  const header = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer())
  if (!header.includes('%PDF-')) throw new Error('檔案內容不是有效的 PDF，請重新選擇。')
}

async function openPdf(file: File, signal: AbortSignal) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  signal.throwIfAborted()
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  const assets = `${import.meta.env.BASE_URL}pdfjs/`
  const task = pdfjs.getDocument({ data, cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` })
  const destroy = () => { void task.destroy() }
  signal.addEventListener('abort', destroy, { once: true })
  try {
    const document = await task.promise
    signal.throwIfAborted()
    return { document, close: () => { signal.removeEventListener('abort', destroy); destroy() } }
  } catch {
    signal.removeEventListener('abort', destroy)
    destroy()
    signal.throwIfAborted()
    throw new Error('無法解析此 PDF，請確認檔案未損毀、未加密後重新上傳。')
  }
}

/** Entirely browser-side. No PDF, raw text, or OCR result is sent to a server. */
export async function extractAssessmentDocumentText(file: File, signal: AbortSignal, onProgress: Progress): Promise<ExtractedAssessmentText> {
  onProgress({ message: '正在讀取 PDF...' })
  await validateAssessmentPdf(file)
  signal.throwIfAborted()
  const opened = await openPdf(file, signal)
  const pageCount = opened.document.numPages
  try {
    const pages: string[] = []
    let length = 0, truncated = false
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      signal.throwIfAborted()
      if (length >= MAX_REPORT_CHARACTERS) { truncated = true; break }
      onProgress({ message: `正在擷取第 ${pageNumber} / ${pageCount} 頁文字...`, pageNumber, pageCount })
      const page = await opened.document.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const pageText = content.items.map(item => 'str' in item && typeof item.str === 'string' ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('').replace(/[ \t]+\n/g, '\n').trim()
        if (pageText) {
          const remaining = MAX_REPORT_CHARACTERS - length
          if (pageText.length > remaining) truncated = true
          pages.push(pageText.slice(0, remaining))
          length += pageText.length
        }
      } finally { page.cleanup() }
    }
    const rawText = pages.join('\n\n').trim()
    if (rawText.length >= MINIMUM_TEXT_LENGTH) return { fileName: file.name, pageCount, extractionMethod: 'text-layer', rawText, normalizedText: rawText, truncated }
    onProgress({ message: '此 PDF 可能為掃描文件，正在載入繁體中文與英文 OCR...' })
    return await recognizeScannedPdf(opened.document, file.name, signal, onProgress)
  } finally { opened.close() }
}

async function recognizeScannedPdf(pdf: import('pdfjs-dist').PDFDocumentProxy, fileName: string, signal: AbortSignal, onProgress: Progress): Promise<ExtractedAssessmentText> {
  const { createWorker } = await import('tesseract.js')
  const { default: workerUrl } = await import('tesseract.js/dist/worker.min.js?url')
  signal.throwIfAborted()
  const initializationSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)])
  let pageNumber = 0
  let rejectWorkerError: (error: Error) => void = () => {}
  const workerError = new Promise<never>((_, reject) => { rejectWorkerError = reject })
  // Attach immediately: worker errors can happen between awaited jobs.
  void workerError.catch(() => {})
  const assets = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
  const creating = createWorker('chi_tra+eng', 1, {
    workerPath: workerUrl, corePath: `${assets}core`, langPath: `${assets}lang`,
    errorHandler: () => rejectWorkerError(new Error('OCR 引擎或語言模型載入失敗，請重新選擇文件後重試。')),
    logger: event => {
      if (!signal.aborted && pageNumber && event.status === 'recognizing text') onProgress({ message: `正在辨識第 ${pageNumber} / ${pdf.numPages} 頁...`, pageNumber, pageCount: pdf.numPages, percent: Math.round(event.progress * 100) })
    },
  })
  let worker: Awaited<typeof creating>
  try { worker = await abortable(Promise.race([creating, workerError]), initializationSignal) } catch {
    void creating.then(lateWorker => lateWorker.terminate(), () => {})
    signal.throwIfAborted()
    throw new Error('OCR 初始化失敗或逾時，請重新選擇文件後重試。')
  }
  let terminated = false
  const terminate = () => { if (!terminated) { terminated = true; void worker.terminate() } }
  signal.addEventListener('abort', terminate, { once: true })
  try {
    const rawPages: string[] = [], normalizedPages: string[] = []
    for (pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      signal.throwIfAborted()
      onProgress({ message: `正在辨識第 ${pageNumber} / ${pdf.numPages} 頁...`, pageNumber, pageCount: pdf.numPages, percent: 0 })
      const page = await pdf.getPage(pageNumber)
      const natural = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, 2000 / natural.width, 2800 / natural.height) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const activeSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)])
      const stop = () => terminate()
      activeSignal.addEventListener('abort', stop, { once: true })
      try {
        await page.render({ canvas, viewport }).promise
        const result = await abortable(Promise.race([worker.recognize(canvas, {}, { text: true }), workerError]), activeSignal)
        signal.throwIfAborted()
        if (result.data.text.trim()) rawPages.push(result.data.text.trim())
        const text = postProcessOcrText(result.data.text).trim()
        if (text) normalizedPages.push(text)
        onProgress({ message: `正在辨識第 ${pageNumber} / ${pdf.numPages} 頁...`, pageNumber, pageCount: pdf.numPages, percent: 100 })
      } catch (error) {
        signal.throwIfAborted()
        if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error(`第 ${pageNumber} 頁 OCR 辨識逾時，請重新選擇文件後重試。`, { cause: error })
        throw new Error(`第 ${pageNumber} 頁 OCR 辨識失敗，請重新選擇文件後重試。`, { cause: error })
      } finally {
        activeSignal.removeEventListener('abort', stop)
        canvas.width = 1; canvas.height = 1; page.cleanup()
      }
    }
    const rawText = rawPages.join('\n\n').trim()
    const normalizedText = postProcessOcrText(normalizedPages.join('\n\n')).trim()
    if (normalizedText.length < MINIMUM_TEXT_LENGTH) throw new Error('文字辨識完成，但可用文字太少，請改用較清晰的 PDF。')
    return { fileName, pageCount: pdf.numPages, extractionMethod: 'ocr', rawText: rawText.slice(0, MAX_REPORT_CHARACTERS), normalizedText: normalizedText.slice(0, MAX_REPORT_CHARACTERS), truncated: rawText.length > MAX_REPORT_CHARACTERS || normalizedText.length > MAX_REPORT_CHARACTERS }
  } finally { signal.removeEventListener('abort', terminate); terminate() }
}
