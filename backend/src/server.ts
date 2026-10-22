import express, { type ErrorRequestHandler } from 'express'
import { geminiApiKeyPresent } from './config/environment.js'
import { assessmentDocumentRouter } from './routes/assessmentDocument.js'

const port = 3001
const app = express()

app.use(express.json({ limit: '512kb' }))
app.get('/api/health', (_request, response) => response.status(200).json({ ok: true }))
app.use('/api/assessment-document', assessmentDocumentRouter)

const invalidJson: ErrorRequestHandler = (error, _request, response, next) => {
  if (error instanceof SyntaxError && 'body' in error) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Request JSON 格式錯誤。' } })
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Request 內容超過允許大小。' } })
  next(error)
}
app.use(invalidJson)

app.listen(port, () => console.info('EyeEP backend listening', { port, geminiApiKeyPresent }))
