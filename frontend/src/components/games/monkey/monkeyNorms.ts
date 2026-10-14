// Copied from the HTML Monkey game; do not substitute the old React prototype.
export const MONKEY_NORMS: Record<number, { mean: number; sd: number }> = {
  6: { mean: .38, sd: .16 },
  7: { mean: .43, sd: .16 },
  8: { mean: .49, sd: .15 },
  9: { mean: .54, sd: .14 },
  10: { mean: .58, sd: .13 },
  11: { mean: .60, sd: .14 },
  12: { mean: .60, sd: .14 },
}

export function describeMonkeyPerformance(z: number) {
  return z < -1 ? '較弱' : z > 1 ? '較強' : '一般範圍'
}

export function monkeyPerformanceNote(z: number) {
  return z < -2 ? '明顯低於同齡研究平均' : z > 2 ? '明顯高於同齡研究平均' : ''
}
