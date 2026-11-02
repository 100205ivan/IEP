export function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
export function text(value: unknown): string { return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '' }
export function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [] }
export function records(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)) : [] }
export function date(value: unknown, withYear = true): string {
  const input = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const [year, month, day] = input.split('-').map(Number)
  return withYear ? `${year - 1911}/${month}/${day}` : `${month}/${day}`
}
export function selected(choice: unknown): string[] { return strings(object(choice).selected) }
export function choiceText(choice: unknown): string {
  const value = object(choice)
  return selected(choice).map(item => item === '其他' ? `其他：${text(value.other)}` : item).join('、')
}
export function lines(items: [label: string, value: unknown][]): string {
  return items.filter(([, value]) => text(value).trim()).map(([label, value]) => `${label}：${text(value)}`).join('\n')
}
export function criterion(value: unknown): string {
  const v = object(value)
  if (v.type === '百分比') return v.percentage === '' ? '' : `${text(v.percentage)}%`
  if (v.type === '等級') return `等級 ${text(v.passingLevel)}`
  if (v.type === '自訂') return text(v.text)
  return v.total === '' && v.successful === '' ? '' : `${text(v.successful)}／${text(v.total)} 次`
}
