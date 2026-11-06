import type { DomainAnalysisPayload, DomainAnalysisResult } from '../types/domainAnalysis'

export async function generateDomainAnalysis(iepId: string, payload: DomainAnalysisPayload, signal?: AbortSignal): Promise<DomainAnalysisResult> {
  let response: Response
  try {
    response = await fetch(`/api/ieps/${encodeURIComponent(iepId)}/domain-analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('無法連線到 AI 分析服務，請確認後端已啟動。', { cause: error })
  }
  const body = await response.json().catch(() => null) as { ok?: boolean; data?: DomainAnalysisResult; error?: { message?: string } } | null
  if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error?.message ?? 'AI 分析暫時無法完成。')
  return body.data
}
