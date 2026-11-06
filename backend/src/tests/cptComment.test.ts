import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cptCommentRequestSchema, monkeyCommentRequestSchema } from '../schemas/cptComment.js'
import { cptCommentInput, generateCptComment, generateMonkeyComment, monkeyCommentInput } from '../services/geminiCptComment.js'
import { GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'

const request = { age: 8, rows: [
  { label: '命中率（Hit）', value: '97.5%', reference: '98.0%（SD 3.0%）', z: -.17, level: 'typical' as const },
  { label: '誤按（Commission）', value: '5 次', reference: '0.9 次（SD 1.22）', z: 3.36, level: 'concern' as const },
  { label: '錯誤警報率（False）', value: '1.56%', reference: '0.00%（SD 0.0%）', z: null, level: 'reference' as const },
] }

test('CPT comment request is de-identified and strict', () => {
  assert.equal(cptCommentRequestSchema.safeParse(request).success, true)
  assert.equal(cptCommentRequestSchema.safeParse({ ...request, studentName: '王小明' }).success, false)
  assert.equal(cptCommentRequestSchema.safeParse({ ...request, age: 13 }).success, false)
})

test('CPT comment input carries each precomputed level and the model reply is validated', async () => {
  const input = cptCommentInput(request)
  assert.match(input, /受測年齡：8 歲/)
  assert.match(input, /誤按（Commission）：5 次／0.9 次（SD 1.22）／3.36／明顯需留意/)
  assert.match(input, /無法計算／僅供對照/)
  const comment = '整體表現穩定，命中率在同齡一般範圍內；誤按次數明顯偏多，可多觀察課堂中是否容易搶答。結果僅供參考。'
  assert.equal(await generateCptComment(request, async () => JSON.stringify({ comment })), comment)
  await assert.rejects(generateCptComment(request, async () => '{"comment":"短"}'), GeminiResponseInvalidError)
  await assert.rejects(generateCptComment(request, async () => 'not json'), GeminiResponseInvalidError)
})

test('Monkey comment request uses the school grade and the same validated reply', async () => {
  const monkey = { grade: 3, rows: [
    { label: '工作記憶總分（各題平均答對比例）', value: '55.4%', reference: '51%（SD 14%）', z: .31, level: 'typical' as const },
    { label: 'Level 5（6 個詞）答對比例', value: '21%', reference: '無同年級資料', z: null, level: 'reference' as const },
  ] }
  assert.equal(monkeyCommentRequestSchema.safeParse(monkey).success, true)
  assert.equal(monkeyCommentRequestSchema.safeParse({ ...monkey, grade: 7 }).success, false)
  assert.equal(monkeyCommentRequestSchema.safeParse({ ...monkey, studentName: '王小明' }).success, false)
  assert.match(monkeyCommentInput(monkey), /受測年級：國小 3 年級/)
  assert.match(monkeyCommentInput(monkey), /工作記憶總分（各題平均答對比例）：55.4%／51%（SD 14%）／0.31／一般範圍/)
  const comment = '工作記憶總分落在同年級一般範圍內，四個詞以內大致能正確倒序；六個詞時錯誤增加。結果僅供參考。'
  assert.equal(await generateMonkeyComment(monkey, async () => JSON.stringify({ comment })), comment)
})