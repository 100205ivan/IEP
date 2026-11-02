import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chapterJsonValue, chapterTableSql, iepChapterKeys, iepChapterTables, remainingIepContent } from '../db/iepChapterTables.js'

test('all fifteen chapter properties belong to exactly one of six tables', () => {
  assert.equal(iepChapterTables.length, 6)
  const keys = iepChapterTables.flatMap(chapter => chapter.fields.map(([key]) => key))
  assert.equal(keys.length, 15)
  assert.equal(iepChapterKeys.size, keys.length)
  assert.deepEqual([...keys].sort(), ['studentFamilyForm', 'assessmentSelections', 'assessmentDetails', 'strengthWeaknessSummary', 'specialEducationSupport', 'inclusiveEducationPlan', 'curriculumAdjustment', 'coursePlanItems', 'weeklySchedule', 'goalDomains', 'semesterGoals', 'learningNotes', 'behaviorIntervention', 'transitionSupport', 'meetingRecords'].sort())
})

test('metadata and unknown future fields remain on the parent without mutating input', () => {
  const content = { learningNotes: '章節說明', studentFamilyForm: { values: {} }, basicInfoReviewNotice: { inheritedFromAcademicYear: 114 }, futureChapter: { keep: true } }
  const before = structuredClone(content)
  assert.deepEqual(remainingIepContent(content), { basicInfoReviewNotice: content.basicInfoReviewNotice, futureChapter: content.futureChapter })
  assert.deepEqual(content, before)
})

test('missing fields, explicit null, false, empty arrays and scalar strings remain distinct', () => {
  assert.equal(chapterJsonValue({}, 'learningNotes'), null)
  assert.equal(chapterJsonValue({ learningNotes: undefined }, 'learningNotes'), null)
  for (const value of [null, false, '', [], {}, '說明\n第二行', { nested: [null, false, '其他'] }]) {
    assert.deepEqual(JSON.parse(chapterJsonValue({ value }, 'value')!), value)
  }
})

test('every chapter uses its IEP as the primary key with cascading foreign key cleanup', () => {
  for (const chapter of iepChapterTables) {
    const sql = chapterTableSql(chapter)
    assert.ok(sql.includes('iep_id CHAR(36) NOT NULL PRIMARY KEY'))
    assert.ok(sql.includes('REFERENCES ieps(id) ON DELETE CASCADE'))
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS'))
    for (const [, column] of chapter.fields) assert.ok(sql.includes(`${column} JSON NULL`))
  }
})
