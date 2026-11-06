import type { AssessmentRecord, ManualAssessmentPayload } from '../types/assessmentRecord'
import type { DocumentAnalysisResult, StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import type { GameAssessmentPayload, StoredGameAssessmentResult } from '../types/gameAssessment'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? '評量資料服務暫時無法使用。')
  return payload.data as T
}

export function listPersistedAssessments(iepId: string) { return request<AssessmentRecord[]>(`/api/ieps/${iepId}/assessments`) }
export function createManualAssessment(iepId: string, payload: ManualAssessmentPayload) { return request<AssessmentRecord>(`/api/ieps/${iepId}/assessments`, { method: 'POST', body: JSON.stringify(payload) }) }
export function updateManualAssessment(assessmentId: string, iepId: string, payload: ManualAssessmentPayload) { return request<AssessmentRecord>(`/api/assessments/${assessmentId}`, { method: 'PUT', body: JSON.stringify({ iepId, ...payload }) }) }
export function deleteManualAssessment(assessmentId: string, iepId: string) { return request<{ id: string }>(`/api/assessments/${assessmentId}`, { method: 'DELETE', body: JSON.stringify({ iepId }) }) }
export function createDocumentAnalysis(iepId: string, analysis: DocumentAnalysisResult) { return request<{ record: AssessmentRecord; analysis: StoredDocumentAnalysis }>(`/api/ieps/${iepId}/document-analyses`, { method: 'POST', body: JSON.stringify(analysis) }) }
export function getDocumentAnalysis(assessmentId: string, iepId: string) { return request<StoredDocumentAnalysis>(`/api/assessments/${assessmentId}/document-analysis?iepId=${encodeURIComponent(iepId)}`) }
export function deleteDocumentAnalysis(assessmentId: string, iepId: string) { return request<{ id: string }>(`/api/assessments/${assessmentId}/document-analysis`, { method: 'DELETE', body: JSON.stringify({ iepId }) }) }
export function createGameAssessment(iepId: string, result: GameAssessmentPayload) { return request<{ record: AssessmentRecord; result: StoredGameAssessmentResult }>(`/api/ieps/${iepId}/game-results`, { method: 'POST', body: JSON.stringify(result) }) }
export function getGameAssessmentResult(assessmentId: string, iepId: string) { return request<StoredGameAssessmentResult>(`/api/assessments/${assessmentId}/game-result?iepId=${encodeURIComponent(iepId)}`) }
export function deleteGameAssessment(assessmentId: string, iepId: string) { return request<{ id: string }>(`/api/assessments/${assessmentId}/game-result`, { method: 'DELETE', body: JSON.stringify({ iepId }) }) }

/** A short AI comment on a CPT result, from the de-identified norm comparison only. */
export function requestCptComment(body: { age: number; rows: { label: string; value: string; reference: string; z: number | null; level: string }[] }) { return request<{ comment: string }>('/api/cpt-comment', { method: 'POST', body: JSON.stringify(body) }) }
/** A short comment on a Monkey result against the same-grade norm, de-identified. */
export function requestMonkeyComment(body: { grade: number; rows: { label: string; value: string; reference: string; z: number | null; level: string }[] }) { return request<{ comment: string }>('/api/monkey-comment', { method: 'POST', body: JSON.stringify(body) }) }
