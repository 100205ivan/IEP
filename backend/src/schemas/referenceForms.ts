import { readFileSync } from 'node:fs'
import { z } from 'zod'
export const referenceOptions = JSON.parse(readFileSync(new URL('../../assets/reference-form-options.json', import.meta.url), 'utf8')) as {
  supportGroups: { id: string; title: string; top: number; bottom: number; options: string[] }[];
  inclusiveGroups: { id: string; title: string; top: number; bottom: number; options: string[] }[];
  courseCategories: { name: string; top: number; height: number }[];
  impactGroups: Record<string, { id: string; title: string; top: number; bottom: number }[]>;
  teamRoles: string[];
}
const text = z.string().max(2000).default(''), notes = z.string().max(20_000).default('')
const date = z.union([z.literal(''), z.iso.date()]).default('')
const need = z.enum(['', '無需求', '有需求']).default('')
const supportGroup = (values: string[]) => z.object({ status: need, selected: z.array(z.enum(values as [string, ...string[]])).default([]), notes: z.record(z.string(), text).default({}), description: notes }).passthrough()
export const referenceSupportSchema = z.object({ curriculumNeed: need, supportNeed: need, groups: z.object(Object.fromEntries(referenceOptions.supportGroups.map(group => [group.id, supportGroup(group.options).optional()]))).default({}) }).passthrough()
export const inclusiveReferenceRowsSchema = z.array(z.object({ item: z.enum(referenceOptions.inclusiveGroups.flatMap(group => group.options) as [string, ...string[]]), selected: z.boolean().default(false), execution: notes, startDate: date, endDate: date, frequency: text, responsible: text }).passthrough()).max(11).superRefine((rows, context) => {
  const items = new Set<string>()
  rows.forEach((row, i) => { if (items.has(row.item)) context.addIssue({ code: 'custom', path: [i, 'item'], message: '融合教育項目不可重複。' }); items.add(row.item); if (row.selected && row.startDate && row.endDate && row.endDate < row.startDate) context.addIssue({ code: 'custom', path: [i, 'endDate'], message: '融合教育結束日期不可早於開始日期。' }) })
})
const adjustmentNeed = z.enum(['', '無須調整', '須調整']).default('')
export const adjustmentSubjectDetailsSchema = z.record(z.string().max(255), z.object({ teacher: text, content: adjustmentNeed, process: adjustmentNeed, environment: adjustmentNeed, assessment: adjustmentNeed }).passthrough())
export const behaviorExecutionSchema = z.partialRecord(z.enum(['antecedent', 'teaching', 'consequence']), z.object({ executionMethod: notes, implementers: text, progress: notes }).passthrough())
export const teamMembersSchema = z.array(z.object({ id: z.string().min(1).max(100), role: z.enum(referenceOptions.teamRoles as [string, ...string[]]), name: z.string().trim().max(120), title: text }).passthrough()).max(100).superRefine((members, context) => { const ids = new Set<string>(); members.forEach((member, i) => { if (ids.has(member.id)) context.addIssue({ code: 'custom', path: [i, 'id'], message: '團隊成員識別碼不可重複。' }); ids.add(member.id) }) })
