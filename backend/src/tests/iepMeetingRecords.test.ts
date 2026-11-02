import assert from 'node:assert/strict'
import { test } from 'node:test'
import { iepMeetingRecordSchema, iepMeetingRecordsSchema } from '../schemas/iepMeetingRecords.js'
import { createStudentIepSchema, createAnnualIepSchema, updateIepSchema } from '../schemas/studentIep.js'

const meeting = {
  id: 'meeting-1', meetingType: '期初會議', otherMeetingType: '', date: '2026-11-02', location: '測試會議室', chairperson: '測試主席', recorder: '測試紀錄',
  participants: [{ id: 'person-1', role: 'parent', name: '測試與會人員', title: '測試職稱', attended: false, futurePersonField: '保留' }],
  discussionTopics: [{ id: 'topic-1', type: '其他', enabled: true, summary: '討論摘要\n第二行', otherName: '測試討論事項', futureTopicField: '保留' }],
  decisions: [{ id: 'decision-1', content: '決議欄位測試\n第二行', futureDecisionField: '保留' }],
  motions: [{ id: 'motion-1', content: '臨時動議欄位測試', futureMotionField: '保留' }], hasMotions: true, futureMeetingField: '保留',
}
const content = { meetingRecords: [meeting], learningNotes: '其他章節保留', futureChapter: { keep: true } }
const valid = (meetingRecords: unknown) => updateIepSchema.safeParse({ content: { meetingRecords } }).success

test('all meeting fields and unrelated chapters survive all three IEP write entry points', () => {
  const requests = [createStudentIepSchema.parse({ student: { name: '欄位驗證' }, academicYear: 115, content }), createAnnualIepSchema.parse({ academicYear: 116, content }), updateIepSchema.parse({ content })]
  for (const request of requests) assert.deepEqual(request.content, content)
})

test('meeting metadata follows form requirements and accepts real calendar dates', () => {
  for (const invalid of [
    { date: '' }, { date: '2026-02-30' }, { date: '2025-02-29' }, { date: '2026-1-2' },
    { location: '   ' }, { meetingType: '其他', otherMeetingType: '  ' }, { id: '  ' },
  ]) assert.equal(valid([{ ...meeting, ...invalid }]), false)
  assert.equal(valid([{ ...meeting, date: '2028-02-29', meetingType: '其他', otherMeetingType: '自訂會議類型' }]), true)
  assert.equal(iepMeetingRecordSchema.parse({ ...meeting, location: ' 測試會議室 ' }).location, '測試會議室')
})

test('missing optional fields receive safe defaults and an empty meeting list is valid', () => {
  const parsed = iepMeetingRecordSchema.parse({ id: 'legacy', date: '2026-11-02', location: '測試地點' })
  assert.equal(parsed.meetingType, '期初會議')
  assert.equal(parsed.chairperson, '')
  assert.equal(parsed.recorder, '')
  assert.equal(parsed.hasMotions, false)
  for (const key of ['participants', 'discussionTopics', 'decisions', 'motions'] as const) assert.deepEqual(parsed[key], [])
  assert.deepEqual(iepMeetingRecordsSchema.parse([]), [])
  assert.equal(updateIepSchema.safeParse({ content: {} }).success, true)
})

test('all meeting types, participant roles and discussion options match the form', async () => {
  const moduleUrl = new URL('../../../frontend/src/models/iepMeeting.ts', import.meta.url).href
  const { meetingTypes, participantRoles, discussionTypes, createEmptyMeeting } = await import(moduleUrl)
  for (const meetingType of meetingTypes) assert.equal(valid([{ ...meeting, meetingType, otherMeetingType: '測試其他類型' }]), true)
  for (const role of participantRoles) assert.equal(valid([{ ...meeting, participants: [{ ...meeting.participants[0], role }] }]), true)
  for (const type of discussionTypes) assert.equal(valid([{ ...meeting, discussionTopics: [{ ...meeting.discussionTopics[0], type }] }]), true)
  const fresh = createEmptyMeeting()
  fresh.date = '2026-11-02'; fresh.location = '測試地點'
  assert.deepEqual(iepMeetingRecordSchema.parse(fresh), fresh)
  assert.equal(new Set(fresh.discussionTopics.map((topic: { id: string }) => topic.id)).size, 9)
})

test('invalid enums, types, blank items and oversized text are rejected', () => {
  for (const invalid of [
    { meetingType: '不存在' }, { participants: [{ ...meeting.participants[0], role: '不存在' }] },
    { participants: [{ ...meeting.participants[0], name: ' ' }] }, { participants: [{ ...meeting.participants[0], attended: 'true' }] },
    { discussionTopics: [{ ...meeting.discussionTopics[0], type: '不存在' }] }, { discussionTopics: [{ ...meeting.discussionTopics[0], enabled: 1 }] },
    { decisions: [{ id: 'decision-1', content: ' ' }] }, { motions: [{ id: 'motion-1', content: '' }] },
    { participants: {} }, { hasMotions: 'false' }, { location: '字'.repeat(2001) },
    { discussionTopics: [{ ...meeting.discussionTopics[0], summary: '字'.repeat(20001) }] },
  ]) assert.equal(valid([{ ...meeting, ...invalid }]), false)
  assert.equal(valid({}), false)
  assert.equal(valid([null]), false)
})

test('meeting IDs and every nested collection reject duplicate or blank IDs', () => {
  assert.equal(valid([meeting, meeting]), false)
  for (const key of ['participants', 'discussionTopics', 'decisions', 'motions'] as const) {
    const item = meeting[key][0]
    assert.equal(valid([{ ...meeting, [key]: [item, item] }]), false)
    assert.equal(valid([{ ...meeting, [key]: [{ ...item, id: '' }] }]), false)
  }
  // Nested identifiers belong to their meeting, rather than a global collection.
  assert.equal(valid([meeting, { ...meeting, id: 'meeting-2' }]), true)
})

test('unchecked topics, absent participants and hidden motions retain their saved details', () => {
  const hidden = { ...meeting, hasMotions: false, discussionTopics: [{ ...meeting.discussionTopics[0], enabled: false }] }
  assert.deepEqual(iepMeetingRecordSchema.parse(hidden), hidden)
  const cleared = { ...meeting, chairperson: '', recorder: '', participants: [], decisions: [], motions: [], hasMotions: false }
  assert.deepEqual(iepMeetingRecordSchema.parse(cleared), cleared)
  assert.deepEqual(updateIepSchema.parse({ content: { ...content, meetingRecords: [] } }).content, { ...content, meetingRecords: [] })
})

test('legacy meeting records hydrate nested collections without losing future fields or mutating input', async () => {
  const moduleUrl = new URL('../../../frontend/src/services/meetingRecordsNormalization.ts', import.meta.url).href
  const { normalizeMeetingRecords } = await import(moduleUrl)
  const old = { id: 'legacy', date: '2026-11-02', location: '舊會議室', participants: [{ name: '測試人員', attended: false, futureField: '保留' }], discussionTopics: [{ type: '轉銜服務', enabled: true, summary: '既有摘要' }], decisions: [{ content: '既有決議' }], motions: null, futureMeetingField: '保留' }
  const before = structuredClone(old)
  const normalized = normalizeMeetingRecords([old, null, 'invalid'])[0]
  assert.deepEqual(old, before)
  assert.equal(normalized.id, old.id)
  assert.equal(normalized.participants[0].attended, false)
  assert.equal(normalized.participants[0].futureField, '保留')
  assert.equal(normalized.participants[0].role, 'other')
  assert.equal(normalized.discussionTopics.length, 9)
  assert.equal(normalized.discussionTopics[0].summary, '既有摘要')
  assert.deepEqual(normalized.motions, [])
  assert.equal(iepMeetingRecordSchema.safeParse(normalized).success, true)
  assert.deepEqual(normalizeMeetingRecords(undefined), [])
  assert.deepEqual(normalizeMeetingRecords({}), [])
  normalized.decisions.push({ id: 'added', content: '新增測試' })
  assert.equal(normalizeMeetingRecords([old])[0].decisions.length, 1)
  const second = normalizeMeetingRecords([{ date: old.date, location: old.location }])[0]
  assert.ok(second.id)
  assert.notEqual(second.id, normalized.id)
})
