import { rgb } from 'pdf-lib'
import type { PdfOptions } from '../../schemas/iepPdfOptions.js'
import { referenceOptions } from '../../schemas/referenceForms.js'
import { PdfPainter, type Box } from './layout.js'

/** Rebuild the cover table as one grid so filling names cannot erase its rules. */
export function drawTeam(p: PdfPainter, members: NonNullable<PdfOptions['teamMembers']>) {
  const x = [42, 72, 149, 226, 278, 308, 405, 480, 534]
  const top = 434, titleBottom = 454, bodyTop = 474, rowHeight = 16.5, bodyBottom = 672, bottom = 692
  const ink = rgb(0, 0, 0), red = rgb(1, 0, 0), blue = rgb(0, .44, .75)
  p.clear([41, 433, 494, 259])
  const cell = (box: Box, value: string, size = 11, color = ink) => {
    if (!value) return
    const [left, y, width, height] = box, leading = size * 1.16
    const lines = p.wrap(value, width - 4, size)
    const start = y + (height - lines.length * leading) / 2 + (leading - size) / 2
    lines.forEach((line, i) => p.text(left + (width - p.textWidth(line, size)) / 2, start + i * leading, line, size, color))
  }
  const title = '團隊合作方式訂定個別化教育計畫', note = '（專業團隊及相關專業人員視需要而定）'
  const titleWidth = p.textWidth(title, 11), noteWidth = p.textWidth(note, 11)
  const titleX = x[0] + (x[8] - x[0] - titleWidth - noteWidth - 5) / 2
  p.text(titleX, 439, title, 11)
  p.text(titleX + titleWidth + 5, 439, note, 11, blue)
  for (let column = 0; column < 8; column++) cell([x[column], titleBottom, x[column + 1] - x[column], bodyTop - titleBottom], ['成員', '職稱', '姓名', '簽名'][column % 4], 12)
  cell([x[0], bodyTop, x[1] - x[0], bodyBottom - bodyTop], Array.from('學校專業團隊人員').join('\n'))
  cell([x[4], bodyTop, x[5] - x[4], bodyBottom - bodyTop], Array.from('特教相關專業人員').join('\n'))
  const titles: string[] = []
  referenceOptions.teamRoles.forEach((role, index) => {
    const column = index < 12 || index === 24 ? 0 : 4
    const row = index < 24 ? index % 12 : 12, y = row === 12 ? bodyBottom : bodyTop + row * rowHeight, height = row === 12 ? bottom - bodyBottom : rowHeight
    const roleLabel = role === '普通教師' ? '普教教師' : role === '教保/服務人員' ? '教保服務人員' : role
    const highlighted = [9, 10, 11, 12, 19, 20, 21, 22, 23, 24, 25].includes(index)
    cell([x[column + 1], y, x[column + 2] - x[column + 1], height], roleLabel, 11, highlighted ? red : ink)
    const active = members.filter(member => member.role === role && member.name.trim())
    const names = active.map(member => member.name.trim()).join('、'), width = x[column + 3] - x[column + 2]
    const fits = p.wrap(names, width - 8, 11).length === 1
    let shown = names
    if (!fits) { shown = p.wrap(names, width - 8, 11)[0]; while (shown && p.textWidth(shown + '…', 11) > width - 8) shown = Array.from(shown).slice(0, -1).join(''); shown += '…' }
    cell([x[column + 2], y, width, height], shown)
    if (!fits) p.supplement(role + '完整名單', names)
    for (const member of active) if (member.title && member.title !== role) titles.push(`${role}：${member.name}（${member.title}）`)
  })
  if (titles.length) {
    const note = '職稱補充：' + titles.join('；')
    if (p.textWidth(note, 11) <= 488) { p.clear([41, 704.5, 494, 3]); p.text(44, 695, note, 11) }
    else p.supplement('團隊成員職稱補充', titles.join('\n'))
  }
  cell([x[0], bodyBottom, x[1] - x[0], bottom - bodyBottom], '家長')
  cell([x[4], bodyBottom, x[5] - x[4], bottom - bodyBottom], '學生')
  // Paint the rules last. Signatures stay empty and every cell retains all four edges.
  for (const y of [top, bottom]) p.line(x[0], y, x[8], y, .9)
  for (const y of [titleBottom, bodyTop, bodyBottom]) p.line(x[0], y, x[8], y, .65)
  for (let row = 1; row < 12; row++) {
    const y = bodyTop + row * rowHeight
    p.line(x[1], y, x[4], y, .4); p.line(x[5], y, x[8], y, .4)
  }
  for (let column = 0; column <= 8; column++) p.line(x[column], column === 0 || column === 8 ? top : titleBottom, x[column], bottom, column === 0 || column === 4 || column === 8 ? .9 : .45)
}
