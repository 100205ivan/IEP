import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { MonkeyQuestion, MonkeyQuestionResult, MonkeyResults, MonkeyWord } from '../../../types/gameAssessment'
import { makePractice, makeQuestions, MONKEY_TIMING, playQuestion, scoreAnswer, summarizeResults, WORD_EMOJI, WORDS, type PracticeQuestion } from './monkeyGameLogic'
import { describeMonkeyPerformance, MONKEY_NORMS, monkeyPerformanceNote } from './monkeyNorms'
import { GameAssessmentImport } from '../GameAssessmentImport'
import { localDateString } from '../../../utils/localDate'
import './monkey-game.css'

function AnswerEditor({ selected, limit, locked, onSelect, onUndo, onConfirm, confirmed = false, nextLabel, onNext }: {
  selected: MonkeyWord[]; limit: number; locked: boolean
  onSelect: (word: MonkeyWord) => void; onUndo: () => void; onConfirm: () => void
  confirmed?: boolean; nextLabel?: string; onNext?: () => void
}) {
  return <>
    <div className="grid">{WORDS.map(word => {
      const position = selected.indexOf(word)
      return <button type="button" className="word" key={word} disabled={locked || position >= 0 || selected.length >= limit} onClick={() => onSelect(word)}><span className="emoji">{WORD_EMOJI[word]}</span>{word}{position >= 0 && <b>{position + 1}</b>}</button>
    })}</div>
    <div className="answer-preview">{selected.length ? selected.map((word, index) => <span key={word}>{index + 1}. {word}</span>) : '尚未選擇答案'}</div>
    <div className="answer-actions">
      <button type="button" className="secondary" disabled={locked || !selected.length} onClick={onUndo}>上一步</button>
      {selected.length === limit && <button type="button" className="primary" disabled={locked && !confirmed} onClick={confirmed ? onNext : onConfirm}>{confirmed ? nextLabel : '確認答案'}</button>}
    </div>
  </>
}

function Practice({ item, index, onNext }: { item: PracticeQuestion; index: number; onNext: () => void }) {
  const [selected, setSelected] = useState<MonkeyWord[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const correct = item.reverse ? [...item.sequence].reverse() : item.sequence
  const correctAll = correct.every((word, i) => word === selected[i])
  return <section className="card">
    <div className="meta"><span>練習題 {index + 1} / 4</span></div><h1>先來練習</h1>
    <p>請按照<strong>{item.reverse ? '相反順序（最後一個先）' : '原本順序'}</strong>點選。</p>
    <div className="sequence">{item.sequence.map(word => <span key={word}>{word}</span>)}</div>
    <AnswerEditor selected={selected} limit={correct.length} locked={confirmed} onSelect={word => setSelected([...selected, word])} onUndo={() => setSelected(selected.slice(0, -1))} onConfirm={() => setConfirmed(true)} confirmed={confirmed} nextLabel={index === 3 ? '開始正式測驗' : '下一題'} onNext={onNext} />
    {confirmed && <div className="feedback"><strong>{correctAll ? '答對了！做得好！' : `這題的答案是：${correct.join(' → ')}`}</strong></div>}
  </section>
}

function TestQuestion({ question, index, onComplete }: { question: MonkeyQuestion; index: number; onComplete: (answer: MonkeyQuestionResult) => void }) {
  const [listening, setListening] = useState(true)
  const [selected, setSelected] = useState<MonkeyWord[]>([])
  const [locked, setLocked] = useState(false)
  const submitted = useRef(false)
  const nextTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearNextTimer = useCallback(() => clearTimeout(nextTimer.current), [])
  useEffect(() => playQuestion(question.sequence, () => setListening(false)), [question])
  useEffect(() => () => clearNextTimer(), [clearNextTimer])
  const confirm = () => {
    if (submitted.current) return
    submitted.current = true
    setLocked(true)
    const answer = scoreAnswer(question, selected)
    nextTimer.current = setTimeout(() => onComplete(answer), MONKEY_TIMING.nextQuestion)
  }
  return <section className="card">
    <div className="meta"><span>Level {question.level}</span><span>第 {index + 1} / 20 題</span></div>
    <div className="bar"><i style={{ width: `${(index + 1) / 20 * 100}%` }} /></div>
    {listening ? <div className="listen"><div className="sound">🔊</div><h1>請仔細聽</h1><p>詞語播放完後才可以作答。</p></div> : <>
      <h1>請用相反順序點選</h1><p>從剛才聽到的最後一個詞開始。</p>
      <AnswerEditor selected={selected} limit={question.sequence.length} locked={locked} onSelect={word => setSelected([...selected, word])} onUndo={() => setSelected(selected.slice(0, -1))} onConfirm={confirm} />
      <p className="answer-count">已選 {selected.length} / {question.sequence.length}</p>
    </>}
  </section>
}

function Results({ results, age, onRestart, resultId, assessmentDate, completedAt }: { results: MonkeyResults; age: number; onRestart: () => void; resultId: string; assessmentDate: string; completedAt: string }) {
  const norm = MONKEY_NORMS[age]
  const z = (results.totalScore - norm.mean) / norm.sd
  const note = monkeyPerformanceNote(z)
  return <section className="card">
    <div className="mascot">🏆</div><h1>完成測驗！</h1><p>以下是與同齡研究樣本相比的工作記憶表現。</p>
    <div className="score-box"><span>工作記憶總分</span><strong>{Math.round(results.totalScore * 100)}%</strong><small>（{results.correctPositions} / {results.totalPositions} 個位置）</small></div>
    <h2>各 Level 表現</h2><div className="levels">{results.levelScores.map((value, index) => <div key={index}><span>Level {index + 1}（{index + 2} 個詞）</span><b>{Math.round(value * 100)}%</b></div>)}</div>
    <div className="norm"><h2>同齡比較（{age} 歲）</h2><p>研究平均：{norm.mean.toFixed(2)}{'\u3000'}SD：{norm.sd.toFixed(2)}</p><p>與平均相差：<strong>{z.toFixed(2)} SD</strong></p><p>相對表現：<strong>{describeMonkeyPerformance(z)}</strong></p>{note && <p className="note">{note}</p>}</div>
    <GameAssessmentImport tool="猴子工作記憶遊戲" result={{ resultId, gameType: 'monkey', assessmentDate, completedAt, age, result: results, summary: `工作記憶總分 ${Math.round(results.totalScore * 100)}%（${results.correctPositions} / ${results.totalPositions} 個位置）；同齡比較：與平均相差 ${z.toFixed(2)} SD，相對表現：${describeMonkeyPerformance(z)}。` }} /><button type="button" className="primary" onClick={onRestart}>再玩一次</button><p className="fine">此結果僅供遊戲與研究樣本比較參考。</p>
  </section>
}

export function MonkeyGame() {
  const { studentId, iepId } = useParams()
  const [view, setView] = useState<'home' | 'age' | 'practice' | 'test' | 'results'>('home')
  const [age, setAge] = useState<number | null>(null)
  const [practice, setPractice] = useState<PracticeQuestion[]>([])
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [questions, setQuestions] = useState<MonkeyQuestion[]>([])
  const [testIndex, setTestIndex] = useState(0)
  const [answers, setAnswers] = useState<MonkeyQuestionResult[]>([])
  const [results, setResults] = useState<MonkeyResults | null>(null)
  const [resultId, setResultId] = useState('')
  const [assessmentDate, setAssessmentDate] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const restart = () => { setAge(null); setPractice([]); setQuestions([]); setAnswers([]); setResults(null); setView('home') }
  return <div className="monkey-game">
    <nav className="game-return"><Link to={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment` : '/iep/game-assessment'}>← 返回遊戲選擇頁</Link></nav>
    <main className="app">
      {view === 'home' && <section className="card"><div className="mascot">🐒</div><h1>猴子工作記憶遊戲</h1><p className="lead">聽一串詞語，再把它們用<strong>相反順序</strong>點回來！</p><div className="rules"><span>👂 仔細聽完詞語</span><span>🔄 從最後一個開始點</span><span>🎯 盡力完成每一題</span></div><button type="button" className="primary" onClick={() => setView('age')}>開始遊戲</button></section>}
      {view === 'age' && <section className="card"><h1>選擇你的年齡</h1><p>這會用來和同齡研究樣本比較結果。</p><div className="age-grid">{[6, 7, 8, 9, 10, 11, 12].map(value => <button type="button" className="age" key={value} onClick={() => { setAge(value); setPracticeIndex(0); setPractice(makePractice()); setView('practice') }}>{value}<small>歲</small></button>)}</div><button type="button" className="text" onClick={() => setView('home')}>← 回首頁</button></section>}
      {view === 'practice' && <Practice key={practiceIndex} item={practice[practiceIndex]} index={practiceIndex} onNext={() => {
        if (practiceIndex === 3) { setQuestions(makeQuestions()); setAnswers([]); setTestIndex(0); setView('test') }
        else setPracticeIndex(practiceIndex + 1)
      }} />}
      {view === 'test' && <TestQuestion key={testIndex} question={questions[testIndex]} index={testIndex} onComplete={answer => {
        const next = [...answers, answer]
        setAnswers(next)
        if (testIndex === 19) { setResults(summarizeResults(next)); setResultId(crypto.randomUUID()); setAssessmentDate(localDateString()); setCompletedAt(new Date().toISOString()); setView('results') }
        else setTestIndex(testIndex + 1)
      }} />}
      {view === 'results' && results && age !== null && <Results results={results} age={age} resultId={resultId} assessmentDate={assessmentDate} completedAt={completedAt} onRestart={restart} />}
    </main>
  </div>
}
