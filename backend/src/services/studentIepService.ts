import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import type { StudentFields } from '../schemas/studentIep.js'

type StudentRow = RowDataPacket & { id: string; name: string; gender: string; birth_date: string | null; national_id: string | null; student_number: string; created_at: string; updated_at: string }
type IepRow = RowDataPacket & { id: string; student_id: string; academic_year: number; content: string | Record<string, unknown>; created_at: string; updated_at: string }

function nullableDate(value: string | null | undefined) { return value || null }
function parseContent(value: IepRow['content']): Record<string, unknown> { return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value }
function mapStudent(row: StudentRow) { return { id: row.id, name: row.name, gender: row.gender, birthDate: row.birth_date, nationalId: row.national_id ? '[已設定]' : null, studentNumber: row.student_number, createdAt: row.created_at, updatedAt: row.updated_at } }
function mapIep(row: IepRow) { return { id: row.id, studentId: row.student_id, academicYear: row.academic_year, content: parseContent(row.content), createdAt: row.created_at, updatedAt: row.updated_at } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function copyBasicStudentFamily(sourceContent: Record<string, unknown>, student: StudentRow) {
  const sourceFamily = sourceContent.studentFamilyForm
  if (!isRecord(sourceFamily)) return null
  const values = isRecord(sourceFamily.values) ? cloneJson(sourceFamily.values) : {}
  const checks = isRecord(sourceFamily.checks) ? cloneJson(sourceFamily.checks) : {}
  const medications = Array.isArray(sourceFamily.medications) ? cloneJson(sourceFamily.medications) : []
  values.studentName = student.name
  values.gender = student.gender
  values.birthDate = student.birth_date ?? ''
  values.studentId = student.student_number
  values.nationalId = student.national_id ?? ''
  return { values, checks, medications }
}

export async function createStudentWithIep(student: StudentFields, academicYear: number, content: Record<string, unknown>) {
  const connection = await pool.getConnection()
  const studentId = randomUUID()
  const iepId = randomUUID()
  try {
    await connection.beginTransaction()
    const now = new Date()
    await connection.execute<ResultSetHeader>('INSERT INTO students (id, name, gender, birth_date, national_id, student_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [studentId, student.name, student.gender, nullableDate(student.birthDate), student.nationalId || null, student.studentNumber, now, now])
    await connection.execute<ResultSetHeader>('INSERT INTO ieps (id, student_id, academic_year, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [iepId, studentId, academicYear, JSON.stringify(content), now, now])
    await connection.commit()
    return { studentId, iepId }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function createIepForStudent(studentId: string, academicYear: number, mode: 'blank' | 'copy-basic', copyFromIepId: string | undefined, content: Record<string, unknown>) {
  const connection = await pool.getConnection()
  const iepId = randomUUID()
  try {
    await connection.beginTransaction()
    const [studentRows] = await connection.execute<StudentRow[]>('SELECT * FROM students WHERE id = ? FOR UPDATE', [studentId])
    if (!studentRows[0]) { await connection.rollback(); return { kind: 'not_found' as const } }
    const [existingRows] = await connection.execute<(RowDataPacket & { id: string })[]>('SELECT id FROM ieps WHERE student_id = ? AND academic_year = ? LIMIT 1', [studentId, academicYear])
    if (existingRows[0]) { await connection.rollback(); return { kind: 'duplicate' as const, iepId: existingRows[0].id } }
    let newContent = cloneJson(content)
    let inheritedFromAcademicYear: number | undefined
    if (mode === 'copy-basic') {
      if (!copyFromIepId) { await connection.rollback(); return { kind: 'source_required' as const } }
      const [sourceRows] = await connection.execute<IepRow[]>('SELECT * FROM ieps WHERE id = ? AND student_id = ? FOR UPDATE', [copyFromIepId, studentId])
      const source = sourceRows[0]
      if (!source) { await connection.rollback(); return { kind: 'source_not_found' as const } }
      if (source.academic_year >= academicYear) { await connection.rollback(); return { kind: 'source_not_earlier' as const, sourceAcademicYear: source.academic_year } }
      const basicStudentFamily = copyBasicStudentFamily(parseContent(source.content), studentRows[0])
      if (!basicStudentFamily) { await connection.rollback(); return { kind: 'source_invalid' as const } }
      inheritedFromAcademicYear = source.academic_year
      newContent = {
        ...newContent,
        studentFamilyForm: basicStudentFamily,
        basicInfoReviewNotice: { inheritedFromAcademicYear, requiresReview: true as const, message: `基本資料沿用自${inheritedFromAcademicYear}學年度，請確認年級、班級、導師、鑑定證明、醫療、緊急聯絡人及家庭支持需求。` },
      }
    }
    const now = new Date()
    await connection.execute<ResultSetHeader>('INSERT INTO ieps (id, student_id, academic_year, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [iepId, studentId, academicYear, JSON.stringify(newContent), now, now])
    await connection.execute('UPDATE students SET updated_at = ? WHERE id = ?', [now, studentId])
    await connection.commit()
    const record = await getIep(iepId)
    return { kind: 'created' as const, record }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function listStudents() {
  const [rows] = await pool.query<(StudentRow & RowDataPacket)[]>('SELECT s.* FROM students s ORDER BY s.updated_at DESC')
  const [iepRows] = await pool.query<(RowDataPacket & { id: string; student_id: string; academic_year: number })[]>('SELECT id, student_id, academic_year FROM ieps ORDER BY academic_year DESC')
  return rows.map((row) => ({ ...mapStudent(row), ieps: iepRows.filter((iep) => iep.student_id === row.id).map((iep) => ({ id: iep.id, academicYear: iep.academic_year })) }))
}

export async function getStudent(studentId: string) {
  const [rows] = await pool.execute<StudentRow[]>('SELECT * FROM students WHERE id = ?', [studentId])
  return rows[0] ? mapStudent(rows[0]) : null
}

export async function getStudentIeps(studentId: string) {
  const [rows] = await pool.execute<IepRow[]>('SELECT * FROM ieps WHERE student_id = ? ORDER BY academic_year DESC', [studentId])
  return rows.map(mapIep)
}

export async function getIep(iepId: string) {
  const [rows] = await pool.execute<IepRow[]>('SELECT * FROM ieps WHERE id = ?', [iepId])
  return rows[0] ? mapIep(rows[0]) : null
}

export async function deleteIep(iepId: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [iepRows] = await connection.execute<IepRow[]>('SELECT * FROM ieps WHERE id = ? FOR UPDATE', [iepId])
    const iep = iepRows[0]
    if (!iep) { await connection.rollback(); return null }
    await connection.execute<ResultSetHeader>('DELETE FROM ieps WHERE id = ?', [iepId])
    await connection.execute('UPDATE students SET updated_at = ? WHERE id = ?', [new Date(), iep.student_id])
    await connection.commit()
    return { id: iep.id, studentId: iep.student_id, academicYear: iep.academic_year }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function updateIep(iepId: string, content: Record<string, unknown>, student?: StudentFields, academicYear?: number) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [iepRows] = await connection.execute<IepRow[]>('SELECT student_id, academic_year FROM ieps WHERE id = ? FOR UPDATE', [iepId])
    const iep = iepRows[0]
    if (!iep) { await connection.rollback(); return null }
    const now = new Date()
    if (student) await connection.execute('UPDATE students SET name = ?, gender = ?, birth_date = ?, national_id = ?, student_number = ?, updated_at = ? WHERE id = ?', [student.name, student.gender, nullableDate(student.birthDate), student.nationalId || null, student.studentNumber, now, iep.student_id])
    await connection.execute('UPDATE ieps SET academic_year = COALESCE(?, academic_year), content = ?, updated_at = ? WHERE id = ?', [academicYear ?? null, JSON.stringify(content), now, iepId])
    await connection.commit()
    return getIep(iepId)
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
}
