import { Router } from 'express'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'
import { generateIepWord, generateIepWordPdf } from '../services/iepWordExport.js'
import { PdfExportError } from '../services/iepPdf/layout.js'
import { getIep } from '../services/studentIepService.js'
import { getDocumentAnalysis, getGameAssessmentResult, listPersistedAssessments } from '../services/assessmentRecordService.js'
import { lines } from '../services/iepPdf/format.js'
import { listIepAttachments } from '../services/iepAttachmentService.js'

export const iepPdfExportRouter = Router()
const domainNames: Record<string, string> = { sensory: '感官功能', perceptualMotor: '知覺動作', selfCare: '生活自理', cognitive: '認知', communication: '溝通', socialEmotional: '情緒與社會行為', academicLearning: '學業學習' }
iepPdfExportRouter.post(['/iep-export/pdf', '/iep-export/word'], async (request, response, next) => {
  const parsed = iepPdfExportSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_PDF_REQUEST', message: parsed.error.issues[0]?.message || '請檢查匯出資料。' } })
  try {
    const input = parsed.data
    if (input.iepId) {
      const iep = await getIep(input.iepId)
      if (!iep || !input.studentId || iep.studentId !== input.studentId) return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到屬於此學生的 IEP。' } })
    }
    const records = input.iepId ? await listPersistedAssessments(input.iepId) : []
    const assessments = await Promise.all(records.map(async record => {
      let detail = ''
      if (record.source === 'document') {
        const analysis = await getDocumentAnalysis(record.id, input.iepId!)
        if (analysis) detail = [analysis.overallSummary, ...Object.entries(analysis.domains).filter(([, domain]) => domain.hasEvidence).map(([key, domain]) => `${domainNames[key]}：${domain.summary}\n${domain.evidence.map(item => item.content).join('\n')}`), ...analysis.warnings.map(warning => `注意事項：${warning}`)].join('\n')
      } else if (record.source === 'monkey' || record.source === 'cpt') {
        const game = await getGameAssessmentResult(record.id, input.iepId!)
        if (game) detail = lines([['遊戲', game.gameType === 'monkey' ? 'Monkey 工作記憶遊戲' : 'CPT 持續注意力遊戲'], ['施測日期', game.assessmentDate], ['年齡', game.age], ['結果摘要', game.summary]])
      }
      return { ...record, detail }
    }))
    const attachments = input.iepId ? await listIepAttachments(input.iepId) : []
    if (request.path.endsWith('/word')) {
      const word = await generateIepWord(input, assessments, attachments)
      response.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="IEP.docx"; filename*=UTF-8''${encodeURIComponent(word.fileName)}`, 'Cache-Control': 'no-store' })
      return response.send(word.bytes)
    }
    const pdf = await generateIepWordPdf(input, assessments, attachments)
    // The layout check rides along with the PDF; at most 20 issues fit a header.
    const layout = pdf.layout ? { checked: true, issues: pdf.layout.issues.slice(0, 20), more: Math.max(0, pdf.layout.issues.length - 20) } : { checked: false, issues: [], more: 0 }
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="IEP.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.fileName)}`, 'Cache-Control': 'no-store', 'X-IEP-PDF-Pages': String(pdf.pageCount), 'X-IEP-PDF-Supplements': String(pdf.supplementPageCount), 'X-IEP-Layout': encodeURIComponent(JSON.stringify(layout)) })
    return response.send(Buffer.from(pdf.bytes))
  } catch (error) {
    if (error instanceof PdfExportError) return response.status(422).json({ ok: false, error: { code: 'PDF_EXPORT_FAILED', message: error.message } })
    next(error)
  }
})
