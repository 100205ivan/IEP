import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow } from './flow.js'
import { date } from './format.js'

export async function drawMeetings(pdf: IepPdfDocument, input: IepPdfRequest, student: { studentName: string; grade: string; className: string }) {
  const meetings = input.content.meetingRecords ?? []
  if (!meetings.length) {
    for (const source of [19, 20]) {
      const p = await pdf.page(source, 'IEP 會議紀錄'), delta = source === 20 ? 15.7 : 0
      p.field([126, 103 + delta, 169, 16], student.studentName, '會議學生姓名')
      p.field([338, 103 + delta, 191, 16], [student.grade, student.className].filter(Boolean).join('　'), '會議班級')
    }
    return
  }
  const roles: Record<string, string> = { parent: '家長', student: '學生', administrator: '行政人員', general_teacher: '普通班教師', special_education_teacher: '特殊教育教師', professional: '相關專業人員', other: '其他人員' }
  for (const [index, meeting] of meetings.entries()) {
    const f = await FormFlow.create(pdf, input, `IEP 會議紀錄（第 ${index + 1} 次）`)
    await f.fields([['會議類型', meeting.meetingType === '其他' ? meeting.otherMeetingType : meeting.meetingType]])
    await f.grid([['學生姓名', student.studentName], ['班級', [student.grade, student.className].filter(Boolean).join('　')], ['開會日期', date(meeting.date)], ['開會地點', meeting.location], ['主席', meeting.chairperson], ['紀錄', meeting.recorder]])
    if (meeting.participants.length) {
      await f.heading('與會人員及簽名（簽名欄供紙本簽署）')
      await f.table(['身分', '姓名', '職稱／補充', '出席', '簽名'], [90, 90, 190, 60, 90], meeting.participants.map(person => [roles[person.role] || person.role, person.name, person.title, person.attended ? '出席' : '未出席', '']), { minHeight: 50 })
    }
    await f.heading('一、會議說明與討論')
    for (const [i, topic] of meeting.discussionTopics.filter(topic => topic.enabled).entries()) {
      const label = `討論事項 ${i + 1}：${topic.type === '其他' ? topic.otherName || '其他' : topic.type}`
      if (topic.summary.trim()) await f.paragraph(label, topic.summary)
      else await f.heading(label)
    }
    await f.heading('二、會議決議事項')
    for (const [i, decision] of meeting.decisions.entries()) await f.paragraph(`決議 ${i + 1}`, decision.content)
    await f.heading('三、臨時動議')
    if (meeting.hasMotions) for (const [i, motion] of meeting.motions.entries()) await f.paragraph(`動議 ${i + 1}`, motion.content)
    else await f.paragraph('臨時動議', '無臨時動議。')
  }
}
