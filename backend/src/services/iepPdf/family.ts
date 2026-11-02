import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { date, lines, object, records, text } from './format.js'

export async function drawFamily(pdf: IepPdfDocument, input: IepPdfRequest) {
  const family = object(input.content.studentFamilyForm), values = object(family.values), checks = object(family.checks)
  const v = (key: string) => text(values[key])
  const options = input.options
  const cover = await pdf.page(1, '封面與團隊成員')
  cover.field([146, 85, 305, 25], `${options.schoolName || '____________學校'}　${input.academicYear}學年度`, '學校與學年度', { size: 16, min: 12, align: 'center' })
  cover.field([95, 160, 145, 20], v('studentName'), '學生姓名', { size: 12 })
  cover.choices(options.studentStatus ? [options.studentStatus] : [], [250, 158, 270, 22])
  cover.field([156, 188, 230, 20], [v('grade'), v('className')].filter(Boolean).join('　'), '普通班就讀班級', { size: 12 })
  const special = input.content.specialEducationSupport?.specialEducation ?? []
  cover.choices(special, [94, 214, 450, 22], { 資源班: '分散式資源班', 巡迴輔導: '巡迴輔導班', 集中式特殊教育班: '集中式特教班' })
  cover.field([98, 243, 145, 20], options.caseManager, '個管教師', { size: 12 })
  cover.field([294, 243, 165, 20], options.caseManagerTitle, '個管教師職稱', { size: 12 })
  const initialMeeting = input.content.meetingRecords?.find(meeting => meeting.meetingType === '期初會議')
  const dates = [options.draftedDate || initialMeeting?.date || '', options.committeeApprovalDate, options.curriculumApprovalDate, options.newStudentReviewDate, options.firstReviewDate, options.secondReviewDate]
  dates.forEach((value, index) => { if (value) cover.field([index === 0 ? 137 : index < 3 ? 207 : index === 3 ? 183 : 137, 270 + index * 27.3, 210, 19], date(value), '封面會議日期', { size: 12 }) })
  const p = await pdf.page(2, '壹、一、學生基本資料及家庭狀況')
  const put = (box: readonly [number, number, number, number], key: string, label: string, isDate = false) => p.field(box, isDate ? date(v(key)) : v(key), label, { size: 10.5 })
  put([94, 99, 46, 32], 'studentName', '姓名')
  p.field([229, 99, 53, 32], ({ male: '男', female: '女' } as Record<string, string>)[v('gender')] || v('gender'), '性別')
  put([321, 99, 82, 32], 'birthDate', '出生日期', true)
  put([477, 98, 68, 16], 'nationalId', '身分證字號')
  put([477, 117, 68, 16], 'studentId', '學號')
  put([94, 136, 188, 16], 'classEntryDate', '入班時間', true)
  p.field([320, 136, 83, 16], [v('grade'), v('className')].filter(Boolean).join('　'), '班級')
  put([477, 136, 68, 16], 'homeroomTeacher', '導師')
  put([99, 155, 445, 16], 'registeredAddress', '戶籍地址')
  p.field([99, 174, 445, 16], checks.sameAddress ? v('registeredAddress') : v('residentialAddress'), '居住地址')
  put([200, 193, 83, 15], 'committeeAssessmentDate', '鑑定日期', true)
  p.field([405, 193, 139, 15], [v('committeeDocumentNumber'), v('committeeSpecialEducationNumber')].filter(Boolean).join('　'), '鑑定文號')
  put([200, 212, 83, 15], 'committeeReassessmentDate', '重鑑日期', true)
  p.field([405, 212, 139, 15], [v('committeeDisabilityCategory'), v('committeeSeverity')].filter(Boolean).join('／'), '鑑定障礙類別及程度')
  put([200, 231, 83, 15], 'proofAssessmentDate', '證明鑑定日期', true)
  p.field([405, 231, 139, 15], [v('icfCategory') === 'other' ? v('icfOther') : v('icfCategory'), v('icfLevel')].filter(Boolean).join('／'), 'ICF 類別及程度')
  put([200, 249, 83, 15], 'proofReassessmentDate', '證明重鑑日期', true)
  put([360, 249, 184, 15], 'icdDiagnosis', 'ICD 診斷')
  const binary = (key: string, area: readonly [number, number, number, number]) => { if (v(key)) p.choices([v(key) === 'has' ? '有' : '無'], area) }
  binary('specialDisease', [94, 266, 105, 17])
  if (v('specialDisease') === 'has') {
    p.choices(['氣喘病', '心臟病', '癲癇'].filter(key => checks[key]).concat(checks.diseaseOther ? ['其他'] : []), [198, 265, 346, 18])
    p.supplement('特殊疾病說明', lines([['疾病狀況', v('diseaseDescription')], ['其他疾病', checks.diseaseOther ? v('diseaseOther') : '']]))
  }
  binary('regularMedication', [94, 294, 103, 24])
  if (v('regularMedication') === 'has') {
    records(family.medications).slice(0, 2).forEach((medicine, index) => {
      const y = 303 + index * 17
      for (const [column, key, label] of [[198, 'name', '藥物名稱'], [285, 'directions', '使／服用方式'], [405, 'purpose', '臨床用途'], [476, 'sideEffects', '副作用']] as const) p.field([column + 1, y, column === 198 ? 84 : column === 285 ? 117 : 67, 16], text(medicine[key]), label, { size: 9, min: 8 })
    })
    records(family.medications).slice(2).forEach((medicine, index) => p.supplement(`用藥資料 ${index + 3}`, lines([['名稱', medicine.name], ['用法', medicine.directions], ['用途', medicine.purpose], ['副作用', medicine.sideEffects]])))
  }
  for (const [key, description, y, label] of [['foodRestriction', 'foodRestrictionDescription', 339, '禁忌食物'], ['foodAllergy', 'foodAllergyDescription', 358, '食物過敏'], ['drugAllergy', 'drugAllergyDescription', 377, '藥物過敏']] as const) {
    binary(key, [150, y - 1, 125, 17])
    if (v(key) === 'has') p.field([333, y - 1, 210, 17], v(description), label)
  }
  if (v('otherSpecialCondition')) { p.choices(['其他'], [93, 394, 450, 18]); put([154, 395, 389, 16], 'otherSpecialCondition', '其他特殊狀況') }
  binary('hospital', [94, 421, 105, 18])
  if (v('hospital') === 'has') {
    p.field([165, 414, 378, 31], lines([['醫院', v('hospitalName')], ['科別', v('hospitalDepartment')], ['醫師', v('hospitalDoctor')]]).replace(/\n/g, '　'), '經常就診醫院')
    p.supplement('就診頻率', v('hospitalFrequency'))
  }
  for (const [prefix, y] of [['guardian', 451], [checks.sameGuardian ? 'guardian' : 'caregiver', 520]] as const) {
    const label = y === 451 ? '法定代理人' : '實際照顧者'
    if (v(prefix + 'Name')) p.choices([label === '法定代理人' ? '法定' : '實際'], [38, y, 55, 42])
    p.field([130, y, 65, 20], v(prefix + 'Name'), label + '姓名')
    if (v(prefix + 'Phone')) p.field([94, y + 17, 101, 45], `聯絡電話：\n${v(prefix + 'Phone')}`, label + '電話')
    for (const [x, width, key, title] of [[199, 26, 'Age', '年齡'], [229, 52, 'Education', '教育程度'], [286, 67, 'Occupation', '職業']] as const) p.field([x, y + 22, width, 22], v(prefix + key), label + title, { size: 9 })
    p.supplement(label + '關係', v(prefix + 'Relationship'))
  }
  const economic = ({ 'not-low-income': '非低收', 'near-low-income': '中低收入', 'low-income': '低收入' } as Record<string, string>)[v('economicStatus')]
  if (economic) p.choices([economic], [477, 475, 65, 52])
  p.field([112, 574, 84, 15], v('emergencyContact'), '緊急聯絡人')
  p.field([269, 574, 133, 15], v('emergencyPhone'), '緊急聯絡電話')
  p.field([472, 574, 72, 15], v('emergencyRelationship'), '緊急聯絡人關係')
  const siblings = [['siblingsOlderBrother', '兄'], ['siblingsYoungerBrother', '弟'], ['siblingsOlderSister', '姊'], ['siblingsYoungerSister', '妹']].filter(([key]) => v(key) !== '')
  if (siblings.length) p.field([112, 592, 431, 16], siblings.map(([key, label]) => `${label} ${v(key)} 人`).join('、'), '家中手足')
  for (const [key, y, first, second, title] of [['foreignParent', 611, 'fatherNationality', 'motherNationality', '國籍'], ['indigenousParent', 629, 'fatherIndigenousGroup', 'motherIndigenousGroup', '族籍']] as const) {
    if (v(key)) p.choices([v(key) === 'yes' ? '是' : '否'], [155, y - 2, 90, 17])
    if (v(key) === 'yes') {
      p.choices([...(v(first) ? ['父'] : []), ...(v(second) ? ['母'] : [])], [240, y - 2, 304, 17])
      p.field([307, y - 1, 64, 16], v(first), '父親' + title)
      p.field([445, y - 1, 96, 16], v(second), '母親' + title)
    }
  }
  binary('familyDisability', [228, 645, 125, 17])
  if (v('familyDisability') === 'has') p.field([365, 646, 178, 16], `${v('familyDisabilityRelationship')} ${v('familyDisabilityDescription')}`, '家庭障礙個案說明')
  p.field([95, 665, 448, 46], v('familySupportSituation'), '家庭支持現況')
  const supports = [['supportNone', '無此需要'], ['familyConsultation', '家庭諮詢'], ['parentEducation', '親職教育'], ['trainingInformation', '輔導轉介'], ['serviceApplication', '協助家長申請'], ['otherSupport', '其他']]
  p.choices(supports.filter(([key]) => checks[key] && (key === 'supportNone' || !checks.supportNone)).map(([, label]) => label), [94, 714, 449, 36])
  if (checks.otherSupport && !checks.supportNone) p.field([379, 734, 163, 15], v('otherSupportDescription'), '其他家庭支持服務')
  return { studentName: v('studentName') || '未填姓名', grade: v('grade'), className: v('className') }
}
