import type { CptMetrics } from '../../../types/gameAssessment'

/** Source of every reference value below (Tables 1 and 2). */
export const CPT_NORM_SOURCE = 'Kanaka, N., Matsuda, T., Tomimoto, Y., Noda, Y., Matsushima, E., Matsuura, M., & Kojima, T. (2008). Measurement of development of cognitive and attention functions in children using continuous performance test. Psychiatry and Clinical Neurosciences, 62(2), 135–141. https://doi.org/10.1111/j.1440-1819.2008.01746.x'
export const CPT_NORM_SAMPLE = '日本健康女童 518 名（5–12 歲），CPT-X：400 個數字、目標 7 占 20%、刺激間隔 1500 ± 500 ms'

interface ReferenceMetric { mean: number; sd: number }
export type CptNormKey = 'hit' | 'omission' | 'commission' | 'targetCancel' | 'nonTargetCancel' | 'falseAlarm' | 'rt' | 'cvrt' | 'dPrime' | 'lnBeta'
export type CptNorm = Record<CptNormKey, ReferenceMetric>

const m = (mean: number, sd: number): ReferenceMetric => ({ mean, sd })
export const CPT_NORMS: Record<number, CptNorm> = {
  5: { targetCancel: m(4.77, 9.36), nonTargetCancel: m(19.14, 38.29), hit: m(.66, .23), falseAlarm: m(.01, .02), omission: m(22.74, 16.45), commission: m(2.89, 4.25), rt: m(769.11, 57.74), cvrt: m(35.34, 27.22), dPrime: m(2.17, 1.15), lnBeta: m(1.22, .47) },
  6: { targetCancel: m(1.67, 1.57), nonTargetCancel: m(9.14, 6.19), hit: m(.81, .12), falseAlarm: m(.01, .01), omission: m(13.29, 8.65), commission: m(1.62, 2), rt: m(737.02, 53.22), cvrt: m(22.94, 6.09), dPrime: m(2.87, .67), lnBeta: m(1.27, .36) },
  7: { targetCancel: m(.06, .89), nonTargetCancel: m(2.82, 3.36), hit: m(.96, .04), falseAlarm: m(0, 0), omission: m(2.24, 2.48), commission: m(1.46, 1.48), rt: m(623.41, 68.84), cvrt: m(18.79, 3.91), dPrime: m(4.26, .67), lnBeta: m(.86, .67) },
  8: { targetCancel: m(.38, .64), nonTargetCancel: m(2.1, 2.25), hit: m(.98, .03), falseAlarm: m(0, 0), omission: m(1.52, 2.05), commission: m(.9, 1.22), rt: m(598.74, 66.2), cvrt: m(17.81, 3.44), dPrime: m(4.51, .57), lnBeta: m(.83, .68) },
  9: { targetCancel: m(.26, .49), nonTargetCancel: m(1.23, 1.83), hit: m(.98, .02), falseAlarm: m(0, .01), omission: m(1.27, 1.63), commission: m(1.37, 1.82), rt: m(551.42, 59.92), cvrt: m(18, 3.79), dPrime: m(4.62, .54), lnBeta: m(.88, .77) },
  10: { targetCancel: m(.22, .49), nonTargetCancel: m(.67, .93), hit: m(.99, .02), falseAlarm: m(0, 0), omission: m(.75, 1.38), commission: m(.96, 1.1), rt: m(518.94, 55.95), cvrt: m(17.73, 3.72), dPrime: m(4.82, .39), lnBeta: m(.94, .7) },
  // RT 418.68 ms at 11 years (faster than at 12) is as published.
  11: { targetCancel: m(.06, .24), nonTargetCancel: m(.36, .9), hit: m(.99, .01), falseAlarm: m(0, 0), omission: m(.63, 1.07), commission: m(1.28, 1.56), rt: m(418.68, 52.43), cvrt: m(16.22, 3.36), dPrime: m(4.88, .38), lnBeta: m(.87, .63) },
  12: { targetCancel: m(0, 0), nonTargetCancel: m(.19, .4), hit: m(1, .01), falseAlarm: m(0, 0), omission: m(.37, .74), commission: m(.85, 1.17), rt: m(483.37, 61.1), cvrt: m(17.15, 3.13), dPrime: m(5, .31), lnBeta: m(.93, .48) },
}

/** higher: a larger value is better; lower: smaller is better; none: no direction (lnβ). */
type Direction = 'higher' | 'lower' | 'none'
/** The abilities the paper groups its parameters under, in plain words for teachers and judges. */
export type CptGroup = 'attention' | 'inhibition' | 'speed' | 'discrimination'
export const CPT_GROUPS: Record<CptGroup, { title: string; question: string }> = {
  attention: { title: '專注力', question: '能不能一直盯著畫面，不漏掉每一個 7？' },
  inhibition: { title: '衝動控制', question: '不是 7 的時候，能不能忍住不按？' },
  speed: { title: '反應速度與穩定度', question: '看到 7 多快按下？每次的速度穩不穩定？' },
  discrimination: { title: '整體辨別能力', question: '綜合命中與誤按，能不能清楚分辨 7 和其他數字？' },
}
const metricInfo: { key: CptNormKey; group: CptGroup; label: string; meaning: string; direction: Direction; value: (m: CptMetrics) => number | undefined; format: (v: number) => string }[] = [
  { key: 'hit', group: 'attention', label: '命中率（Hit）', meaning: '80 個 7 裡有按到的比例，越高越好', direction: 'higher', value: x => x.hitRate, format: v => `${(v * 100).toFixed(1)}%` },
  { key: 'omission', group: 'attention', label: '漏答（Omission）', meaning: '看到 7 卻沒按的次數，越少越好', direction: 'lower', value: x => x.omissionCount, format: v => `${v} 次` },
  { key: 'commission', group: 'inhibition', label: '誤按（Commission）', meaning: '不是 7 卻按下去的次數，越少越好', direction: 'lower', value: x => x.commissionCount, format: v => `${v} 次` },
  { key: 'targetCancel', group: 'inhibition', label: '搶先按 7（T-cancel）', meaning: '7 才出現 0.15 秒內就按，屬於猜測，越少越好', direction: 'lower', value: x => x.targetCancelCount, format: v => `${v} 次` },
  { key: 'nonTargetCancel', group: 'inhibition', label: '搶先按其他數字（N-cancel）', meaning: '其他數字出現 0.15 秒內就按，越少越好', direction: 'lower', value: x => x.nonTargetCancelCount, format: v => `${v} 次` },
  { key: 'falseAlarm', group: 'inhibition', label: '錯誤警報率（False）', meaning: '其他數字被按的比例（含搶先按）', direction: 'lower', value: x => x.falseAlarmRate, format: v => `${(v * 100).toFixed(2)}%` },
  { key: 'rt', group: 'speed', label: '平均反應時間（RT）', meaning: '看到 7 到按下平均花多久，越短越快', direction: 'lower', value: x => x.hitRate > 0 ? x.meanReactionTime : undefined, format: v => `${Math.round(v)} ms` },
  { key: 'cvrt', group: 'speed', label: '反應穩定度（CVRT）', meaning: '每次反應速度的起伏，越小越穩定', direction: 'lower', value: x => x.hitRate > 0 ? x.cvrt : undefined, format: v => `${v.toFixed(1)}%` },
  { key: 'dPrime', group: 'discrimination', label: '辨別力（d′）', meaning: '分辨 7 與其他數字的綜合能力，越高越好', direction: 'higher', value: x => x.dPrime, format: v => v.toFixed(2) },
  { key: 'lnBeta', group: 'discrimination', label: '作答傾向（lnβ）', meaning: '接近 1 最平衡；小於 1 偏向多按，大於 1 偏向少按', direction: 'none', value: x => x.lnBeta, format: v => v.toFixed(2) },
]

export type CptLevel = 'better' | 'typical' | 'watch' | 'concern' | 'reference'
export const CPT_LEVEL_LABELS: Record<CptLevel, string> = { better: '優於同齡', typical: '一般範圍', watch: '略需留意', concern: '明顯需留意', reference: '僅供對照' }
export const CPT_STANDARD_TEXT = '以同齡平均 ±1 SD 為一般範圍；往不利方向超過 1 SD 為「略需留意」，超過 2 SD 為「明顯需留意」；往有利方向超過 1 SD 為「優於同齡」。'

/** `score` is the Z score turned so that positive is always the favourable side (null without a direction or SD). */
export interface CptEvaluationRow { key: CptNormKey; group: CptGroup; label: string; meaning: string; value: string; reference: string; z: number | null; score: number | null; level: CptLevel }

/** Every parameter against the same-age reference. When the published SD is
 * 0 (rounded), a Z score is undefined; the row is shown for comparison only. */
export function evaluateCpt(metrics: CptMetrics, age: number): CptEvaluationRow[] {
  const norm = CPT_NORMS[age]
  if (!norm) return []
  return metricInfo.flatMap(info => {
    const value = info.value(metrics)
    if (value === undefined || !Number.isFinite(value)) return []
    const ref = norm[info.key]
    const z = ref.sd > 0 ? (value - ref.mean) / ref.sd : null
    let level: CptLevel = 'reference'
    if (z !== null && info.direction !== 'none') {
      const adverse = info.direction === 'higher' ? -z : z
      level = adverse > 2 ? 'concern' : adverse > 1 ? 'watch' : adverse < -1 ? 'better' : 'typical'
    }
    const score = z === null || info.direction === 'none' ? null : info.direction === 'higher' ? z : -z
    return [{ key: info.key, group: info.group, label: info.label, meaning: info.meaning, value: info.format(value), reference: `${info.format(ref.mean)}（SD ${info.key === 'hit' || info.key === 'falseAlarm' ? (ref.sd * 100).toFixed(1) + '%' : ref.sd}）`, z, score, level }]
  })
}

/** Used when the AI comment is unavailable: the same standard, stated plainly. */
export function ruleBasedCptComment(rows: CptEvaluationRow[], age: number) {
  const names = (level: CptLevel) => rows.filter(row => row.level === level).map(row => row.label.replace(/（.*）/, ''))
  const concern = names('concern'), watch = names('watch'), better = names('better')
  const parts = [`與 ${age} 歲研究樣本相比，`]
  if (!concern.length && !watch.length) parts.push('各項指標都在一般範圍內，本次持續注意力與反應抑制表現穩定。')
  else {
    if (concern.length) parts.push(`${concern.join('、')}明顯偏離同齡平均，`)
    if (watch.length) parts.push(`${watch.join('、')}略需留意，`)
    parts.push('建議在日常學習中多觀察相關表現，必要時再次施測或轉介專業評估。')
  }
  if (better.length) parts.push(`${better.join('、')}優於同齡。`)
  parts.push('本結果僅供參考，不能作為診斷依據。')
  return parts.join('')
}
