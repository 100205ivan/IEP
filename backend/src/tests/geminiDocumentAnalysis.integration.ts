import assert from 'node:assert/strict'
import { analyzeDeidentifiedDocument } from '../services/geminiDocumentAnalysis.js'

async function run() {
  const result = await analyzeDeidentifiedDocument(`
目前文件未提供生活自理能力相關資訊。
視覺與聽覺未見明顯異常。
`)

  assert.equal(result.domains.selfCare.hasEvidence, false, '缺乏生活自理資訊不可成為 evidence')
  assert.equal(result.domains.selfCare.summary, null, '缺乏生活自理資訊時 summary 必須是 null')
  assert.deepEqual(result.domains.selfCare.evidence, [], '缺乏生活自理資訊時 evidence 必須是空陣列')
  assert.equal(result.domains.sensory.hasEvidence, true, '明確感官評估結果必須是 evidence')
  assert.ok(result.domains.sensory.evidence.length >= 1, '感官 evidence 至少需要一筆')

  console.log(JSON.stringify({ ok: true }))
}

void run().catch(() => {
  // Do not expose document text, raw model output, or upstream error details.
  console.log(JSON.stringify({ ok: false }))
  process.exitCode = 1
})
