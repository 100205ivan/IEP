import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { MonkeyQuestion, MonkeyQuestionResult, MonkeyResults, MonkeyWord } from '../../../types/gameAssessment'
import { makePractice, makeQuestions, makeSequence, MONKEY_TIMING, playQuestion, scoreAnswer, summarizeResults, WORD_EMOJI, WORDS, type PracticeQuestion } from './monkeyGameLogic'
import { describeMonkeyPerformance, MONKEY_NORMS, monkeyPerformanceNote } from './monkeyNorms'
import { GameAssessmentImport } from '../GameAssessmentImport'
import { localDateString } from '../../../utils/localDate'
import './monkey-game.css'
import type { AttentionPhase } from '../../../types/attention'
import { useAttentionTracker } from '../attention/useAttentionTracker'
import { AttentionPanel } from '../attention/AttentionPanel'
import { AttentionSummary } from '../attention/AttentionSummary'
import { attentionSummaryText } from '../attention/attentionLogic'

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

/** With `demo`, each answer is followed by the correct order and a button,
 * so a first-time player sees what was being asked. */
function TestQuestion({ question, index, total, demo = false, onComplete, onPhase }: { question: MonkeyQuestion; index: number; total: number; demo?: boolean; onComplete: (answer: MonkeyQuestionResult) => void; onPhase: (phase: AttentionPhase) => void }) {
  const [listening, setListening] = useState(true)
  const [selected, setSelected] = useState<MonkeyWord[]>([])
  const [locked, setLocked] = useState(false)
  const [revealed, setRevealed] = useState<MonkeyQuestionResult | null>(null)
  const submitted = useRef(false)
  const nextTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearNextTimer = useCallback(() => clearTimeout(nextTimer.current), [])
  useEffect(() => {
    onPhase('listening')
    return playQuestion(question.sequence, () => { setListening(false); onPhase('answering') })
  }, [question, onPhase])
  useEffect(() => () => clearNextTimer(), [clearNextTimer])
  const confirm = () => {
    if (submitted.current) return
    submitted.current = true
    setLocked(true)
    const answer = scoreAnswer(question, selected)
    if (demo) setRevealed(answer)
    else nextTimer.current = setTimeout(() => onComplete(answer), MONKEY_TIMING.nextQuestion)
  }
  return <section className="card">
    <div className="meta"><span>{demo ? `展示版・${question.sequence.length} 個詞` : `Level ${question.level}`}</span><span>第 {index + 1} / {total} 題</span></div>
    <div className="bar"><i style={{ width: `${(index + 1) / total * 100}%` }} /></div>
    {listening ? <div className="listen"><div className="sound">🔊</div><h1>請仔細聽</h1><p>詞語播放完後才可以作答。</p></div> : <>
      <h1>請用相反順序點選</h1><p>從剛才聽到的最後一個詞開始。</p>
      <AnswerEditor selected={selected} limit={question.sequence.length} locked={locked} onSelect={word => setSelected([...selected, word])} onUndo={() => setSelected(selected.slice(0, -1))} onConfirm={confirm} />
      <p className="answer-count">已選 {selected.length} / {question.sequence.length}</p>
      {revealed && <div className="feedback">
        <strong>{revealed.correctPositions === revealed.totalPositions ? '全部答對！' : `答對 ${revealed.correctPositions} / ${revealed.totalPositions} 個位置`}</strong>
        <p>你聽到：{question.sequence.join(' → ')}<br />正確答案（倒過來）：{revealed.correctAnswer.join(' → ')}</p>
        <button type="button" className="primary" onClick={() => onComplete(revealed)}>{index + 1 === total ? '看結果' : '下一題'}</button>
      </div>}
    </>}
  </section>
}

function Results({ results, age, onRestart, resultId, assessmentDate, completedAt }: { results: MonkeyResults; age: number; onRestart: () => void; resultId: string; assessmentDate: string; completedAt: string }) {
  const norm = MONKEY_NORMS[age]
  const z = (results.totalScore - norm.mean) / norm.sd
  const note = monkeyPerformanceNote(z)
  const summary = `工作記憶總分 ${Math.round(results.totalScore * 100)}%（${results.correctPositions} / ${results.totalPositions} 個位置）；同齡比較：與平均相差 ${z.toFixed(2)} SD，相對表現：${describeMonkeyPerformance(z)}。` + attentionSummaryText(results.attention)
  return <section className="card">
    <div className="mascot">🏆</div><h1>完成測驗！</h1><p>以下是與同齡研究樣本相比的工作記憶表現。</p>
    <div className="score-box"><span>工作記憶總分</span><strong>{Math.round(results.totalScore * 100)}%</strong><small>（{results.correctPositions} / {results.totalPositions} 個位置）</small></div>
    <h2>各 Level 表現</h2><div className="levels">{results.levelScores.map((value, index) => <div key={index}><span>Level {index + 1}（{index + 2} 個詞）</span><b>{Math.round(value * 100)}%</b></div>)}</div>
    <div className="norm"><h2>同齡比較（{age} 歲）</h2><p>研究平均：{norm.mean.toFixed(2)}{'\u3000'}SD：{norm.sd.toFixed(2)}</p><p>與平均相差：<strong>{z.toFixed(2)} SD</strong></p><p>相對表現：<strong>{describeMonkeyPerformance(z)}</strong></p>{note && <p className="note">{note}</p>}</div>
    <AttentionSummary report={results.attention} />
    <GameAssessmentImport tool="猴子工作記憶遊戲" result={{ resultId, gameType: 'monkey', assessmentDate, completedAt, age, result: results, summary }} /><button type="button" className="primary" onClick={onRestart}>再玩一次</button><p className="fine">此結果僅供遊戲與研究樣本比較參考。</p>
  </section>
}

// The demo: one question each with 2, 3 and 4 words, about a minute.
const makeDemoQuestions = (): MonkeyQuestion[] => [2, 3, 4].map((length, index) => ({ id: index + 1, level: index + 1, sequence: makeSequence(length) }))

function DemoResults({ answers, attention, onRestart, fullTestLink }: { answers: MonkeyQuestionResult[]; attention: MonkeyResults['attention']; onRestart: () => void; fullTestLink: string }) {
  const correct = answers.reduce((sum, answer) => sum + answer.correctPositions, 0)
  const total = answers.reduce((sum, answer) => sum + answer.totalPositions, 0)
  return <section className="card">
    <div className="mascot">🏆</div><h1>展示完成！</h1>
    <div className="score-box"><span>答對位置</span><strong>{correct} / {total}</strong><small>（共 {answers.length} 題）</small></div>
    <div className="levels">{answers.map(answer => <div key={answer.id}><span>{answer.totalPositions} 個詞</span><b>{answer.correctPositions} / {answer.totalPositions}</b></div>)}</div>
    <div className="norm"><h2>這個遊戲在測什麼</h2>
      <p><strong>工作記憶</strong>：把聽到的詞記在腦中，再倒過來說出來。詞越多越難，能記住的長度就是工作記憶的容量。</p>
      <h2>正式版還會做什麼</h2>
      <p>・先練習 4 題，再正式測 20 題（2～6 個詞，共 5 個 Level）</p>
      <p>・依年齡和同齡研究樣本比較，算出相對表現</p>
      <p>・可開啟鏡頭，記錄聆聽和作答時面向螢幕的時間與表情</p>
      <p>・結果可一鍵匯入學生的 IEP 評量紀錄</p>
    </div>
    <AttentionSummary report={attention} />
    <p className="fine">展示版結果不會儲存，也不會匯入 IEP。</p>
    <button type="button" className="primary" onClick={onRestart}>再試一次</button>
    <Link className="demo-full-link" to={fullTestLink} onClick={onRestart}>玩完整版 →</Link>
  </section>
}

export function MonkeyGame() {
  const tracker = useAttentionTracker()
  const { studentId, iepId } = useParams()
  const demo = useSearchParams()[0].get('demo') === '1'
  const [demoDone, setDemoDone] = useState(false)
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
  const beginDemo = () => { tracker.begin('listening'); setQuestions(makeDemoQuestions()); setAnswers([]); setTestIndex(0); setDemoDone(false); setView('test') }
  const restart = () => { tracker.reset(); setDemoDone(false); setAge(null); setPractice([]); setQuestions([]); setAnswers([]); setResults(null); setView('home') }
  return <div className="monkey-game">
    <nav className="game-return"><Link to={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment` : '/iep/game-assessment'}>← 返回遊戲選擇頁</Link></nav>
    <main className="app">
      <AttentionPanel tracker={tracker} playing={view === 'test' || view === 'practice'} recording={view === 'test'} finished={view === 'results'} />
      {view === 'home' && demo && <section className="card"><div className="mascot">🐒</div><p className="demo-badge">展示版・約 1 分鐘</p><h1>猴子工作記憶遊戲</h1><p className="lead">聽一串詞語，再把它們用<strong>相反順序</strong>點回來！</p><div className="rules"><span>🔊 請打開聲音</span><span>🔄 從最後一個開始點</span><span>✅ 每題都會告訴你答案</span></div><p className="demo-purpose">例如聽到「貓 → 狗」，就要依序點「狗、貓」。這個遊戲在測<strong>工作記憶</strong>。</p><button type="button" className="primary" onClick={beginDemo}>開始展示</button></section>}
      {view === 'home' && !demo && <section className="card"><div className="mascot">🐒</div><h1>猴子工作記憶遊戲</h1><p className="lead">聽一串詞語，再把它們用<strong>相反順序</strong>點回來！</p><div className="rules"><span>👂 仔細聽完詞語</span><span>🔄 從最後一個開始點</span><span>🎯 盡力完成每一題</span></div><button type="button" className="primary" onClick={() => setView('age')}>開始遊戲</button></section>}
      {view === 'age' && <section className="card"><h1>選擇你的年齡</h1><p>這會用來和同齡研究樣本比較結果。</p><div className="age-grid">{[6, 7, 8, 9, 10, 11, 12].map(value => <button type="button" className="age" key={value} onClick={() => { setAge(value); setPracticeIndex(0); setPractice(makePractice()); setView('practice') }}>{value}<small>歲</small></button>)}</div><button type="button" className="text" onClick={() => setView('home')}>← 回首頁</button></section>}
      {view === 'practice' && <Practice key={practiceIndex} item={practice[practiceIndex]} index={practiceIndex} onNext={() => {
        if (practiceIndex === 3) { tracker.begin('listening'); setQuestions(makeQuestions()); setAnswers([]); setTestIndex(0); setView('test') }
        else setPracticeIndex(practiceIndex + 1)
      }} />}
      {view === 'test' && <TestQuestion key={testIndex} question={questions[testIndex]} index={testIndex} total={questions.length} demo={demo} onPhase={tracker.setPhase} onComplete={answer => {
        const next = [...answers, answer]
        setAnswers(next)
        if (demo && testIndex === questions.length - 1) { setResults({ ...summarizeResults(next), attention: tracker.finish() }); setDemoDone(true); setView('results') }
        else if (testIndex === 19) { setResults({ ...summarizeResults(next), attention: tracker.finish() }); setResultId(crypto.randomUUID()); setAssessmentDate(localDateString()); setCompletedAt(new Date().toISOString()); setView('results') }
        else setTestIndex(testIndex + 1)
      }} />}
      {view === 'results' && results && demoDone && <DemoResults answers={answers} attention={results.attention} onRestart={restart} fullTestLink={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment/monkey` : '/iep/game-assessment/monkey'} />}
      {view === 'results' && results && !demoDone && age !== null && <Results results={results} age={age} resultId={resultId} assessmentDate={assessmentDate} completedAt={completedAt} onRestart={restart} />}
    </main>
  </div>
}
