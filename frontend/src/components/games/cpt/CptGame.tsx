import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { CptResults } from '../../../types/gameAssessment'
import { CptSession, TOTAL_TRIALS, type CptFrame } from './cptGameLogic'
import { CPT_LEVEL_LABELS, evaluateCpt, ruleBasedCptComment, type CptEvaluationRow } from './cptNorms'
import { CptNormReport } from './CptNormReport'
import { requestCptComment } from '../../../services/assessmentRecordsApi'
import { GameAssessmentImport } from '../GameAssessmentImport'
import { localDateString } from '../../../utils/localDate'
import './cpt-game.css'
import { useAttentionTracker } from '../attention/useAttentionTracker'
import { AttentionPanel } from '../attention/AttentionPanel'
import { AttentionSummary } from '../attention/AttentionSummary'
import { attentionSummaryText } from '../attention/attentionLogic'

/** The AI comment on the norm comparison; the rule-based text stands in when AI is unavailable. */
function useCptComment(rows: CptEvaluationRow[], age: number) {
  const [state, setState] = useState<{ status: 'loading' | 'ai' | 'fallback'; text: string }>({ status: 'loading', text: '' })
  useEffect(() => {
    let active = true
    requestCptComment({ age, rows: rows.map(({ label, value, reference, z, level }) => ({ label, value, reference, z, level })) })
      .then(({ comment }) => { if (active) setState({ status: 'ai', text: comment }) })
      .catch(() => { if (active) setState({ status: 'fallback', text: ruleBasedCptComment(rows, age) }) })
    return () => { active = false }
  }, [rows, age])
  return state
}

function Results({ result, age, onRestart, resultId, assessmentDate, completedAt }: { result: CptResults; age: number; onRestart: () => void; resultId: string; assessmentDate: string; completedAt: string }) {
  const m = result.metrics
  const hasHits = m.hitRate > 0
  const rows = useMemo(() => evaluateCpt(m, age), [m, age])
  const comment = useCptComment(rows, age)
  const duration = `${Math.floor(result.durationMs / 60000)} 分 ${Math.round((result.durationMs % 60000) / 1000)} 秒`
  const summary = `Hit ${(m.hitRate * 100).toFixed(1)}%；Omission ${m.omissionCount} 次；Commission ${m.commissionCount} 次；RT ${hasHits ? Math.round(m.meanReactionTime) + ' ms' : '無 Hit'}；CVRT ${hasHits ? (m.cvrt ?? 0).toFixed(1) + '%' : '—'}；d′ ${(m.dPrime ?? 0).toFixed(2)}。`
    + (rows.some(row => row.level === 'watch' || row.level === 'concern') ? `需留意：${rows.filter(row => row.level === 'watch' || row.level === 'concern').map(row => `${row.label.replace(/（.*）/, '')}（${CPT_LEVEL_LABELS[row.level]}）`).join('、')}。` : '各項指標在同齡一般範圍內。')
    + (comment.status === 'loading' ? '' : `評語：${comment.text}`) + attentionSummaryText(result.attention)
  return <section className="card results">
    <div className="badge">✦ 完成挑戰</div><h2>持續注意力測驗結果</h2><p className="muted">{age} 歲・共 {TOTAL_TRIALS} 題・測驗時間 {duration}</p>
    <div className="cpt-comment" aria-live="polite"><h3>評語</h3>
      <p>{comment.status === 'loading' ? '正在依照常模標準撰寫評語…' : comment.text}</p>
    </div>
    <div className="comparison cpt-norms">
      <CptNormReport rows={rows} age={age} />
      {!hasHits && <p>本次沒有正確命中，無法計算反應時間與變異係數。</p>}
    </div>
    <AttentionSummary report={result.attention} />
    <GameAssessmentImport tool="數字注意力挑戰（CPT）" result={{ resultId, gameType: 'cpt', assessmentDate, completedAt, age, result, summary }} /><button type="button" className="primary-btn" onClick={onRestart}>再玩一次</button>
  </section>
}

const DEMO_TRIALS = 20

/** The judges' short version: what each number means and what the full test adds. */
function DemoResults({ result, onRestart, fullTestLink }: { result: CptResults; onRestart: () => void; fullTestLink: string }) {
  const m = result.metrics
  const hits = result.trials.filter(t => t.hit).length, targets = result.trials.filter(t => t.isTarget).length
  const rows: [string, string, string][] = [
    ['命中（Hit）', `${hits} / ${targets} 次`, '看到 7 有按到：持續注意力'],
    ['漏答（Omission）', `${m.omissionCount} 次`, '看到 7 卻沒按：注意力中斷'],
    ['誤按（Commission）', `${m.commissionCount} 次`, '不是 7 也按：衝動控制'],
    ['平均反應時間（RT）', hits ? `${Math.round(m.meanReactionTime)} ms` : '—', '看到 7 到按下的速度'],
  ]
  return <section className="card results">
    <div className="badge">✦ 展示完成</div><h2>你的展示版結果</h2><p className="muted">展示版共 {DEMO_TRIALS} 題，約 30 秒</p>
    <div className="demo-metrics">{rows.map(([label, value, meaning]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{meaning}</small></div>)}</div>
    <div className="comparison"><h3>正式版還會做什麼</h3>
      <p>・400 題、約 13 分鐘（依 Kanaka 等人 2008 年研究），正式測驗不顯示對錯</p>
      <p>・10 項指標與同齡常模比較，並依標準產生評語</p>
      <p>・可開啟鏡頭，記錄面向螢幕的時間與表情</p>
      <p>・結果可一鍵匯入學生的 IEP 評量紀錄</p>
    </div>
    <AttentionSummary report={result.attention} />
    <p className="note">展示版結果不會儲存，也不會匯入 IEP。</p>
    <button type="button" className="primary-btn" onClick={onRestart}>再試一次</button>
    <Link className="demo-full-link" to={fullTestLink} onClick={onRestart}>玩完整版 →</Link>
  </section>
}

export function CptGame() {
  const tracker = useAttentionTracker()
  const { studentId, iepId } = useParams()
  const demo = useSearchParams()[0].get('demo') === '1'
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
      if (event.target instanceof Element && event.target.closest('.attention-panel')) return
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
      onTestComplete: value => { setResultId(crypto.randomUUID()); setAssessmentDate(localDateString()); setCompletedAt(new Date().toISOString()); setResult({ ...value, attention: tracker.finish() }); setScreen('result') },
    })
    session.current.beginPractice()
  }
  // The demo skips practice and age: a short test with feedback on every number.
  const beginDemo = () => {
    session.current?.reset()
    setResult(null); setFeedback(null)
    session.current = new CptSession({
      onTrial: value => flushSync(() => { setScreen('game'); setFrame(value); setFeedback(null) }),
      onFeedback: (message, type) => flushSync(() => setFeedback({ message, type })),
      onPracticeComplete: () => {},
      onTestComplete: value => { setResult({ ...value, attention: tracker.finish() }); setScreen('result') },
    }, { testTrials: DEMO_TRIALS, testFeedback: true })
    tracker.begin('cpt')
    session.current.beginTest()
  }
  const restart = () => { tracker.reset(); session.current?.reset(); setAge(null); setFrame(null); setFeedback(null); setResult(null); setScreen('home') }
  return <div className="cpt-game">
    <nav className="game-return"><Link to={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment` : '/iep/game-assessment'}>← 返回遊戲選擇頁</Link></nav>
    <div className="sky-decoration cloud cloud-a" /><div className="sky-decoration cloud cloud-b" />
    <div className="star star-a">✦</div><div className="star star-b">★</div><div className="star star-c">✧</div>
    <main className="app-shell">
      <AttentionPanel tracker={tracker} playing={screen === 'game'} recording={screen === 'game' && frame?.phase === 'test'} finished={screen === 'result'} />
      {screen === 'home' && demo && <section className="card"><div className="badge">展示版・約 30 秒</div><h1>數字注意力挑戰</h1><p className="lead">看到數字 <strong>7</strong> 時，請立刻按下按鈕！</p><div className="rules"><p>看到 <b>7</b> → 按下按鈕（或空白鍵）</p><p>看到其他數字 → 不要按</p><p>每一題都會告訴你對不對</p></div><p className="demo-purpose">這個遊戲在測<strong>持續注意力</strong>與<strong>衝動控制</strong>：能不能一直盯著畫面，並忍住不亂按。</p><button type="button" className="primary-btn" onClick={beginDemo}>開始展示</button></section>}
      {screen === 'home' && !demo && <section className="card"><div className="badge">✦ 星星注意力挑戰</div><h1>數字注意力挑戰</h1><p className="lead">看到數字 <strong>7</strong> 時，請立刻按下按鈕！</p><div className="rules"><p>看到 <b>7</b> → 按下按鈕</p><p>看到其他數字 → 不要按</p><p>每個數字只會出現短暫時間</p><p>正式測驗中不要一直亂按</p></div><button type="button" className="primary-btn" onClick={beginPractice}>開始練習</button></section>}
      {screen === 'age' && <section className="card"><div className="badge">準備出發</div><h2>選擇你的年齡</h2><p className="muted">我們會用這個年齡顯示研究參考資訊。</p><div className="age-options" aria-label="年齡選擇">{[5, 6, 7, 8, 9, 10, 11, 12].map(value => <button type="button" className={`age-btn${age === value ? ' selected' : ''}`} key={value} onClick={() => setAge(value)}>{value} 歲</button>)}</div><button type="button" className="primary-btn" disabled={age === null} onClick={() => { tracker.begin('cpt'); session.current?.beginTest() }}>開始正式測驗</button></section>}
      {screen === 'game' && frame && <section className="game-screen">
        <div className="game-top"><span>{demo ? '展示版' : frame.phase === 'practice' ? '練習模式' : '正式測驗'}</span><span>第 {frame.index} / {frame.total} 題</span></div>
        <div className="stimulus-card" aria-live="polite"><span className="stimulus">{frame.stimulus}</span></div>
        <p className={`practice-feedback${feedback ? ` feedback-${feedback.type}` : ''}`} aria-live="polite">{feedback?.message ?? ''}</p>
        <button type="button" className="response-btn" aria-label="按下，或按空白鍵" onClick={() => session.current?.respond()}>按下！<small>也可按 Space</small></button><p className="keyboard-note">看到 7 才按喔！</p>
      </section>}
      {screen === 'practiceComplete' && <section className="card"><div className="big-star">★</div><h2>練習完成，準備開始正式測驗</h2><p className="muted">正式測驗不會顯示答對或答錯，專心看中央數字即可。</p><button type="button" className="primary-btn" onClick={() => setScreen('age')}>選擇年齡並開始</button></section>}
      {screen === 'result' && result && demo && <DemoResults result={result} onRestart={restart} fullTestLink={studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment/cpt` : '/iep/game-assessment/cpt'} />}
      {screen === 'result' && result && !demo && age !== null && <Results result={result} age={age} resultId={resultId} assessmentDate={assessmentDate} completedAt={completedAt} onRestart={restart} />}
    </main>
  </div>
}
