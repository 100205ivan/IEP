import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listStudents } from '../services/studentIepApi'
import type { StudentSummary } from '../types/studentIep'

type StudentSort = 'updated' | 'name' | 'studentNumber' | 'academicYear'

function formatDate(value: string) { return new Date(value).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) }
function latestAcademicYear(student: StudentSummary) { return student.ieps.reduce((latest, iep) => Math.max(latest, iep.academicYear), 0) }
function compareStudents(a: StudentSummary, b: StudentSummary, sort: StudentSort) {
  if (sort === 'name') return a.name.localeCompare(b.name, 'zh-Hant')
  if (sort === 'studentNumber') return a.studentNumber.localeCompare(b.studentNumber, 'zh-Hant', { numeric: true })
  if (sort === 'academicYear') return latestAcademicYear(b) - latestAcademicYear(a)
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

export function StudentListPage() {
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<StudentSort>('updated')
  const requestVersion = useRef(0)

  const loadStudents = useCallback(() => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    void listStudents().then((records) => { if (requestVersion.current === version) setStudents(records) }).catch((reason: unknown) => { if (requestVersion.current === version) setError(reason instanceof Error ? reason.message : '無法載入學生資料。') }).finally(() => { if (requestVersion.current === version) setLoading(false) })
  }, [])

  useEffect(() => {
    let active = true
    const version = ++requestVersion.current
    void listStudents().then((records) => { if (active && requestVersion.current === version) setStudents(records) }).catch((reason: unknown) => { if (active && requestVersion.current === version) setError(reason instanceof Error ? reason.message : '無法載入學生資料。') }).finally(() => { if (active && requestVersion.current === version) setLoading(false) })
    return () => { active = false }
  }, [])

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')
    return [...students].filter((student) => !normalizedQuery || student.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery) || student.studentNumber.toLocaleLowerCase('zh-TW').includes(normalizedQuery)).sort((a, b) => compareStudents(a, b, sort))
  }, [query, sort, students])
  const iepCount = useMemo(() => students.reduce((total, student) => total + student.ieps.length, 0), [students])

  return <div className="student-management-shell">
    <header className="site-header"><div className="header-content page-container"><div className="brand"><span className="brand-name">EyeEP</span><span className="brand-subtitle">個別化教育計畫</span></div><span className="student-management-header-label">學生管理</span></div></header>
    <main className="page-container student-list-page">
      <div className="student-list-heading"><div><p className="eyebrow">EyeEP</p><h1>學生管理</h1><p>快速找到學生，查看其歷年 IEP 紀錄。</p></div><Link className="button button--primary" to="/students/new">＋ 新增學生</Link></div>
      <section className="student-list-summary" aria-label="學生資料摘要"><div><span>學生總數</span><strong>{students.length}</strong></div><div><span>IEP 紀錄總數</span><strong>{iepCount}</strong></div></section>
      <section className="student-list-tools" aria-label="搜尋與排序"><label className="student-search-field">搜尋學生<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="輸入姓名或學號" /></label><label className="student-sort-field">排序方式<select value={sort} onChange={(event) => setSort(event.target.value as StudentSort)}><option value="updated">最近更新</option><option value="name">姓名</option><option value="studentNumber">學號</option><option value="academicYear">最新 IEP 學年度</option></select></label></section>
      {error && <section className="student-list-error" role="alert"><p>{error}</p><button className="button button--secondary" type="button" onClick={loadStudents}>重新載入</button></section>}
      {loading ? <p className="student-list-status">載入中…</p> : students.length === 0 && !error ? <section className="student-list-empty"><h2>目前尚無學生資料</h2><p>新增學生後，將在此管理學生與年度 IEP。</p><Link className="button button--primary" to="/students/new">＋ 新增第一位學生</Link></section> : !error && filteredStudents.length === 0 ? <section className="student-list-empty"><h2>找不到符合的學生</h2><p>請改用其他姓名或學號搜尋。</p></section> : !error && <div className="student-list-table-wrap"><table className="student-list-table"><thead><tr><th>學生姓名</th><th>學號</th><th>最新 IEP 學年度</th><th>IEP 數量</th><th>最近更新</th><th>操作</th></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.id}><td><Link className="student-name-link" to={`/students/${student.id}`}>{student.name}</Link></td><td>{student.studentNumber || '—'}</td><td>{latestAcademicYear(student) || '—'}</td><td>{student.ieps.length}</td><td>{formatDate(student.updatedAt)}</td><td><Link className="text-button" to={`/students/${student.id}`}>查看學生</Link></td></tr>)}</tbody></table></div>}
    </main>
  </div>
}
