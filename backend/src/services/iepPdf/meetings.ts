import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { date } from './format.js'

export async function drawMeetings(pdf: IepPdfDocument, input: IepPdfRequest, student: { studentName: string; grade: string; className: string }) {
  const meetings = input.content.meetingRecords ?? []
  const blanks = [19, 20]
  for (const [i, meeting] of (meetings.length ? meetings : [undefined, undefined]).entries()) {
    const source = meeting ? meeting.meetingType === '期初會議' ? 19 : 20 : blanks[i]
    const p = await pdf.page(source, `IEP 會議紀錄${meeting ? '：' + date(meeting.date) : ''}`)
    const delta = source === 20 ? 15.7 : 0
    if (meeting) p.field([65, 80 + delta, 465, 18], `個別化教育計畫${meeting.meetingType === '其他' ? meeting.otherMeetingType : meeting.meetingType}紀錄`, '會議類型', { size: 14, min: 11, align: 'center' })
    p.field([126, 103 + delta, 169, 16], student.studentName, '會議學生姓名', { size: 11 })
    p.field([338, 103 + delta, 191, 16], [student.grade, student.className].filter(Boolean).join('　'), '會議班級', { size: 11 })
    p.field([126, 125 + delta, 169, 16], meeting ? date(meeting.date) : '', '開會日期', { size: 11 })
    p.field([361, 125 + delta, 168, 16], meeting?.location, '會議地點')
    p.field([102, 146 + delta, 193, 16], meeting?.chairperson, '會議主席')
    p.field([337, 146 + delta, 192, 16], meeting?.recorder, '會議紀錄者')
    const roles = source === 19 ? ['parent', 'student', 'administrator', 'general_teacher', 'special_education_teacher', 'professional'] : ['student', 'parent', 'administrator', 'general_teacher', 'special_education_teacher', 'professional']
    roles.forEach((role, index) => {
      const participants = meeting?.participants.filter(participant => participant.role === role) ?? []
      const value = participants.map(person => `${person.name}${person.title ? `（${person.title}）` : ''}${person.attended ? '' : '（未出席）'}`).join('\n')
      p.field([65 + index * 78.2, 205 + delta, 74.5, source === 20 ? 61 : 77], value, `與會人員：${role}`, { size: 9, min: 8 })
      // Names are printed for identification. The remaining empty area is reserved for handwritten signatures.
    })
    meeting?.participants.filter(person => person.role === 'other').forEach(person => p.supplement('其他與會人員', `${person.name}　${person.title}　${person.attended ? '出席' : '未出席'}`))
    const shift = source === 20 ? -4.6 : 0
    p.field([65, 330 + shift, 464, 194], meeting?.discussionTopics.filter(topic => topic.enabled).map(topic => `${topic.type === '其他' ? topic.otherName || '其他' : topic.type}\n${topic.summary}`).join('\n\n'), '會議說明與討論', { size: 11, min: 10 })
    p.field([65, 561 + shift, 464, 70], meeting?.decisions.map((decision, index) => `${index + 1}. ${decision.content}`).join('\n'), '會議決議事項', { size: 11, min: 10 })
    p.field([65, 668 + shift, 464, source === 20 ? 51 : 70], meeting ? meeting.hasMotions ? meeting.motions.map((motion, index) => `${index + 1}. ${motion.content}`).join('\n') : '無臨時動議。' : '', '臨時動議', { size: 11, min: 10 })
  }
}
