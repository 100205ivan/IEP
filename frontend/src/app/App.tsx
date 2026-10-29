import { Navigate, Route, Routes } from 'react-router-dom'
import { IepEditorPage } from '../pages/IepEditorPage'
import { GameAssessmentPage } from '../pages/GameAssessmentPage'
import { MonkeyGame } from '../components/games/monkey/MonkeyGame'
import { CptGame } from '../components/games/cpt/CptGame'
import { AssessmentRecordsProvider } from '../context/AssessmentRecordsContext'
import { StudentListPage } from '../pages/StudentListPage'
import { StudentDetailPage } from '../pages/StudentDetailPage'

export function App() {
  return (
    <AssessmentRecordsProvider><Routes>
      <Route path="/" element={<Navigate to="/students" replace />} />
      <Route path="/students" element={<StudentListPage />} />
      <Route path="/students/new" element={<IepEditorPage />} />
      <Route path="/students/:studentId" element={<StudentDetailPage />} />
      <Route path="/students/:studentId/ieps/:iepId" element={<IepEditorPage />} />
      <Route path="/iep" element={<IepEditorPage />} />
      <Route path="/iep/game-assessment" element={<GameAssessmentPage />} />
      <Route path="/iep/game-assessment/monkey" element={<MonkeyGame />} />
      <Route path="/iep/game-assessment/cpt" element={<CptGame />} />
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes></AssessmentRecordsProvider>
  )
}
