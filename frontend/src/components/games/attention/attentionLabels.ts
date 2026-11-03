import type { EngagementLabel, ExpressionLabel } from '../../../types/attention'

export const expressionLabels: Record<ExpressionLabel, string> = { angry: '生氣樣態', disgust: '厭惡樣態', fear: '害怕樣態', happy: '開心樣態', sad: '難過樣態', surprise: '驚訝樣態', neutral: '中性表情', contempt: '輕蔑樣態', uncertain: '不確定／無法判定' }
export const engagementLabels: Record<EngagementLabel, string> = { engaged: '參與樣態', disengaged: '未參與樣態', uncertain: '不確定／無法判定' }
