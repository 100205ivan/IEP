import type { MonkeyResults } from '../../../types/gameAssessment'
import { CPT_LEVEL_LABELS, CPT_STANDARD_TEXT, type CptLevel } from '../cpt/cptNorms'

/** Source of the reference values below (Study 1, Table 2). */
export const MONKEY_NORM_SOURCE = 'Van de Weijer-Bergsma, E., Kroesbergen, E. H., Jolani, S., & Van Luit, J. E. H. (2016). The Monkey game: A computerized verbal working memory task for self-reliant administration in primary school children. Behavior Research Methods, 48, 756–771. https://doi.org/10.3758/s13428-015-0607-y'
export const MONKEY_NORM_SAMPLE = '荷蘭 31 所國小、一至六年級學童約 4,176 名；倒序詞語廣度作業，5 個 Level（2～6 個詞）各 4 題'
export const MONKEY_STANDARD_TEXT = CPT_STANDARD_TEXT

/** Mean proportion correct by grade (Grade 1 = first year of primary school). */
export const MONKEY_NORMS: Record<number, { mean: number; sd: number }> = {
  1: { mean: .38, sd: .16 },
  2: { mean: .46, sd: .15 },
  3: { mean: .51, sd: .14 },
  4: { mean: .57, sd: .12 },
  5: { mean: .58, sd: .13 },
  6: { mean: .62, sd: .13 },
}
export const GRADE_LABELS: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }
export const gradeLabel = (grade: number) => `國小${GRADE_LABELS[grade]}年級`
/** Saved results also keep an age; the usual age at the start of each grade in Taiwan. */
export const gradeToAge = (grade: number) => grade + 6

export interface MonkeyEvaluation { grade: number; value: string; reference: string; z: number; level: CptLevel; percent: number }

/** The total score against the same-grade reference, with the CPT standard (±1 / ±2 SD). */
export function evaluateMonkey(results: MonkeyResults, grade: number): MonkeyEvaluation | null {
  const norm = MONKEY_NORMS[grade]
  if (!norm) return null
  const z = (results.totalScore - norm.mean) / norm.sd
  const level: CptLevel = z < -2 ? 'concern' : z < -1 ? 'watch' : z > 1 ? 'better' : 'typical'
  return { grade, value: `${(results.totalScore * 100).toFixed(1)}%`, reference: `${(norm.mean * 100).toFixed(0)}%（SD ${(norm.sd * 100).toFixed(0)}%）`, z, level, percent: results.totalScore }
}

/** Longest list recalled fully in reverse at least once. */
export function longestSpan(results: MonkeyResults) {
  return results.questionResults.filter(q => q.correctPositions === q.totalPositions).reduce((best, q) => Math.max(best, q.totalPositions), 0)
}

/** Used when the AI comment is unavailable: the same standard, stated plainly. */
export function ruleBasedMonkeyComment(results: MonkeyResults, evaluation: MonkeyEvaluation) {
  const span = longestSpan(results)
  const verdict = { better: '高於同年級平均，工作記憶表現良好。', typical: '落在同年級的一般範圍內。', watch: '略低於同年級平均，建議多觀察。', concern: '明顯低於同年級平均，建議搭配其他評量確認。', reference: '' }[evaluation.level]
  return `與${gradeLabel(evaluation.grade)}研究樣本相比，本次工作記憶總分 ${evaluation.value}，${verdict}`
    + (span ? `最長能完整倒序記住 ${span} 個詞。` : '本次沒有完整答對的題目。')
    + (evaluation.level === 'watch' || evaluation.level === 'concern' ? '課堂上可將口語指令分段說明，並搭配視覺提示。' : '')
    + '本結果僅供參考，不能作為診斷依據。'
}

/** The summary saved with the assessment record. */
export function monkeySummaryText(results: MonkeyResults, evaluation: MonkeyEvaluation, comment?: string) {
  return `工作記憶總分 ${evaluation.value}（${results.correctPositions} / ${results.totalPositions} 個位置）；最長完整倒序 ${longestSpan(results)} 個詞；與${gradeLabel(evaluation.grade)}相比：${CPT_LEVEL_LABELS[evaluation.level]}（Z ${evaluation.z.toFixed(2)}）。`
    + (comment ? `評語：${comment}` : '')
}

/** De-identified rows for the comment API: the normed total plus each Level (no norm). */
export function monkeyCommentRows(results: MonkeyResults, evaluation: MonkeyEvaluation) {
  return [
    { label: '工作記憶總分（各題平均答對比例）', value: evaluation.value, reference: evaluation.reference, z: evaluation.z, level: evaluation.level },
    ...results.levelScores.map((score, index) => ({ label: `Level ${index + 1}（${index + 2} 個詞）答對比例`, value: `${Math.round(score * 100)}%`, reference: '無同年級資料', z: null, level: 'reference' as const })),
  ]
}
