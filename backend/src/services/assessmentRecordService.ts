import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import type { DocumentAnalysisFields, GameAssessmentFields, ManualAssessmentFields } from '../schemas/assessmentRecord.js'

type AssessmentRow = RowDataPacket & { id: string; student_id: string; iep_id: string; source: 'manual' | 'document' | 'monkey' | 'cpt'; assessment_date: string; assessment_type: string; other_assessment_type: string; assessment_tool: string; evaluator: string; summary: string; created_at: string; updated_at: string }
type DocumentAnalysisRow = RowDataPacket & { assessment_record_id: string; analysis_id: string; document_info: string | DocumentAnalysisFields['documentInfo']; overall_summary: string; domains: string | DocumentAnalysisFields['domains']; warnings: string | DocumentAnalysisFields['warnings']; analyzed_at: string; created_at: string }
type GameAssessmentResultRow = RowDataPacket & { assessment_record_id: string; result_id: string; game_type: 'monkey' | 'cpt'; assessment_date: string; completed_at: string; result_summary: string; result_data: string | { age: number; result: GameAssessmentFields['result'] }; created_at: string }

function mapAssessment(row: AssessmentRow) {
  return { id: row.id, studentId: row.student_id, iepId: row.iep_id, source: row.source, assessmentDate: row.assessment_date, assessmentType: row.assessment_type, otherAssessmentType: row.other_assessment_type, assessmentTool: row.assessment_tool, evaluator: row.evaluator, summary: row.summary, createdAt: row.created_at, updatedAt: row.updated_at }
}

function parseJson<T>(value: string | T): T { return typeof value === 'string' ? JSON.parse(value) as T : value }
function mysqlDate(value: string | null): string { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10) }
function mapDocumentAnalysis(row: DocumentAnalysisRow) {
  return { id: row.analysis_id, assessmentRecordId: row.assessment_record_id, documentInfo: parseJson<DocumentAnalysisFields['documentInfo']>(row.document_info), overallSummary: row.overall_summary, domains: parseJson<DocumentAnalysisFields['domains']>(row.domains), warnings: parseJson<DocumentAnalysisFields['warnings']>(row.warnings), analyzedAt: row.analyzed_at, createdAt: row.created_at }
}
function mapGameAssessmentResult(row: GameAssessmentResultRow) {
  const data = parseJson<{ age: number; result: GameAssessmentFields['result'] }>(row.result_data)
  return { id: row.result_id, assessmentRecordId: row.assessment_record_id, gameType: row.game_type, assessmentDate: mysqlDate(row.assessment_date), completedAt: row.completed_at, summary: row.result_summary, age: data.age, result: data.result, createdAt: row.created_at }
}

export async function listPersistedAssessments(iepId: string) {
  const [rows] = await pool.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE iep_id = ? AND source IN (?, ?, ?, ?) ORDER BY assessment_date DESC, created_at DESC', [iepId, 'manual', 'document', 'monkey', 'cpt'])
  return rows.map(mapAssessment)
}

export async function createManualAssessment(iepId: string, fields: ManualAssessmentFields) {
  const connection = await pool.getConnection()
  const id = randomUUID()
  try {
    await connection.beginTransaction()
    const [iepRows] = await connection.execute<(RowDataPacket & { student_id: string })[]>('SELECT student_id FROM ieps WHERE id = ? FOR UPDATE', [iepId])
    const iep = iepRows[0]
    if (!iep) { await connection.rollback(); return null }
    const now = new Date()
    await connection.execute<ResultSetHeader>('INSERT INTO assessment_records (id, student_id, iep_id, source, assessment_date, assessment_type, other_assessment_type, assessment_tool, evaluator, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, iep.student_id, iepId, 'manual', fields.assessmentDate, fields.assessmentType, fields.otherAssessmentType, fields.assessmentTool, fields.evaluator, fields.summary, now, now])
    await connection.commit()
    const [rows] = await pool.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ?', [id])
    return rows[0] ? mapAssessment(rows[0]) : null
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function updateManualAssessment(assessmentId: string, iepId: string, fields: ManualAssessmentFields) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ? FOR UPDATE', [assessmentId])
    const record = rows[0]
    if (!record) { await connection.rollback(); return { kind: 'not_found' as const } }
    if (record.iep_id !== iepId) { await connection.rollback(); return { kind: 'wrong_iep' as const } }
    if (record.source !== 'manual') { await connection.rollback(); return { kind: 'not_manual' as const } }
    const now = new Date()
    await connection.execute('UPDATE assessment_records SET assessment_date = ?, assessment_type = ?, other_assessment_type = ?, assessment_tool = ?, evaluator = ?, summary = ?, updated_at = ? WHERE id = ?', [fields.assessmentDate, fields.assessmentType, fields.otherAssessmentType, fields.assessmentTool, fields.evaluator, fields.summary, now, assessmentId])
    await connection.commit()
    const [updatedRows] = await pool.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ?', [assessmentId])
    return { kind: 'updated' as const, record: updatedRows[0] ? mapAssessment(updatedRows[0]) : null }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function deleteManualAssessment(assessmentId: string, iepId: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ? FOR UPDATE', [assessmentId])
    const record = rows[0]
    if (!record) { await connection.rollback(); return { kind: 'not_found' as const } }
    if (record.iep_id !== iepId) { await connection.rollback(); return { kind: 'wrong_iep' as const } }
    if (record.source !== 'manual') { await connection.rollback(); return { kind: 'not_manual' as const } }
    await connection.execute<ResultSetHeader>('DELETE FROM assessment_records WHERE id = ?', [assessmentId])
    await connection.commit()
    return { kind: 'deleted' as const, id: assessmentId }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function createDocumentAnalysis(iepId: string, analysis: DocumentAnalysisFields) {
  const connection = await pool.getConnection()
  const assessmentRecordId = randomUUID()
  try {
    await connection.beginTransaction()
    const [iepRows] = await connection.execute<(RowDataPacket & { student_id: string })[]>('SELECT student_id FROM ieps WHERE id = ? FOR UPDATE', [iepId])
    const iep = iepRows[0]
    if (!iep) { await connection.rollback(); return { kind: 'not_found' as const } }
    const now = new Date()
    const assessmentDate = mysqlDate(analysis.documentInfo.assessmentDate)
    const assessmentTool = analysis.documentInfo.assessmentTools.join('、').slice(0, 255) || '評估文件分析'
    const evaluator = (analysis.documentInfo.evaluator ?? '').slice(0, 120)
    const otherAssessmentType = (analysis.documentInfo.documentType ?? '').slice(0, 120)
    await connection.execute<ResultSetHeader>('INSERT INTO assessment_records (id, student_id, iep_id, source, assessment_date, assessment_type, other_assessment_type, assessment_tool, evaluator, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [assessmentRecordId, iep.student_id, iepId, 'document', assessmentDate, '評估文件', otherAssessmentType, assessmentTool, evaluator, analysis.overallSummary, now, now])
    await connection.execute<ResultSetHeader>('INSERT INTO assessment_document_analyses (assessment_record_id, analysis_id, document_info, overall_summary, domains, warnings, analyzed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [assessmentRecordId, analysis.id, JSON.stringify(analysis.documentInfo), analysis.overallSummary, JSON.stringify(analysis.domains), JSON.stringify(analysis.warnings), now, now])
    await connection.commit()
    const [recordRows] = await pool.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ?', [assessmentRecordId])
    const [analysisRows] = await pool.execute<DocumentAnalysisRow[]>('SELECT * FROM assessment_document_analyses WHERE assessment_record_id = ?', [assessmentRecordId])
    return { kind: 'created' as const, record: mapAssessment(recordRows[0]), analysis: mapDocumentAnalysis(analysisRows[0]) }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function getDocumentAnalysis(assessmentRecordId: string) {
  const [rows] = await pool.execute<DocumentAnalysisRow[]>('SELECT a.* FROM assessment_document_analyses a INNER JOIN assessment_records r ON r.id = a.assessment_record_id WHERE a.assessment_record_id = ? AND r.source = ?', [assessmentRecordId, 'document'])
  return rows[0] ? mapDocumentAnalysis(rows[0]) : null
}

export async function deleteDocumentAnalysis(assessmentId: string, iepId: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ? FOR UPDATE', [assessmentId])
    const record = rows[0]
    if (!record) { await connection.rollback(); return { kind: 'not_found' as const } }
    if (record.iep_id !== iepId) { await connection.rollback(); return { kind: 'wrong_iep' as const } }
    if (record.source !== 'document') { await connection.rollback(); return { kind: 'not_document' as const } }

    const [analysisRows] = await connection.execute<RowDataPacket[]>('SELECT assessment_record_id FROM assessment_document_analyses WHERE assessment_record_id = ? FOR UPDATE', [assessmentId])
    if (!analysisRows[0]) { await connection.rollback(); return { kind: 'analysis_missing' as const } }

    await connection.execute<ResultSetHeader>('DELETE FROM assessment_document_analyses WHERE assessment_record_id = ?', [assessmentId])
    await connection.execute<ResultSetHeader>('DELETE FROM assessment_records WHERE id = ?', [assessmentId])
    await connection.commit()
    return { kind: 'deleted' as const, id: assessmentId }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function createGameAssessment(iepId: string, game: GameAssessmentFields) {
  const connection = await pool.getConnection()
  const assessmentRecordId = randomUUID()
  try {
    await connection.beginTransaction()
    const [iepRows] = await connection.execute<(RowDataPacket & { student_id: string })[]>('SELECT student_id FROM ieps WHERE id = ? FOR UPDATE', [iepId])
    const iep = iepRows[0]
    if (!iep) { await connection.rollback(); return { kind: 'not_found' as const } }
    const now = new Date()
    const isMonkey = game.gameType === 'monkey'
    await connection.execute<ResultSetHeader>('INSERT INTO assessment_records (id, student_id, iep_id, source, assessment_date, assessment_type, other_assessment_type, assessment_tool, evaluator, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [assessmentRecordId, iep.student_id, iepId, game.gameType, game.assessmentDate, isMonkey ? '認知遊戲評量' : '注意力遊戲評量', '', isMonkey ? '猴子工作記憶遊戲' : '數字注意力挑戰（CPT）', 'EyeEP 遊戲評量', game.summary, now, now])
    await connection.execute<ResultSetHeader>('INSERT INTO game_assessment_results (assessment_record_id, result_id, game_type, assessment_date, completed_at, result_summary, result_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [assessmentRecordId, game.resultId, game.gameType, game.assessmentDate, new Date(game.completedAt), game.summary, JSON.stringify({ age: game.age, result: game.result }), now])
    await connection.commit()
    const [recordRows] = await pool.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ?', [assessmentRecordId])
    const [resultRows] = await pool.execute<GameAssessmentResultRow[]>('SELECT * FROM game_assessment_results WHERE assessment_record_id = ?', [assessmentRecordId])
    return { kind: 'created' as const, record: mapAssessment(recordRows[0]), result: mapGameAssessmentResult(resultRows[0]) }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function getGameAssessmentResult(assessmentRecordId: string, iepId: string) {
  const [rows] = await pool.execute<GameAssessmentResultRow[]>('SELECT g.* FROM game_assessment_results g INNER JOIN assessment_records r ON r.id = g.assessment_record_id WHERE g.assessment_record_id = ? AND r.iep_id = ? AND r.source IN (?, ?)', [assessmentRecordId, iepId, 'monkey', 'cpt'])
  return rows[0] ? mapGameAssessmentResult(rows[0]) : null
}

export async function deleteGameAssessment(assessmentId: string, iepId: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<AssessmentRow[]>('SELECT * FROM assessment_records WHERE id = ? FOR UPDATE', [assessmentId])
    const record = rows[0]
    if (!record) { await connection.rollback(); return { kind: 'not_found' as const } }
    if (record.iep_id !== iepId) { await connection.rollback(); return { kind: 'wrong_iep' as const } }
    if (record.source !== 'monkey' && record.source !== 'cpt') { await connection.rollback(); return { kind: 'not_game' as const } }
    const [resultRows] = await connection.execute<RowDataPacket[]>('SELECT assessment_record_id FROM game_assessment_results WHERE assessment_record_id = ? FOR UPDATE', [assessmentId])
    if (!resultRows[0]) { await connection.rollback(); return { kind: 'result_missing' as const } }
    await connection.execute<ResultSetHeader>('DELETE FROM game_assessment_results WHERE assessment_record_id = ?', [assessmentId])
    await connection.execute<ResultSetHeader>('DELETE FROM assessment_records WHERE id = ?', [assessmentId])
    await connection.commit()
    return { kind: 'deleted' as const, id: assessmentId }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}
