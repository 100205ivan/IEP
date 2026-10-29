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
  </main>
}
