import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import type { CptResults } from '../../../types/gameAssessment'
import { CptSession, rateLabel, TOTAL_TRIALS, type CptFrame } from './cptGameLogic'
import { CPT_NORMS } from './cptNorms'
import { GameAssessmentImport } from '../GameAssessmentImport'
import { localDateString } from '../../../utils/localDate'
import './cpt-game.css'

function Results({ result, age, onRestart, resultId, assessmentDate, completedAt }: { result: CptResults; age: number; onRestart: () => void; resultId: string; assessmentDate: string; completedAt: string }) {
  const m = result.metrics, n = CPT_NORMS[age]
  const hasHits = result.trials.some(t => t.hit)
  const metrics = [
    ['命中率', `${Math.round(m.hitRate * 100)}%`], ['漏答', `${m.omissionCount} 次`],
    ['漏答率', `${(m.omissionRate * 100).toFixed(1)}%`], ['誤按', `${m.commissionCount} 次`],
    ['誤按率', `${(m.commissionRate * 100).toFixed(1)}%`],
    ['平均反應時間', hasHits ? `${Math.round(m.meanReactionTime)} ms` : '無 Hit'],
    ['反應時間 SD', hasHits ? `${Math.round(m.reactionTimeSD)} ms` : '—'],
    ['測驗時間', `${Math.floor(result.durationMs / 60000)} 分 ${Math.round((result.durationMs % 60000) / 1000)} 秒`],
  ]
  return <section className="card results">
    <div className="badge">✦ 完成挑戰</div><h2>持續注意力測驗結果</h2><p className="muted">{age} 歲・共 {TOTAL_TRIALS} 題</p>
    <div className="metric-grid">{metrics.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="comparison"><h3>與同齡研究參考比較</h3>
      <p>命中表現：{rateLabel((m.hitRate - n.hit.mean) / n.hit.sd)}</p>
      <p>漏答率：{(m.omissionRate * 100).toFixed(1)}%（本原型為 100 題，不能直接以 400 題研究的漏答次數常模計算 Z-score）</p>
      <p>誤按率：{(m.commissionRate * 100).toFixed(1)}%（本原型為 100 題，不能直接以 400 題研究的誤按次數常模計算 Z-score）</p>
      <p>{hasHits ? `反應時間：比同齡平均${m.meanReactionTime >= n.rt.mean ? '慢' : '快'} ${Math.abs((m.meanReactionTime - n.rt.mean) / n.rt.sd).toFixed(1)} SD` : '反應時間：沒有正確 Hit，無法計算。'}</p>
    </div>
    <p className="note">這是 100 題遊戲原型，僅供注意力練習與研究參考，不作任何診斷用途。</p>
    <GameAssessmentImport tool="數字注意力挑戰（CPT）" result={{ resultId, gameType: 'cpt', assessmentDate, completedAt, age, result, summary: `Hit ${Math.round(m.hitRate * 100)}%；Omission ${m.omissionCount} 次；Commission ${m.commissionCount} 次；RT ${hasHits ? Math.round(m.meanReactionTime) + ' ms' : '無 Hit'}；RTV ${hasHits ? Math.round(m.reactionTimeSD) + ' ms' : '—'}。` }} /><button type="button" className="primary-btn" onClick={onRestart}>再玩一次</button>
  </section>
}

export function CptGame() {
  const { studentId, iepId } = useParams()
  const [screen, setScreen] = useState<'home' | 'age' | 'game' | 'practiceComplete' | 'result'>('home')
  const [age, setAge] = useState<number | null>(null)
  const [frame, setFrame] = useState<CptFrame | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; type: 'good' | 'bad' } | null>(null)
  const [result, setResult] = useState<CptResults | null>(null)
  const [resultId, setResultId] = useState('')
  const [assessmentDate, setAssessmentDate] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const session = useRef<CptSession | null>(null)
  const resetSession = useCallback(() => session.current?.reset(), [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) session.current?.respond() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); resetSession() }
  }, [resetSession])
  const beginPractice = () => {
    session.current?.reset()
    setAge(null); setResult(null); setFeedback(null)
    session.current = new CptSession({
      onTrial: value => flushSync(() => { setScreen('game'); setFrame(value); setFeedback(null) }),
      onFeedback: (message, type) => flushSync(() => setFeedback({ message, type })),
      onPracticeComplete: () => setScreen('practiceComplete'),
      onTestComplete: value => { setResultId(crypto.randomUUID()); setAssessmentDate(localDateString()); setCompletedAt(new Date().toISOString()); setResult(value); setScreen('result') },
    })
    session.current.beginPractice()
  }
  const restart = () => { session.current?.reset(); setAge(null); setFrame(null); setFeedback(null); setResult(null); setScreen('home') }
  return <div className="cpt-game">
    <nav className="game-return"><Link to={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment` : '/iep/game-assessment'}>← 返回遊戲選擇頁</Link></nav>
    <div className="sky-decoration cloud cloud-a" /><div className="sky-decoration cloud cloud-b" />
    <div className="star star-a">✦</div><div className="star star-b">★</div><div className="star star-c">✧</div>
    <main className="app-shell">
      {screen === 'home' && <section className="card"><div className="badge">✦ 星星注意力挑戰</div><h1>數字注意力挑戰</h1><p className="lead">看到數字 <strong>7</strong> 時，請立刻按下按鈕！</p><div className="rules"><p>看到 <b>7</b> → 按下按鈕</p><p>看到其他數字 → 不要按</p><p>每個數字只會出現短暫時間</p><p>正式測驗中不要一直亂按</p></div><button type="button" className="primary-btn" onClick={beginPractice}>開始練習</button></section>}
      {screen === 'age' && <section className="card"><div className="badge">準備出發</div><h2>選擇你的年齡</h2><p className="muted">我們會用這個年齡顯示研究參考資訊。</p><div className="age-options" aria-label="年齡選擇">{[5, 6, 7, 8, 9, 10, 11, 12].map(value => <button type="button" className={`age-btn${age === value ? ' selected' : ''}`} key={value} onClick={() => setAge(value)}>{value} 歲</button>)}</div><button type="button" className="primary-btn" disabled={age === null} onClick={() => session.current?.beginTest()}>開始正式測驗</button></section>}
      {screen === 'game' && frame && <section className="game-screen">
        <div className="game-top"><span>{frame.phase === 'practice' ? '練習模式' : '正式測驗'}</span><span>第 {frame.index} / {frame.total} 題</span></div>
        <div className="stimulus-card" aria-live="polite"><span className="stimulus">{frame.stimulus}</span></div>
        <p className={`practice-feedback${feedback ? ` feedback-${feedback.type}` : ''}`} aria-live="polite">{feedback?.message ?? ''}</p>
        <button type="button" className="response-btn" aria-label="按下，或按空白鍵" onClick={() => session.current?.respond()}>按下！<small>也可按 Space</small></button><p className="keyboard-note">看到 7 才按喔！</p>
      </section>}
      {screen === 'practiceComplete' && <section className="card"><div className="big-star">★</div><h2>練習完成，準備開始正式測驗</h2><p className="muted">正式測驗不會顯示答對或答錯，專心看中央數字即可。</p><button type="button" className="primary-btn" onClick={() => setScreen('age')}>選擇年齡並開始</button></section>}
      {screen === 'result' && result && age !== null && <Results result={result} age={age} resultId={resultId} assessmentDate={assessmentDate} completedAt={completedAt} onRestart={restart} />}
    </main>
  </div>
}
