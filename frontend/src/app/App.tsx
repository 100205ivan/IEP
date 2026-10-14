import { Navigate, Route, Routes } from 'react-router-dom'
import { IepEditorPage } from '../pages/IepEditorPage'
import { GameAssessmentPage } from '../pages/GameAssessmentPage'
import { MonkeyGame } from '../components/games/monkey/MonkeyGame'
import { CptGame } from '../components/games/cpt/CptGame'
import { AssessmentRecordsProvider } from '../context/AssessmentRecordsContext'

export function App() {
  return (
    <AssessmentRecordsProvider><Routes>
      <Route path="/iep" element={<IepEditorPage />} />
      <Route path="/iep/game-assessment" element={<GameAssessmentPage />} />
      <Route path="/iep/game-assessment/monkey" element={<MonkeyGame />} />
      <Route path="/iep/game-assessment/cpt" element={<CptGame />} />
      <Route path="*" element={<Navigate to="/iep" replace />} />
    </Routes></AssessmentRecordsProvider>
  )
}
