import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AssessmentSubTabs, type AssessmentSubChapter } from '../components/iep/AssessmentSubTabs'
import { IepHeader } from '../components/iep/IepHeader'
import { MainChapterTabs, type MainChapter } from '../components/iep/MainChapterTabs'
import { StudentFamilyForm, type StudentFamilyFormValue } from '../components/iep/StudentFamilyForm'
import { AbilityAssessment } from '../components/iep/AbilityAssessment'
import { useAssessmentRecords } from '../context/useAssessmentRecords'
import { EducationalNeedsAssessment, type AssessmentDetails, type AssessmentSelections, type StrengthWeaknessSummary } from '../components/iep/EducationalNeedsAssessment'
import { SpecialEducationSupport, type SpecialEducationSupportValue } from '../components/iep/SpecialEducationSupport'
import { InclusiveEducationPlan, type InclusiveEducationPlanValue } from '../components/iep/InclusiveEducationPlan'
import { CurriculumAdjustment, type CurriculumAdjustmentValue } from '../components/iep/CurriculumAdjustment'
import { StudentCoursePlan, type CoursePlanItem } from '../components/iep/StudentCoursePlan'
import { StudentWeeklySchedule, type WeeklyScheduleEntry } from '../components/iep/StudentWeeklySchedule'
import { AnnualGoalsPage, LearningStatusPage, SemesterGoalsPage, type GoalDomain, type SemesterGoal } from '../components/iep/GoalsChapter'
import { BehaviorIntervention, type BehaviorInterventionValue } from '../components/iep/BehaviorIntervention'
import { TransitionSupport, type TransitionSupportValue } from '../components/iep/TransitionSupport'
import { initialBehaviorIntervention, initialCurriculumAdjustment, initialInclusiveEducationPlan, initialSpecialEducationSupport, initialStudentFamilyFormValue, initialTransitionSupport } from '../components/iep/iepInitialValues'
import { IepMeetingRecords, type IepMeetingRecord } from '../components/iep/IepMeetingRecords'

const mainChapters: readonly MainChapter[] = [
  { id: 'assessment', label: '壹、學生能力現況、家庭狀況及需求評估' },
  { id: 'services', label: '貳、學生所需特殊教育、相關服務及支持策略' },
  { id: 'goals', label: '參、學年與學期教育目標' },
  { id: 'intervention', label: '肆、行為功能介入方案及行政支援' },
  { id: 'transition', label: '伍、學生之轉銜輔導及服務內容' },
  { id: 'meeting', label: 'IEP 會議紀錄' },
  { id: 'export', label: '匯出' },
]

const assessmentSubChapters: readonly AssessmentSubChapter[] = [
  { id: 'family-info', label: '一、學生基本資料及家庭狀況' },
  { id: 'ability-record', label: '二、學生能力現況評量紀錄' },
  { id: 'education-needs', label: '三、學生教育需求評估與能力優弱勢分析' },
]

const serviceSubChapters: readonly AssessmentSubChapter[] = [
  { id: 'special-education-support', label: '一、特殊教育及支持服務需求' },
  { id: 'inclusive-education', label: '二、融合教育規劃' },
  { id: 'curriculum-adjustment', label: '三、課程調整方式' },
  { id: 'curriculum-plan', label: '四、學生課程規劃表' },
  { id: 'weekly-schedule', label: '五、學生每週課表' },
]

const goalsSubChapters: readonly AssessmentSubChapter[] = [
  { id: 'annual', label: '一、領域與學年教育目標' },
  { id: 'semester', label: '二、學期教育目標與評量' },
  { id: 'status', label: '三、目標達成情形' },
]

function AssessmentPlaceholder({ activeChapter }: { activeChapter: string }) {
  const chapter = assessmentSubChapters.find((item) => item.id === activeChapter)

  return (
    <section className="placeholder-section" id={`assessment-${activeChapter}`} role="tabpanel" aria-labelledby={`assessment-tab-${activeChapter}`}>
      <h2>{chapter?.label}</h2>
      <p>此區域的正式表單將於下一階段製作。</p>
    </section>
  )
}

function ServicePlaceholder({ activeChapter }: { activeChapter: string }) {
  const chapter = serviceSubChapters.find((item) => item.id === activeChapter)
  return <section className="placeholder-section" id={`services-${activeChapter}`} role="tabpanel" aria-labelledby={`services-tab-${activeChapter}`}><h2>{chapter?.label}</h2><p>此區域的正式表單將於下一階段製作。</p></section>
}

export function IepEditorPage() {
  const studentName = '王小明'
  const [searchParams] = useSearchParams()
  const [activeMainChapter, setActiveMainChapter] = useState('assessment')
  const [activeAssessmentChapter, setActiveAssessmentChapter] = useState(() => searchParams.get('subTab') === 'ability-record' ? 'ability-record' : 'family-info')
  const [activeServiceChapter, setActiveServiceChapter] = useState('special-education-support')
  const [activeGoalsChapter, setActiveGoalsChapter] = useState('annual')
  const [studentFamilyForm, setStudentFamilyForm] = useState<StudentFamilyFormValue>(initialStudentFamilyFormValue)
  const [goalDomains, setGoalDomains] = useState<GoalDomain[]>([])
  const [semesterGoals, setSemesterGoals] = useState<SemesterGoal[]>([])
  const [learningNotes, setLearningNotes] = useState('')
  const [behaviorIntervention, setBehaviorIntervention] = useState<BehaviorInterventionValue>(initialBehaviorIntervention)
  const [transitionSupport, setTransitionSupport] = useState<TransitionSupportValue>(initialTransitionSupport)
  const [meetingRecords, setMeetingRecords] = useState<IepMeetingRecord[]>([])
  const [specialEducationSupport, setSpecialEducationSupport] = useState<SpecialEducationSupportValue>(initialSpecialEducationSupport)
  const [inclusiveEducationPlan, setInclusiveEducationPlan] = useState<InclusiveEducationPlanValue>(initialInclusiveEducationPlan)
  const [curriculumAdjustment, setCurriculumAdjustment] = useState<CurriculumAdjustmentValue>(initialCurriculumAdjustment)
  const [coursePlanItems, setCoursePlanItems] = useState<CoursePlanItem[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleEntry[]>([])
  const [assessmentSelections, setAssessmentSelections] = useState<AssessmentSelections>({})
  const { records: assessmentRecords, setRecords: setAssessmentRecords, documentAnalyses, setDocumentAnalyses } = useAssessmentRecords()
  const [assessmentDetails, setAssessmentDetails] = useState<AssessmentDetails>({})
  const [strengthWeaknessSummary, setStrengthWeaknessSummary] = useState<StrengthWeaknessSummary>({ strengths: [], weaknesses: [], strengthNotes: '', weaknessNotes: '', overallNeeds: '' })
  const activeMain = mainChapters.find((chapter) => chapter.id === activeMainChapter)

  return (
    <div className="iep-editor-shell">
      <IepHeader studentName={studentName} schoolYear="115" semester="第一學期" />
      <MainChapterTabs chapters={mainChapters} activeChapter={activeMainChapter} onChange={setActiveMainChapter} />
      <main className="page-container main-content">
        {activeMainChapter === 'assessment' ? (
          <section className="content-panel" id="chapter-assessment" role="tabpanel" aria-labelledby="chapter-tab-assessment">
            <div className="section-heading">
              <p className="eyebrow">壹</p>
              <h1>學生能力現況、家庭狀況及需求評估</h1>
              <p>請選擇下方子章節查看填寫區域。</p>
            </div>
            <AssessmentSubTabs chapters={assessmentSubChapters} activeChapter={activeAssessmentChapter} onChange={setActiveAssessmentChapter} />
            {activeAssessmentChapter === 'family-info' ? <StudentFamilyForm value={studentFamilyForm} onChange={setStudentFamilyForm} /> : activeAssessmentChapter === 'ability-record' ? <AbilityAssessment studentName={studentName} records={assessmentRecords} setRecords={setAssessmentRecords} documentAnalyses={documentAnalyses} setDocumentAnalyses={setDocumentAnalyses} /> : activeAssessmentChapter === 'education-needs' ? <EducationalNeedsAssessment selected={assessmentSelections} setSelected={setAssessmentSelections} details={assessmentDetails} setDetails={setAssessmentDetails} summary={strengthWeaknessSummary} setSummary={setStrengthWeaknessSummary} /> : <AssessmentPlaceholder activeChapter={activeAssessmentChapter} />}
          </section>
        ) : activeMainChapter === 'services' ? (
          <section className="content-panel" id="chapter-services" role="tabpanel" aria-labelledby="chapter-tab-services">
            <div className="section-heading"><p className="eyebrow">貳</p><h1>學生所需特殊教育、相關服務及支持策略</h1><p>依學生個別需求規劃特殊教育服務、相關支持、融合教育及課程調整方式。</p></div>
            <AssessmentSubTabs chapters={serviceSubChapters} activeChapter={activeServiceChapter} onChange={setActiveServiceChapter} ariaLabel="貳、子章節" idPrefix="services" />
            {activeServiceChapter === 'special-education-support' ? <SpecialEducationSupport value={specialEducationSupport} onChange={setSpecialEducationSupport} /> : activeServiceChapter === 'inclusive-education' ? <InclusiveEducationPlan value={inclusiveEducationPlan} onChange={setInclusiveEducationPlan} /> : activeServiceChapter === 'curriculum-adjustment' ? <CurriculumAdjustment value={curriculumAdjustment} onChange={setCurriculumAdjustment} /> : activeServiceChapter === 'curriculum-plan' ? <StudentCoursePlan courses={coursePlanItems} setCourses={setCoursePlanItems} /> : activeServiceChapter === 'weekly-schedule' ? <StudentWeeklySchedule courses={coursePlanItems} schedule={weeklySchedule} setSchedule={setWeeklySchedule} onGoToCoursePlan={() => setActiveServiceChapter('curriculum-plan')} /> : <ServicePlaceholder activeChapter={activeServiceChapter} />}
          </section>
        ) : activeMainChapter === 'goals' ? (
          <section className="content-panel" id="chapter-goals" role="tabpanel" aria-labelledby="chapter-tab-goals">
            <div className="section-heading"><p className="eyebrow">參</p><h1>學年與學期教育目標</h1><p>規劃學年與學期教育目標、評量方式及目標達成情形。</p></div>
            <AssessmentSubTabs chapters={goalsSubChapters} activeChapter={activeGoalsChapter} onChange={setActiveGoalsChapter} ariaLabel="參、子章節" idPrefix="goals" />
            {activeGoalsChapter === 'annual' ? <AnnualGoalsPage domains={goalDomains} setDomains={setGoalDomains} setSemesterGoals={setSemesterGoals} /> : activeGoalsChapter === 'semester' ? <SemesterGoalsPage domains={goalDomains} goals={semesterGoals} setGoals={setSemesterGoals} goAnnual={() => setActiveGoalsChapter('annual')} /> : <LearningStatusPage domains={goalDomains} goals={semesterGoals} setGoals={setSemesterGoals} learningNotes={learningNotes} setLearningNotes={setLearningNotes} />}
          </section>
        ) : activeMainChapter === 'intervention' ? (
          <BehaviorIntervention value={behaviorIntervention} onChange={setBehaviorIntervention} />
        ) : activeMainChapter === 'transition' ? (
          <TransitionSupport value={transitionSupport} onChange={setTransitionSupport} />
        ) : activeMainChapter === 'meeting' ? (
          <IepMeetingRecords records={meetingRecords} setRecords={setMeetingRecords} />
        ) : (
          <section className="content-panel unavailable-panel" id={`chapter-${activeMainChapter}`} role="tabpanel" aria-labelledby={`chapter-tab-${activeMainChapter}`}>
            <p>{activeMain?.label}尚未製作</p>
          </section>
        )}
      </main>
    </div>
  )
}
