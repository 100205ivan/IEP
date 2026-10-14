export type ExtractionMethod = 'text-layer' | 'ocr'
export type RedactionType = 'studentName' | 'nationalId' | 'birthDate' | 'phone' | 'address' | 'guardianName' | 'school' | 'doctorName' | 'medicalInstitution'

export interface Redaction {
  type: RedactionType
  replacement: string
  /** Offsets in normalizedText; no duplicate plaintext identifiers in this log. */
  start: number
  end: number
}

export type KnownAssessmentIdentifiers = Partial<Record<RedactionType, readonly string[]>>

export interface ExtractedAssessmentText {
  fileName: string
  pageCount: number
  extractionMethod: ExtractionMethod
  rawText: string
  normalizedText: string
  truncated: boolean
}

export interface AssessmentDocument extends ExtractedAssessmentText {
  deidentifiedText: string
  redactions: Redaction[]
  deidentificationCompleted: true
  confirmedAt: string | null
}

/** Future AI input deliberately excludes rawText, file name and original identifiers. */
export interface ConfirmedAssessmentText {
  deidentifiedText: string
  confirmedAt: string
}
