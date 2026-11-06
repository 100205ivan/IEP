import { Link, useParams } from 'react-router-dom'
import './game-assessment.css'

export function GameAssessmentPage() {
  const { studentId, iepId } = useParams()
  const gameBase = studentId && iepId ? `/students/${studentId}/ieps/${iepId}/game-assessment` : '/iep/game-assessment'
  const returnToIep = studentId && iepId ? `/students/${studentId}/ieps/${iepId}?subTab=ability-record` : '/iep?subTab=ability-record'
  return <main className="page-container main-content game-assessment-page">
    <Link className="back-link" to={returnToIep}>← 返回 IEP 評量紀錄</Link>
    <div className="section-heading"><h1>EyeEP 遊戲評量</h1><p>選擇評量工具。</p></div>
    <div className="game-selection-grid">
      <article className="game-selection-card"><h2>Monkey Game</h2><p>工作記憶評量</p><Link className="button button--primary" to={`${gameBase}/monkey`}>開始評量</Link></article>
      <article className="game-selection-card"><h2>Continuous Performance Test（CPT）</h2><p>持續注意力評量</p><Link className="button button--primary" to={`${gameBase}/cpt`}>開始評量</Link></article>
    </div>
    <div className="section-heading game-demo-heading"><h2>展示版</h2><p>簡短體驗遊戲在測什麼，結果不會儲存，也不會匯入 IEP。</p></div>
    <div className="game-selection-grid">
      <article className="game-selection-card game-demo-card"><h2>Monkey Game 展示版</h2><p>約 1 分鐘・3 題，每題作答後顯示正確答案</p><Link className="button button--secondary" to={`${gameBase}/monkey?demo=1`}>開始展示</Link></article>
      <article className="game-selection-card game-demo-card"><h2>CPT 展示版</h2><p>約 30 秒・20 題，每題即時告訴你對不對</p><Link className="button button--secondary" to={`${gameBase}/cpt?demo=1`}>開始展示</Link></article>
    </div>
  </main>
}
