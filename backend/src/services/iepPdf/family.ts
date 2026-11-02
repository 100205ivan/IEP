import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { date, lines, object, records, text } from './format.js'
import { drawTeam } from './team.js'
import { FormFlow, type FieldRow } from './flow.js'

export async function drawFamily(pdf: IepPdfDocument, input: IepPdfRequest) {
  const family = object(input.content.studentFamilyForm), values = object(family.values), checks = object(family.checks)
  const v = (key: string) => text(values[key])
  const options = input.options
  const cover = await pdf.page(1, '封面與團隊成員')
  cover.field([146, 85, 305, 25], `${options.schoolName || '____________學校'}　${input.academicYear}學年度`, '學校與學年度', { size: 16, min: 12, align: 'center' })
  cover.field([95, 160, 140, 20], v('studentName'), '學生姓名', { size: 12 })
  // The first checkbox starts at x=238.97. The source text extraction splits
  // 轉學生 into separate runs and stores its checkbox label as 學生.
  cover.choices(options.studentStatus ? [options.studentStatus] : [], [237, 158, 285, 22], { 轉學生: '學生' })
  cover.field([156, 188, 230, 20], [v('grade'), v('className')].filter(Boolean).join('　'), '普通班就讀班級', { size: 12 })
  const special = input.content.specialEducationSupport?.specialEducation ?? []
  cover.choices(special, [94, 214, 450, 22], { 資源班: '分散式資源班', 巡迴輔導: '巡迴輔導班', 集中式特殊教育班: '集中式特教班' })
  cover.field([98, 243, 145, 20], options.caseManager, '個管教師', { size: 12 })
  cover.field([294, 243, 165, 20], options.caseManagerTitle, '個管教師職稱', { size: 12 })
  const initialMeeting = input.content.meetingRecords?.find(meeting => meeting.meetingType === '期初會議')
  const dates = [options.draftedDate || initialMeeting?.date || '', options.committeeApprovalDate, options.curriculumApprovalDate, options.newStudentReviewDate, options.firstReviewDate, options.secondReviewDate]
  dates.forEach((value, index) => { if (value) cover.field([index === 0 ? 137 : index < 3 ? 207 : index === 3 ? 183 : 137, 270 + index * 27.3, 210, 19], date(value), '封面會議日期', { size: 12 }) })
  drawTeam(cover, options.teamMembers ?? [])
  const form = await FormFlow.create(pdf, input, '壹、一、學生基本資料及家庭狀況')
  await form.heading('學生基本資料')
  await form.grid([['姓名', v('studentName')], ['性別', ({ male: '男', female: '女' } as Record<string, string>)[v('gender')] || v('gender')], ['出生日期', date(v('birthDate'))], ['身分證字號', v('nationalId')], ['學號', v('studentId')], ['班級', [v('grade'), v('className')].filter(Boolean).join('　')], ['入班時間', date(v('classEntryDate'))], ['導師', v('homeroomTeacher')]])
  await form.fields([['戶籍地址', v('registeredAddress')], ['居住地址', checks.sameAddress ? v('registeredAddress') : v('residentialAddress')]])
  const assessment: FieldRow[] = [['鑑輔會鑑定日期', date(v('committeeAssessmentDate'))], ['重鑑日期', date(v('committeeReassessmentDate'))], ['鑑定文號', [v('committeeDocumentNumber'), v('committeeSpecialEducationNumber')].filter(Boolean).join('　')], ['鑑定障礙類別及程度', [v('committeeDisabilityCategory'), v('committeeSeverity')].filter(Boolean).join('／')], ['證明鑑定日期', date(v('proofAssessmentDate'))], ['證明重鑑日期', date(v('proofReassessmentDate'))], ['ICF 類別及程度', [v('icfCategoryDetail') || (v('icfCategory') === 'other' ? v('icfOther') : ({ physical: '肢體功能相關', sensory: '感官功能相關', mental: '心智／心理功能相關' } as Record<string, string>)[v('icfCategory')] || v('icfCategory')), v('icfLevel')].filter(Boolean).join('／')], ['ICD 診斷', v('icdDiagnosis')]]
  if (assessment.some(([, value]) => text(value))) { await form.heading('鑑定與身心障礙證明'); await form.fields(assessment) }
  const binary = (key: string) => !v(key) ? '' : v(key) === 'has' ? '有' : '無'
  const health: FieldRow[] = [['特殊疾病', binary('specialDisease')], ['定期用藥', binary('regularMedication')], ['禁忌食物', binary('foodRestriction')], ['食物過敏', binary('foodAllergy')], ['藥物過敏', binary('drugAllergy')], ['經常就診醫院', binary('hospital')]]
  if (health.some(([, value]) => text(value)) || v('otherSpecialCondition')) { await form.heading('健康與醫療資料'); await form.grid(health) }
  if (v('specialDisease') === 'has') await form.paragraph('特殊疾病說明', lines([['疾病', ['氣喘病', '心臟病', '癲癇'].filter(key => checks[key]).join('、')], ['狀況說明', v('diseaseDescription')], ['其他疾病', checks.diseaseOther ? v('diseaseOther') : '']]))
  if (v('regularMedication') === 'has' && records(family.medications).length) {
    await form.heading('用藥資料')
    await form.table(['藥物名稱', '使／服用方式', '臨床用途', '可能副作用'], [115, 145, 125, 135], records(family.medications).map(medicine => ['name', 'directions', 'purpose', 'sideEffects'].map(key => text(medicine[key]))))
  }
  for (const [key, detail, label] of [['foodRestriction', 'foodRestrictionDescription', '禁忌食物說明'], ['foodAllergy', 'foodAllergyDescription', '食物過敏說明'], ['drugAllergy', 'drugAllergyDescription', '藥物過敏說明']] as const) if (v(key) === 'has') await form.paragraph(label, v(detail))
  await form.paragraph('其他特殊狀況', v('otherSpecialCondition'))
  if (v('hospital') === 'has') await form.fields([['醫院名稱', v('hospitalName')], ['就醫科別', v('hospitalDepartment')], ['主治醫師', v('hospitalDoctor')], ['就診頻率', v('hospitalFrequency')]])
  for (const [prefix, title] of [['guardian', '法定代理人'], [checks.sameGuardian ? 'guardian' : 'caregiver', '實際照顧者']] as const) {
    const rows: FieldRow[] = [['姓名', v(prefix + 'Name')], ['與學生關係', v(prefix + 'Relationship')], ['聯絡電話', v(prefix + 'Phone')], ['年齡', v(prefix + 'Age')], ['教育程度', v(prefix + 'Education')], ['職業', v(prefix + 'Occupation')]]
    if (rows.some(([, value]) => text(value))) { await form.heading(title); await form.grid(rows) }
  }
  const siblings = [['siblingsOlderBrother', '兄'], ['siblingsYoungerBrother', '弟'], ['siblingsOlderSister', '姊'], ['siblingsYoungerSister', '妹']].filter(([key]) => v(key) !== '')
  const familyRows: FieldRow[] = [['家庭經濟狀況', ({ 'not-low-income': '非低收入', 'near-low-income': '中低收入', 'low-income': '低收入' } as Record<string, string>)[v('economicStatus')]], ['緊急聯絡人', v('emergencyContact')], ['緊急聯絡電話', v('emergencyPhone')], ['緊急聯絡人關係', v('emergencyRelationship')], ['家中手足', siblings.map(([key, label]) => `${label} ${v(key)} 人`).join('、')], ['父母是否為外籍人士', v('foreignParent') ? v('foreignParent') === 'yes' ? '是' : '否' : ''], ['父親國籍', v('foreignParent') === 'yes' ? v('fatherNationality') : ''], ['母親國籍', v('foreignParent') === 'yes' ? v('motherNationality') : ''], ['父母是否為原住民', v('indigenousParent') ? v('indigenousParent') === 'yes' ? '是' : '否' : ''], ['父親族籍', v('indigenousParent') === 'yes' ? v('fatherIndigenousGroup') : ''], ['母親族籍', v('indigenousParent') === 'yes' ? v('motherIndigenousGroup') : ''], ['家庭身心障礙個案', binary('familyDisability')], ['家庭障礙個案說明', v('familyDisability') === 'has' ? `${v('familyDisabilityRelationship')} ${v('familyDisabilityDescription')}` : '']]
  if (familyRows.some(([, value]) => text(value))) { await form.heading('家庭基本狀況'); await form.grid(familyRows) }
  await form.paragraph('家庭支持現況', v('familySupportSituation'))
  const supports = [['familyConsultation', '家庭諮詢'], ['parentEducation', '親職教育'], ['trainingInformation', '輔導、轉介與特殊教育相關研習及資訊'], ['serviceApplication', '協助家長申請相關機關（構）或團體服務'], ['otherSupport', '其他']]
  const selected = checks.supportNone ? '無此需要' : supports.filter(([key]) => checks[key]).map(([, label]) => label).join('、')
  await form.paragraph('家庭支持服務', selected)
  if (checks.otherSupport && !checks.supportNone) await form.paragraph('其他家庭支持服務', v('otherSupportDescription'))
  return { studentName: v('studentName') || '未填姓名', grade: v('grade'), className: v('className') }
}
