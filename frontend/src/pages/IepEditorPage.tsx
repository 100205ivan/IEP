import { useEffect, useLayoutEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AssessmentSubTabs, type AssessmentSubChapter } from '../components/iep/AssessmentSubTabs'
import { IepHeader } from '../components/iep/IepHeader'
import { MainChapterTabs, type MainChapter } from '../components/iep/MainChapterTabs'
import { StudentFamilyForm, type StudentFamilyFormValue } from '../components/iep/StudentFamilyForm'
import { AbilityAssessment } from '../components/iep/AbilityAssessment'
import { useAssessmentRecords } from '../context/useAssessmentRecords'
import type { AssessmentScope } from '../context/assessmentRecordsStore'
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
import { createStudentWithIep, getStudentIep, updateStudentIep, type StudentFieldsPayload } from '../services/studentIepApi'
import type { IepContent } from '../types/studentIep'

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
  const navigate = useNavigate()
  const { studentId, iepId } = useParams()
  const [searchParams] = useSearchParams()
  const currentAcademicYear = useMemo(() => String(new Date().getFullYear() - 1911), [])
  const [academicYear, setAcademicYear] = useState(currentAcademicYear)
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('unsaved')
  const [loadError, setLoadError] = useState('')
  const [basicInfoReviewNotice, setBasicInfoReviewNotice] = useState<IepContent['basicInfoReviewNotice']>()
  const [loaded, setLoaded] = useState(!iepId)
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
  const { manualRecords, transientRecords, documentAnalyses, activeStudentId, activeIepId, resetForIep, isCurrentScope, updateManualRecords, updateTransientRecords, updateDocumentAnalyses, updateScopeInfo } = useAssessmentRecords()
  const [assessmentDetails, setAssessmentDetails] = useState<AssessmentDetails>({})
  const [strengthWeaknessSummary, setStrengthWeaknessSummary] = useState<StrengthWeaknessSummary>({ strengths: [], weaknesses: [], strengthNotes: '', weaknessNotes: '', overallNeeds: '' })
  const studentName = studentFamilyForm.values.studentName || '新學生'
  const activeMain = mainChapters.find((chapter) => chapter.id === activeMainChapter)
  const assessmentScope = useMemo<AssessmentScope>(() => ({ studentId: studentId ?? null, iepId: iepId ?? null }), [studentId, iepId])
  const assessmentScopeActive = activeStudentId === assessmentScope.studentId && activeIepId === assessmentScope.iepId

  useEffect(() => {
    if (!iepId) return
    let active = true
    getStudentIep(iepId).then((record) => {
      if (!active) return
      const content = record.content as Partial<IepContent> & Record<string, unknown>
      if (studentId && record.studentId !== studentId) throw new Error('此 IEP 不屬於目前學生。')
      setAcademicYear(String(record.academicYear))
      if (content.studentFamilyForm) setStudentFamilyForm(content.studentFamilyForm)
      if (content.goalDomains) setGoalDomains(content.goalDomains as GoalDomain[])
      if (content.semesterGoals) setSemesterGoals(content.semesterGoals as SemesterGoal[])
      if (typeof content.learningNotes === 'string') setLearningNotes(content.learningNotes)
      if (content.behaviorIntervention) setBehaviorIntervention(content.behaviorIntervention as BehaviorInterventionValue)
      if (content.transitionSupport) setTransitionSupport(content.transitionSupport as TransitionSupportValue)
      if (content.meetingRecords) setMeetingRecords(content.meetingRecords as IepMeetingRecord[])
      if (content.specialEducationSupport) setSpecialEducationSupport(content.specialEducationSupport as SpecialEducationSupportValue)
      if (content.inclusiveEducationPlan) setInclusiveEducationPlan(content.inclusiveEducationPlan as InclusiveEducationPlanValue)
      if (content.curriculumAdjustment) setCurriculumAdjustment(content.curriculumAdjustment as CurriculumAdjustmentValue)
      if (content.coursePlanItems) setCoursePlanItems(content.coursePlanItems as CoursePlanItem[])
      if (content.weeklySchedule) setWeeklySchedule(content.weeklySchedule as WeeklyScheduleEntry[])
      if (content.assessmentSelections) setAssessmentSelections(content.assessmentSelections as AssessmentSelections)
      if (content.assessmentDetails) setAssessmentDetails(content.assessmentDetails as AssessmentDetails)
      if (content.strengthWeaknessSummary) setStrengthWeaknessSummary(content.strengthWeaknessSummary as StrengthWeaknessSummary)
      if (content.basicInfoReviewNotice) setBasicInfoReviewNotice(content.basicInfoReviewNotice as IepContent['basicInfoReviewNotice'])
      setSaveStatus('saved')
      setLoaded(true)
    }).catch((reason: unknown) => { if (active) { setLoadError(reason instanceof Error ? reason.message : '無法載入 IEP。'); setLoaded(true); setSaveStatus('error') } })
    return () => { active = false }
  }, [iepId, studentId])

  useLayoutEffect(() => { resetForIep(assessmentScope) }, [assessmentScope, resetForIep])
  useEffect(() => { updateScopeInfo(assessmentScope, studentName, academicYear, '年度 IEP') }, [assessmentScope, studentName, academicYear, updateScopeInfo])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (saveStatus === 'unsaved' || saveStatus === 'error') { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  const markUnsaved = () => { if (loaded && saveStatus === 'saved') setSaveStatus('unsaved') }
  const track = <T,>(setter: Dispatch<SetStateAction<T>>) => (updater: SetStateAction<T>) => { setter(updater); markUnsaved() }
  const updateStudentFamilyForm = track(setStudentFamilyForm)
  const updateGoalDomains = track(setGoalDomains)
  const updateSemesterGoals = track(setSemesterGoals)
  const updateLearningNotes = track(setLearningNotes)
  const updateBehaviorIntervention = track(setBehaviorIntervention)
  const updateTransitionSupport = track(setTransitionSupport)
  const updateMeetingRecords = track(setMeetingRecords)
  const updateSpecialEducationSupport = track(setSpecialEducationSupport)
  const updateInclusiveEducationPlan = track(setInclusiveEducationPlan)
  const updateCurriculumAdjustment = track(setCurriculumAdjustment)
  const updateCoursePlanItems = track(setCoursePlanItems)
  const updateWeeklySchedule = track(setWeeklySchedule)
  const updateAssessmentSelections = track(setAssessmentSelections)
  const updateAssessmentDetails = track(setAssessmentDetails)
  const updateStrengthWeaknessSummary = track(setStrengthWeaknessSummary)
  const buildContent = (): IepContent => ({ studentFamilyForm, goalDomains, semesterGoals, learningNotes, behaviorIntervention, transitionSupport, meetingRecords, specialEducationSupport, inclusiveEducationPlan, curriculumAdjustment, coursePlanItems, weeklySchedule: weeklySchedule.filter((entry) => coursePlanItems.some((course) => course.id === entry.courseId)), assessmentSelections, assessmentDetails, strengthWeaknessSummary, ...(basicInfoReviewNotice ? { basicInfoReviewNotice } : {}) })
  const buildStudent = (): StudentFieldsPayload => ({ name: studentFamilyForm.values.studentName.trim(), gender: studentFamilyForm.values.gender, birthDate: studentFamilyForm.values.birthDate || null, nationalId: studentFamilyForm.values.nationalId || null, studentNumber: studentFamilyForm.values.studentId || '' })
  const updateAcademicYear = (value: string) => { setAcademicYear(value); markUnsaved() }
  const save = async () => {
    if (!studentFamilyForm.values.studentName.trim()) { setSaveStatus('error'); setLoadError('請先輸入學生姓名。'); setActiveMainChapter('assessment'); setActiveAssessmentChapter('family-info'); return }
    const year = Number(academicYear)
    if (!Number.isInteger(year) || year < 1) { setSaveStatus('error'); setLoadError('請輸入有效的學年度。'); return }
    setSaveStatus('saving'); setLoadError('')
    try {
      const content = buildContent(); const student = buildStudent()
      if (iepId) { await updateStudentIep(iepId, content, student, year); setSaveStatus('saved') }
      else { const created = await createStudentWithIep(student, year, content); setSaveStatus('saved'); navigate(`/students/${created.studentId}/ieps/${created.iepId}`, { replace: true }) }
    } catch (reason: unknown) { setSaveStatus('error'); setLoadError(reason instanceof Error ? reason.message : '儲存失敗，請稍後再試。') }
  }

  return (
    <div className="iep-editor-shell">
      <IepHeader studentName={studentName} schoolYear={academicYear} semester="年度 IEP" saveStatus={saveStatus} onSave={save} onSchoolYearChange={updateAcademicYear} disabled={!loaded} />
      {loadError && <p className="page-container student-list-error" role="alert">{loadError}</p>}
      {basicInfoReviewNotice && <p className="page-container iep-inherited-basic-notice" role="status">{basicInfoReviewNotice.message}</p>}
      {!loaded && <p className="page-container">正在載入 IEP…</p>}
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
            {activeAssessmentChapter === 'family-info' ? <StudentFamilyForm value={studentFamilyForm} onChange={updateStudentFamilyForm} /> : activeAssessmentChapter === 'ability-record' ? <AbilityAssessment key={`${assessmentScope.studentId ?? 'new'}:${assessmentScope.iepId ?? 'new'}`} studentName={studentName} scope={assessmentScope} scopeActive={assessmentScopeActive} isCurrentScope={isCurrentScope} manualRecords={manualRecords} updateManualRecords={updateManualRecords} transientRecords={transientRecords} updateTransientRecords={updateTransientRecords} documentAnalyses={documentAnalyses} updateDocumentAnalyses={updateDocumentAnalyses} /> : activeAssessmentChapter === 'education-needs' ? <EducationalNeedsAssessment selected={assessmentSelections} setSelected={updateAssessmentSelections} details={assessmentDetails} setDetails={updateAssessmentDetails} summary={strengthWeaknessSummary} setSummary={updateStrengthWeaknessSummary} /> : <AssessmentPlaceholder activeChapter={activeAssessmentChapter} />}
          </section>
        ) : activeMainChapter === 'services' ? (
          <section className="content-panel" id="chapter-services" role="tabpanel" aria-labelledby="chapter-tab-services">
            <div className="section-heading"><p className="eyebrow">貳</p><h1>學生所需特殊教育、相關服務及支持策略</h1><p>依學生個別需求規劃特殊教育服務、相關支持、融合教育及課程調整方式。</p></div>
            <AssessmentSubTabs chapters={serviceSubChapters} activeChapter={activeServiceChapter} onChange={setActiveServiceChapter} ariaLabel="貳、子章節" idPrefix="services" />
            {activeServiceChapter === 'special-education-support' ? <SpecialEducationSupport value={specialEducationSupport} onChange={updateSpecialEducationSupport} /> : activeServiceChapter === 'inclusive-education' ? <InclusiveEducationPlan value={inclusiveEducationPlan} onChange={updateInclusiveEducationPlan} /> : activeServiceChapter === 'curriculum-adjustment' ? <CurriculumAdjustment value={curriculumAdjustment} onChange={updateCurriculumAdjustment} /> : activeServiceChapter === 'curriculum-plan' ? <StudentCoursePlan courses={coursePlanItems} setCourses={updateCoursePlanItems} /> : activeServiceChapter === 'weekly-schedule' ? <StudentWeeklySchedule courses={coursePlanItems} schedule={weeklySchedule} setSchedule={updateWeeklySchedule} onGoToCoursePlan={() => setActiveServiceChapter('curriculum-plan')} /> : <ServicePlaceholder activeChapter={activeServiceChapter} />}
          </section>
        ) : activeMainChapter === 'goals' ? (
          <section className="content-panel" id="chapter-goals" role="tabpanel" aria-labelledby="chapter-tab-goals">
            <div className="section-heading"><p className="eyebrow">參</p><h1>學年與學期教育目標</h1><p>規劃學年與學期教育目標、評量方式及目標達成情形。</p></div>
            <AssessmentSubTabs chapters={goalsSubChapters} activeChapter={activeGoalsChapter} onChange={setActiveGoalsChapter} ariaLabel="參、子章節" idPrefix="goals" />
            {activeGoalsChapter === 'annual' ? <AnnualGoalsPage domains={goalDomains} setDomains={updateGoalDomains} setSemesterGoals={updateSemesterGoals} /> : activeGoalsChapter === 'semester' ? <SemesterGoalsPage domains={goalDomains} goals={semesterGoals} setGoals={updateSemesterGoals} goAnnual={() => setActiveGoalsChapter('annual')} /> : <LearningStatusPage domains={goalDomains} goals={semesterGoals} setGoals={updateSemesterGoals} learningNotes={learningNotes} setLearningNotes={updateLearningNotes} />}
          </section>
        ) : activeMainChapter === 'intervention' ? (
          <BehaviorIntervention value={behaviorIntervention} onChange={updateBehaviorIntervention} />
        ) : activeMainChapter === 'transition' ? (
          <TransitionSupport value={transitionSupport} onChange={updateTransitionSupport} />
        ) : activeMainChapter === 'meeting' ? (
          <IepMeetingRecords records={meetingRecords} setRecords={updateMeetingRecords} />
        ) : (
          <section className="content-panel unavailable-panel" id={`chapter-${activeMainChapter}`} role="tabpanel" aria-labelledby={`chapter-tab-${activeMainChapter}`}>
            <p>{activeMain?.label}尚未製作</p>
          </section>
        )}
      </main>
    </div>
  )
}
