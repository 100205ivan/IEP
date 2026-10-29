import type { IepContent, IepRecord, StudentProfile, StudentSummary } from '../types/studentIep'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? '資料服務暫時無法使用。')
  return payload.data as T
}

export interface StudentFieldsPayload {
  name: string
  gender: string
  birthDate: string | null
  nationalId: string | null
  studentNumber: string
}

export function listStudents() { return request<StudentSummary[]>('/api/students') }
export function getStudent(studentId: string) { return request<StudentProfile>(`/api/students/${studentId}`) }
export function getStudentIeps(studentId: string) { return request<IepRecord[]>(`/api/students/${studentId}/ieps`) }
export function createAnnualIep(studentId: string, academicYear: number, mode: 'blank' | 'copy-basic', copyFromIepId?: string, content?: IepContent) {
  return request<IepRecord>(`/api/students/${studentId}/ieps`, { method: 'POST', body: JSON.stringify({ academicYear, mode, ...(copyFromIepId ? { copyFromIepId } : {}), ...(content ? { content } : {}) }) })
}
export function getStudentIep(iepId: string) { return request<IepRecord>(`/api/ieps/${iepId}`) }
export function deleteStudentIep(iepId: string, confirmation: string) {
  return request<{ id: string; studentId: string; academicYear: number }>(`/api/ieps/${iepId}`, { method: 'DELETE', body: JSON.stringify({ confirmation }) })
}
export function createStudentWithIep(student: StudentFieldsPayload, academicYear: number, content: IepContent) {
  return request<{ studentId: string; iepId: string }>('/api/students', { method: 'POST', body: JSON.stringify({ student, academicYear, content }) })
}
export function updateStudentIep(iepId: string, content: IepContent, student: StudentFieldsPayload, academicYear: number) {
  return request<IepRecord>(`/api/ieps/${iepId}`, { method: 'PUT', body: JSON.stringify({ content, student, academicYear }) })
}
