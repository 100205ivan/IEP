import type { EducationSummaryDraft } from '../types/educationSummary'

export function isEducationSummaryDraft(value: unknown): value is EducationSummaryDraft {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return ['strengthNotes', 'weaknessNotes', 'overallNeeds'].every(key => typeof data[key] === 'string' && data[key].trim().length > 0 && data[key].length <= 5000)
    && Array.isArray(data.warnings) && data.warnings.length <= 10 && data.warnings.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 500)
}

export async function generateEducationSummary(deidentifiedText: string, signal: AbortSignal): Promise<EducationSummaryDraft> {
  let response: Response
  try {
    response = await fetch('/api/education-summary/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deidentifiedText }), signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('無法連線到摘要服務，請確認後端已啟動後再試。', { cause: error })
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: { message?: string } } | null
  if (!response.ok) throw new Error(payload?.error?.message || 'AI 摘要服務暫時無法使用，請稍後再試。')
  if (!payload?.ok || !isEducationSummaryDraft(payload.data)) throw new Error('AI 摘要格式不完整，請重新產生。')
  return payload.data
}
