import type { AssessmentDocument, ConfirmedAssessmentText, KnownAssessmentIdentifiers, Redaction, RedactionType } from '../types/assessmentDocument'

export const REDACTION_LABELS: Record<RedactionType, string> = {
  studentName: '學生姓名', nationalId: '身分證字號', birthDate: '出生日期', phone: '電話', address: '地址',
  guardianName: '家長／法定代理人姓名', school: '學校名稱', doctorName: '醫師姓名', medicalInstitution: '醫療院所名稱',
}
const TOKENS: Record<RedactionType, string> = {
  studentName: '[學生姓名]', nationalId: '[身分證字號]', birthDate: '[出生日期]', phone: '[電話]', address: '[地址]',
  guardianName: '[家長／法定代理人姓名]', school: '[學校名稱]', doctorName: '[醫師姓名]', medicalInstitution: '[醫療院所名稱]',
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const name = '[\\p{Script=Han}]{2,4}(?:[·．][\\p{Script=Han}]{1,4})?|[A-Za-z][A-Za-z .’\'-]{1,60}'
const date = '(?:(?:民國|西元)[ \\t]*)?\\d{2,4}[ \\t]*(?:[./-][ \\t]*\\d{1,2}[ \\t]*[./-][ \\t]*\\d{1,2}|年[ \\t]*\\d{1,2}[ \\t]*月[ \\t]*\\d{1,2}[ \\t]*日?)'

/** Deterministic first-pass masking; teacher review is still required. */
export function deidentifyAssessmentReport(text: string, known: KnownAssessmentIdentifiers = {}) {
  const candidates: Redaction[] = []
  const protectedRanges = [...text.matchAll(/\[(?:學生姓名|身分證字號|出生日期|電話|地址|家長／法定代理人姓名|學校名稱|醫師姓名|醫療院所名稱)\]/g)].map(match => ({ start: match.index, end: match.index + match[0].length }))
  const add = (type: RedactionType, start: number, value: string) => {
    if (!value.trim() || protectedRanges.some(range => start < range.end && start + value.length > range.start)) return
    candidates.push({ type, replacement: TOKENS[type], start, end: start + value.length })
  }
  const matchAll = (type: RedactionType, pattern: RegExp, group = 0) => {
    for (const match of text.matchAll(pattern)) {
      const value = match[group]
      if (value) add(type, match.index + (group ? match[0].lastIndexOf(value) : 0), value)
    }
  }
  const maskValueEverywhere = (type: RedactionType, value: string) => {
    if (value.trim().length < 2) return
    // PDF text runs can insert spaces inside Chinese names; don't bridge lines.
    const pattern = /^[\p{Script=Han}]+$/u.test(value) ? [...value].map(escape).join('[ \\t\\u00a0\\u3000]*') : escape(value)
    matchAll(type, new RegExp(pattern, 'gu'))
  }
  for (const [type, values] of Object.entries(known)) for (const value of values) maskValueEverywhere(type as RedactionType, value.trim())

  const labelled = (type: RedactionType, labels: string, valuePattern: string) => {
    const pattern = new RegExp(`(?:${labels})[ \\t]*[:：][ \\t]*(${valuePattern})`, 'gmu')
    for (const match of text.matchAll(pattern)) {
      const value = match[1].trim()
      if (!value || /^(?:未填|不詳|無|姓名|主治|評估)$/.test(value)) continue
      const start = match.index + match[0].lastIndexOf(match[1])
      add(type, start, value)
      // Names disclosed in a header can recur later in the narrative.
      if (['studentName', 'guardianName', 'doctorName', 'school', 'medicalInstitution'].includes(type)) maskValueEverywhere(type, value)
    }
  }
  labelled('guardianName', '家長(?:姓名)?|父親(?:姓名)?|母親(?:姓名)?|法定代理人(?:姓名)?|監護人(?:姓名)?|主要照顧者(?:姓名)?', name)
  labelled('doctorName', '(?:主治|評估|診斷|轉介)?醫師(?:姓名)?|醫生(?:姓名)?', name)
  labelled('studentName', String.raw`學生姓名|個案姓名|受測者姓名|病童姓名|個案|受測者|病童|(?<![\p{Script=Han}])姓名`, name)
  labelled('birthDate', '出生日期|出生年月日|生日|生於|DOB|Date of Birth', date)
  matchAll('nationalId', /(?<![A-Za-z0-9])[A-Za-z][ \t]*[12](?:[ \t]*\d){8}(?!\d)/g)
  matchAll('phone', /(?<!\d)(?:\+886[ \t-]?(?:\(0\)[ \t-]?)?(?:9\d{2}[ \t-]?\d{3}[ \t-]?\d{3}|[2-8][ \t-]?\d{3,4}[ \t-]?\d{4})|09\d{2}[ \t-]?\d{3}[ \t-]?\d{3}|\(?0[2-8]\d?\)?[ \t-]?\d{3,4}[ \t-]?\d{4})(?:[ \t]*(?:分機|ext\.?|#)[ \t]*\d{1,6})?(?!\d)/giu)
  labelled('address', '戶籍地址|通訊地址|居住地址|住址|地址', '[^\\r\\n，,；;。]{3,120}?(?=[ \\t]+[\\p{Script=Han}A-Za-z]{2,12}[：:]|$|[\\r\\n，,；;。])')
  matchAll('address', /(?:臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹[縣市]|嘉義[縣市]|宜蘭縣|苗栗縣|彰化縣|南投縣|雲林縣|屏東縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)[\p{Script=Han}\d０-９○〇之\- \t]{2,80}?\d+(?:之\d+)?號(?:[ \t]*\d+樓(?:之\d+)?)?/gu)
  labelled('school', '就讀學校|學校名稱|學校|校名', '[\\p{Script=Han}A-Za-z0-9○〇（）()·． \\t]{2,60}?(?:國民小學|國民中學|高級中學|高級職業學校|特殊教育學校|實驗學校|國小|國中|高中|大學|幼兒園)')
  labelled('medicalInstitution', '醫療院所(?:名稱)?|醫療機構(?:名稱)?|醫院(?:名稱)?|就診院所|院所(?:名稱)?', '[\\p{Script=Han}A-Za-z0-9○〇（）()·． \\t]{2,60}?(?:醫學中心|醫院|診所|衛生所)')
  // Explicit organization suffixes; never mask generic references such as「醫院」.
  for (const [type, pattern] of [
    ['school', /(?:^|[\s：:，,；;。])([\p{Script=Han}○〇]{2,30}(?:國民小學|國民中學|高級中學|特殊教育學校|國小|國中|高中|大學|幼兒園))(?=$|[\s，,；;。])/gmu],
    ['medicalInstitution', /(?:^|[\s：:，,；;。])([\p{Script=Han}○〇]{2,30}(?:醫學中心|醫院|診所|衛生所))(?=$|[\s，,；;。])/gmu],
  ] as const) matchAll(type, pattern, 1)

  // Prefer the widest overlapping span, then preserve deterministic discovery order.
  const accepted: Redaction[] = []
  for (const candidate of candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
    if (!accepted.some(item => candidate.start < item.end && candidate.end > item.start)) accepted.push(candidate)
  }
  accepted.sort((a, b) => a.start - b.start)
  let cursor = 0, deidentifiedText = ''
  for (const item of accepted) { deidentifiedText += text.slice(cursor, item.start) + item.replacement; cursor = item.end }
  deidentifiedText += text.slice(cursor)
  return { deidentifiedText, redactions: accepted }
}

export function confirmAssessmentDocument(document: AssessmentDocument, reviewed: boolean): { document: AssessmentDocument; input: ConfirmedAssessmentText } {
  if (!reviewed || !document.deidentificationCompleted || !document.deidentifiedText.trim()) throw new Error('請先完成去識別化並確認預覽內容。')
  const confirmedAt = new Date().toISOString()
  return { document: { ...document, confirmedAt }, input: { deidentifiedText: document.deidentifiedText, confirmedAt } }
}
