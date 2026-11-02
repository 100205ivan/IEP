// Table and column identifiers are application constants, never request input.
export const iepChapterTables = [
  { table: 'iep_assessments', comment: '壹：學生能力現況、家庭狀況及需求評估', fields: [
    ['studentFamilyForm', 'student_family_form'], ['assessmentSelections', 'assessment_selections'],
    ['assessmentDetails', 'assessment_details'], ['strengthWeaknessSummary', 'strength_weakness_summary'],
  ] },
  { table: 'iep_services', comment: '貳：特殊教育、相關服務及支持策略', fields: [
    ['specialEducationSupport', 'special_education_support'], ['inclusiveEducationPlan', 'inclusive_education_plan'],
    ['curriculumAdjustment', 'curriculum_adjustment'], ['coursePlanItems', 'course_plan_items'], ['weeklySchedule', 'weekly_schedule'],
  ] },
  { table: 'iep_goals', comment: '參：學年與學期教育目標', fields: [
    ['goalDomains', 'goal_domains'], ['semesterGoals', 'semester_goals'], ['learningNotes', 'learning_notes'],
  ] },
  { table: 'iep_behavior_interventions', comment: '肆：行為功能介入方案及行政支援', fields: [['behaviorIntervention', 'behavior_intervention']] },
  { table: 'iep_transitions', comment: '伍：學生轉銜輔導及服務內容', fields: [['transitionSupport', 'transition_support']] },
  { table: 'iep_meetings', comment: 'IEP 會議紀錄', fields: [['meetingRecords', 'meeting_records']] },
] as const

export const iepChapterKeys = new Set<string>(iepChapterTables.flatMap(chapter => chapter.fields.map(([key]) => key)))

export function remainingIepContent(content: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(content).filter(([key]) => !iepChapterKeys.has(key)))
}

// SQL NULL means the API property is absent. JSON 'null' is an explicit value.
export function chapterJsonValue(content: Record<string, unknown>, key: string): string | null {
  return Object.hasOwn(content, key) && content[key] !== undefined ? JSON.stringify(content[key]) : null
}

// Historical 006 schema; 007 removes the duplicate timestamp columns after
// checking their values. Fresh installations must still run both migrations.
export function chapterTableSql(chapter: typeof iepChapterTables[number]): string {
  return `CREATE TABLE IF NOT EXISTS ${chapter.table} (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    ${chapter.fields.map(([, column]) => `${column} JSON NULL`).join(',\n    ')},
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_${chapter.table}_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='${chapter.comment}'`
}
