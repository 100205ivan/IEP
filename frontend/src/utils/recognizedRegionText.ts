// Reserved vocabulary for future, explicitly defined formatting rules.
// Adding a term does not enable spelling correction, substitution, or rewriting.
export const medicalOcrTerms: readonly string[] = [
  '職能治療',
  '語言治療',
  '精細動作',
  '粗大動作',
  '發展遲緩',
  '語言理解',
]

export function normalizeOcrBullets(text: string): string {
  // Preserve indentation and all line separators; replace only the leading marker.
  return text.replace(/^([^\S\r\n\u2028\u2029]*)[@®●•○◉◦▪■※]/gmu, '$1•')
}

export function postProcessOcrText(text: string): string {
  // Match spaces only, not newlines or tabs; never merge separate paragraphs.
  return normalizeOcrBullets(text)
    .replace(/[ \u00a0\u3000]{2,}/gu, ' ')
    .replace(/(\p{Script=Han})[ \u00a0\u3000]+(?=\p{Script=Han})/gu, '$1')
}

export function requireRecognizedRegionText(text: string): string {
  if (!text.trim()) throw new Error('此區域未辨識到文字，請重新框選')
  // Whitespace is checked only for emptiness; return the entire OCR output unchanged.
  return text
}
