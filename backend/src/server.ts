import express, { type ErrorRequestHandler } from 'express'
import { geminiApiKeyPresent } from './config/environment.js'
import { assessmentDocumentRouter } from './routes/assessmentDocument.js'
import { assessmentRecordRouter } from './routes/assessmentRecord.js'
import { studentIepRouter } from './routes/studentIep.js'
import { runMigrations } from './db/migrate.js'

const port = 3001
const app = express()

app.use(express.json({ limit: '512kb' }))
app.get('/api/health', (_request, response) => response.status(200).json({ ok: true }))
app.use('/api/assessment-document', assessmentDocumentRouter)
app.use('/api', assessmentRecordRouter)
app.use('/api', studentIepRouter)

const invalidJson: ErrorRequestHandler = (error, _request, response, next) => {
  if (error instanceof SyntaxError && 'body' in error) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Request JSON 格式錯誤。' } })
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Request 內容超過允許大小。' } })
  next(error)
}
app.use(invalidJson)
app.use(((error, _request, response, _next) => {
  console.error('EyeEP request failed', { code: typeof error === 'object' && error !== null && 'code' in error ? error.code : 'INTERNAL_ERROR' })
  response.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: '服務暫時無法完成請求。' } })
}) as ErrorRequestHandler)

runMigrations().then(() => app.listen(port, () => console.info('EyeEP backend listening', { port, geminiApiKeyPresent }))).catch((error) => {
  console.error('EyeEP database initialization failed. Check DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD.')
  console.error(error instanceof Error ? error.message : 'Unknown database error')
  process.exitCode = 1
})
