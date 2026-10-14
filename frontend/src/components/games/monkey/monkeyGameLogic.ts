import type { MonkeyQuestion, MonkeyQuestionResult, MonkeyResults, MonkeyWord } from '../../../types/gameAssessment'

export const WORDS: MonkeyWord[] = ['貓', '狗', '魚', '月亮', '房子', '花', '車子', '蘋果', '星星']
export const WORD_EMOJI: Record<MonkeyWord, string> = { 貓: '🐱', 狗: '🐶', 魚: '🐟', 月亮: '🌙', 房子: '🏠', 花: '🌸', 車子: '🚗', 蘋果: '🍎', 星星: '⭐' }
export const MONKEY_TIMING = { initial: 450, wordEnd: 650, wordError: 200, sequenceEnd: 500, noSpeech: 1000, nextQuestion: 240 } as const

export interface PracticeQuestion { sequence: MonkeyWord[]; reverse: boolean }

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const makeSequence = (length: number) => shuffle(WORDS).slice(0, length)
export const makePractice = (): PracticeQuestion[] => [
  { sequence: makeSequence(2), reverse: false }, { sequence: makeSequence(2), reverse: false },
  { sequence: makeSequence(3), reverse: true }, { sequence: makeSequence(3), reverse: true },
]

export function makeQuestions(): MonkeyQuestion[] {
  let id = 1
  return Array.from({ length: 5 }, (_, level) => Array.from({ length: 4 }, () => ({
    id: id++, level: level + 1, sequence: makeSequence(level + 2),
  }))).flat()
}

export function scoreAnswer(question: MonkeyQuestion, playerAnswer: MonkeyWord[]): MonkeyQuestionResult {
  const correctAnswer = [...question.sequence].reverse()
  const correctPositions = correctAnswer.filter((word, i) => word === playerAnswer[i]).length
  return { ...question, correctAnswer, playerAnswer, correctPositions, totalPositions: correctAnswer.length, score: correctPositions / correctAnswer.length }
}

export function summarizeResults(answers: MonkeyQuestionResult[]): MonkeyResults {
  const correctPositions = answers.reduce((sum, result) => sum + result.correctPositions, 0)
  const totalPositions = answers.reduce((sum, result) => sum + result.totalPositions, 0)
  const levelScores = [1, 2, 3, 4, 5].map(level => {
    const subset = answers.filter(result => result.level === level)
    return subset.reduce((sum, result) => sum + result.score, 0) / subset.length
  })
  return { totalScore: correctPositions / totalPositions, correctPositions, totalPositions, levelScores, questionResults: answers }
}

// The speech chain follows the HTML onend/onerror timers, including the delay
// after the last word. Cleanup is needed when React unmounts or StrictMode replays.
export function playQuestion(sequence: MonkeyWord[], ready: () => void): () => void {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout>
  const schedule = (callback: () => void, delay: number) => {
    if (!cancelled) timer = setTimeout(() => { if (!cancelled) callback() }, delay)
  }
  if (!('speechSynthesis' in window)) {
    schedule(ready, MONKEY_TIMING.noSpeech)
  } else {
    const say = (index: number) => {
      if (index === sequence.length) { schedule(ready, MONKEY_TIMING.sequenceEnd); return }
      const utterance = new SpeechSynthesisUtterance(sequence[index])
      utterance.lang = 'zh-TW'
      utterance.rate = .78
      utterance.onend = () => schedule(() => say(index + 1), MONKEY_TIMING.wordEnd)
      utterance.onerror = () => schedule(() => say(index + 1), MONKEY_TIMING.wordError)
      window.speechSynthesis.speak(utterance)
    }
    schedule(() => say(0), MONKEY_TIMING.initial)
  }
  return () => {
    cancelled = true
    clearTimeout(timer)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }
}
