import type { PdfOptions } from '../../schemas/iepPdfOptions.js'
import { referenceOptions } from '../../schemas/referenceForms.js'
import { PdfPainter } from './layout.js'

/** Fill the source team grid; never redraw or widen its name/signature columns. */
export function drawTeam(p: PdfPainter, members: NonNullable<PdfOptions['teamMembers']>) {
  const tops = [475.7, 491.8, 507.9, 524.1, 540.2, 557.7, 575.2, 591.3, 607.5, 623.6, 639.7, 656.8]
  referenceOptions.teamRoles.forEach((role, index) => {
    const active = members.filter(member => member.role === role && member.name.trim())
    const left = index < 12 || index === 24, row = index < 24 ? index % 12 : 12
    p.field([left ? 150 : 399, row === 12 ? 674.4 : tops[row], left ? 47 : 60, 15], active.map(member => member.name.trim()).join('、'), role + '完整名單', { size: 11, align: 'center' })
    for (const member of active) if (member.title.trim()) p.supplement('團隊成員職稱', `${role}：${member.name}（${member.title}）`)
  })
}
