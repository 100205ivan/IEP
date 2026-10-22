export const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五'] as const
export const periods = ['早自習', '第一節', '第二節', '第三節', '第四節', '午休', '第五節', '第六節', '第七節'] as const

export type Weekday = typeof weekdays[number]
export type PeriodId = typeof periods[number]
