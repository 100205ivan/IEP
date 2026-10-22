import { type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from 'react'

type TextControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type ControlProps = {
  value: string
  onChange: (event: ChangeEvent<TextControl>) => void
  disabled?: boolean
}

export interface Medication {
  id: string
  name: string
  directions: string
  purpose: string
  sideEffects: string
}

const relationships = ['父親', '母親', '祖父', '祖母', '外祖父', '外祖母', '兄', '姊', '其他親屬', '其他']
const educationLevels = ['國小', '國中', '高中／高職', '專科', '大學', '研究所以上', '其他']
const disabilityCategories = ['智能障礙', '視覺障礙', '聽覺障礙', '語言障礙', '肢體障礙', '身體病弱', '情緒行為障礙', '學習障礙', '自閉症', '其他']
const severityLevels = ['輕度', '中度', '重度', '極重度']
const serviceOptions = [
  ['parentEducation', '親職教育'],
  ['familyConsultation', '家庭諮詢'],
  ['trainingInformation', '輔導、轉介與特殊教育相關研習及資訊'],
  ['serviceApplication', '協助家長申請相關機關（構）或團體之服務'],
  ['otherSupport', '其他'],
] as const

export interface StudentFamilyFormValue {
  values: Record<string, string>
  checks: Record<string, boolean>
  medications: Medication[]
}

export function StudentFamilyForm({ value, onChange }: { value: StudentFamilyFormValue; onChange: Dispatch<SetStateAction<StudentFamilyFormValue>> }) {
  const { values, checks, medications } = value
  const setMedications = (updater: SetStateAction<Medication[]>) => {
    onChange((current) => ({
      ...current,
      medications: typeof updater === 'function' ? updater(current.medications) : updater,
    }))
  }

  const updateValue = (key: string, nextValue: string) => {
    onChange((current) => {
      const nextValues = { ...current.values, [key]: nextValue }
      if (key === 'registeredAddress' && current.checks.sameAddress) nextValues.residentialAddress = nextValue
      if (key === 'icfCategory' && nextValue !== 'other') nextValues.icfOther = ''
      return { ...current, values: nextValues }
    })
  }

  const control = (key: string) => ({
    value: values[key],
    onChange: (event: ChangeEvent<TextControl>) => updateValue(key, event.target.value),
  })

  const toggleCheck = (key: string, isChecked: boolean) => {
    onChange((current) => ({ ...current, checks: { ...current.checks, [key]: isChecked } }))
  }

  const toggleSameAddress = (isChecked: boolean) => {
    onChange((current) => ({
      ...current,
      checks: { ...current.checks, sameAddress: isChecked },
      values: isChecked ? { ...current.values, residentialAddress: current.values.registeredAddress } : current.values,
    }))
  }

  const toggleSupport = (key: string, isChecked: boolean) => {
    onChange((current) => {
      const nextChecks = { ...current.checks, [key]: isChecked }
      if (key === 'supportNone' && isChecked) serviceOptions.forEach(([option]) => { nextChecks[option] = false })
      if (key !== 'supportNone' && isChecked) nextChecks.supportNone = false
      const shouldClearOtherDescription = (key === 'otherSupport' && !isChecked) || (key === 'supportNone' && isChecked)
      return {
        ...current,
        checks: nextChecks,
        values: shouldClearOtherDescription ? { ...current.values, otherSupportDescription: '' } : current.values,
      }
    })
  }

  const toggleSameGuardian = (isChecked: boolean) => {
    onChange((current) => ({
      ...current,
      checks: { ...current.checks, sameGuardian: isChecked },
      values: isChecked ? {
        ...current.values,
        caregiverName: current.values.guardianName,
        caregiverRelationship: current.values.guardianRelationship,
        caregiverPhone: current.values.guardianPhone,
        caregiverAge: current.values.guardianAge,
        caregiverEducation: current.values.guardianEducation,
        caregiverOccupation: current.values.guardianOccupation,
      } : current.values,
    }))
  }

  const addMedication = () => {
    onChange((current) => ({ ...current, medications: [...current.medications, { id: crypto.randomUUID(), name: '', directions: '', purpose: '', sideEffects: '' }] }))
  }

  const updateMedication = (id: string, field: keyof Omit<Medication, 'id'>, medicationValue: string) => {
    onChange((current) => ({ ...current, medications: current.medications.map((item) => item.id === id ? { ...item, [field]: medicationValue } : item) }))
  }

  const caregiverValue = (field: string) => checks.sameGuardian ? values[`guardian${field}`] : values[`caregiver${field}`]
  const caregiverControl = (field: string) => ({
    value: caregiverValue(field),
    disabled: Boolean(checks.sameGuardian),
    onChange: (event: ChangeEvent<TextControl>) => updateValue(`caregiver${field}`, event.target.value),
  })

  return (
    <section className="iep-detail-form" id="assessment-family-info" role="tabpanel" aria-labelledby="assessment-tab-family-info">
      <div className="section-heading">
        <h2>一、學生基本資料及家庭狀況</h2>
        <p>依正式 IEP 表格填寫學生、健康與家庭資料。</p>
      </div>
      <form className="student-family-form" aria-label="學生基本資料及家庭狀況表單">
        <section className="iep-form-section">
          <h3>1. 學生基本資料</h3>
          <div className="iep-table-grid iep-table-grid--four">
            <div className="field-group"><label htmlFor="student-name">姓名</label><input id="student-name" type="text" {...control('studentName')} /></div>
            <div className="field-group gender-field"><span className="field-label">性別</span><div className="radio-group segmented-control"><label><input type="radio" name="gender" value="male" checked={values.gender === 'male'} onChange={() => updateValue('gender', 'male')} /> 男</label><label><input type="radio" name="gender" value="female" checked={values.gender === 'female'} onChange={() => updateValue('gender', 'female')} /> 女</label></div></div>
            <div className="field-group"><label htmlFor="birth-date">出生日期</label><input id="birth-date" type="date" {...control('birthDate')} /></div>
            <div className="field-group"><label htmlFor="national-id">身分證字號</label><input id="national-id" type="text" {...control('nationalId')} /></div>
            <div className="field-group"><label htmlFor="student-id">學號</label><input id="student-id" type="text" {...control('studentId')} /></div>
            <div className="field-group"><label htmlFor="student-grade">年級</label><select id="student-grade" {...control('grade')}><option value="">請選擇</option>{['一年級', '二年級', '三年級', '四年級', '五年級', '六年級'].map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field-group"><label htmlFor="student-class">班級</label><select id="student-class" {...control('className')}><option value="">請選擇</option>{['1班', '2班', '3班', '4班', '5班', '其他'].map((option) => <option key={option}>{option}</option>)}</select><input type="hidden" value={[values.grade, values.className].filter(Boolean).join(' ')} readOnly /></div>
            <div className="field-group"><label htmlFor="homeroom-teacher">導師</label><input id="homeroom-teacher" type="text" {...control('homeroomTeacher')} /></div>
            <div className="field-group"><label htmlFor="class-entry-date">入班時間</label><input id="class-entry-date" type="date" {...control('classEntryDate')} /></div>
            <div className="field-group field-group--full"><label htmlFor="registered-address">戶籍地址</label><input id="registered-address" type="text" {...control('registeredAddress')} /></div>
            <div className="field-group field-group--full"><label htmlFor="residential-address">居住地址</label><input id="residential-address" type="text" readOnly={Boolean(checks.sameAddress)} {...control('residentialAddress')} /><label className="inline-check"><input type="checkbox" checked={Boolean(checks.sameAddress)} onChange={(event) => toggleSameAddress(event.target.checked)} /> 同戶籍地址</label></div>
          </div>
        </section>

        <section className="iep-form-section">
          <h3>2. 鑑定與身心障礙證明</h3>
          <div className="placement-grid">
            <article className="assessment-group"><h4>鑑輔會最新鑑定</h4><div className="iep-table-grid">
              <div className="field-group"><label>鑑定日期<input type="date" {...control('committeeAssessmentDate')} /></label></div><div className="field-group"><label>重鑑日期<input type="date" {...control('committeeReassessmentDate')} /></label></div><div className="field-group"><label>文號<input type="text" {...control('committeeDocumentNumber')} /></label></div><div className="field-group"><label>特教字第＿＿號<input type="text" {...control('committeeSpecialEducationNumber')} /></label></div>
              <div className="field-group"><label>障礙類別<select {...control('committeeDisabilityCategory')}><option value="">請選擇</option>{disabilityCategories.map((option) => <option key={option}>{option}</option>)}</select></label></div><div className="field-group"><label>程度<select {...control('committeeSeverity')}><option value="">請選擇</option>{severityLevels.map((option) => <option key={option}>{option}</option>)}</select></label></div>
            </div></article>
            <article className="assessment-group"><h4>有效身心障礙證明</h4><div className="iep-table-grid">
              <div className="field-group"><label>鑑定日期<input type="date" {...control('proofAssessmentDate')} /></label></div><div className="field-group"><label>重鑑日期<input type="date" {...control('proofReassessmentDate')} /></label></div>
              <div className="field-group"><label htmlFor="icf-category">ICF 類別</label><select id="icf-category" {...control('icfCategory')}><option value="">請選擇（待依正式資料確認）</option><option value="physical">肢體功能相關（待確認）</option><option value="sensory">感官功能相關（待確認）</option><option value="mental">心智／心理功能相關（待確認）</option><option value="other">其他</option></select>{values.icfCategory === 'other' && <input type="text" placeholder="請輸入其他 ICF 類別" {...control('icfOther')} />}</div>
              <div className="field-group"><label htmlFor="icf-level">程度</label><select id="icf-level" {...control('icfLevel')}><option value="">請選擇</option>{severityLevels.map((option) => <option key={option}>{option}</option>)}</select></div><div className="field-group field-group--full"><label>ICD 診斷<input type="text" {...control('icdDiagnosis')} /></label></div>
            </div></article>
          </div>
        </section>

        <section className="iep-form-section"><h3>3. 健康與醫療資料</h3><div className="health-stack">
          <div className="compact-section"><div className="question-row"><span className="field-label">特殊疾病</span><RadioPair name="special-disease" value={values.specialDisease} onChange={(value) => updateValue('specialDisease', value)} /></div>{values.specialDisease === 'has' && <div className="conditional-fields health-detail-grid"><div className="checkbox-group">{['氣喘病', '心臟病', '癲癇'].map((label) => <label key={label}><input type="checkbox" checked={Boolean(checks[label])} onChange={(event) => toggleCheck(label, event.target.checked)} /> {label}</label>)}<label><input type="checkbox" checked={Boolean(checks.diseaseOther)} onChange={(event) => toggleCheck('diseaseOther', event.target.checked)} /> 其他</label></div><div className="field-group"><label htmlFor="disease-description">疾病名稱／狀況說明</label><input id="disease-description" type="text" {...control('diseaseDescription')} /></div>{checks.diseaseOther && <div className="field-group"><label htmlFor="disease-other">其他疾病名稱</label><input id="disease-other" type="text" {...control('diseaseOther')} /></div>}</div>}</div>
          <div className="compact-section"><div className="question-row"><span className="field-label">定期使用藥物</span><RadioPair name="regular-medication" value={values.regularMedication} onChange={(value) => updateValue('regularMedication', value)} /></div>{values.regularMedication === 'has' && <div className="conditional-fields"><div className="dynamic-table"><div className="dynamic-table-head medication-row"><span>藥物名稱</span><span>使用／服用方式</span><span>臨床用途／功用</span><span>可能副作用</span><span>操作</span></div>{medications.map((medication) => <div className="medication-row medication-entry" key={medication.id}>{(['name', 'directions', 'purpose', 'sideEffects'] as const).map((field) => <div className="medication-cell" key={field}><input type="text" aria-label={field} value={medication[field]} onChange={(event) => updateMedication(medication.id, field, event.target.value)} /></div>)}<div className="medication-cell medication-cell--action"><button className="icon-button" type="button" aria-label="刪除此藥物" onClick={() => setMedications((current) => current.filter((item) => item.id !== medication.id))}>刪除</button></div></div>)}</div><button className="button button--secondary" type="button" onClick={addMedication}>新增藥物</button></div>}</div>
          <div className="compact-section"><span className="field-label">特殊狀況</span><div className="special-condition-grid">{([{ title: '禁忌食物', key: 'foodRestriction', detail: 'foodRestrictionDescription', label: '禁忌食物名稱' }, { title: '食物過敏', key: 'foodAllergy', detail: 'foodAllergyDescription', label: '過敏食物' }, { title: '藥物過敏', key: 'drugAllergy', detail: 'drugAllergyDescription', label: '過敏藥物' }] as const).map((item) => <div className="condition-card" key={item.key}><strong>{item.title}</strong><RadioPair name={item.key} value={values[item.key]} onChange={(value) => updateValue(item.key, value)} />{values[item.key] === 'has' && <div className="conditional-fields"><label>{item.label}<input type="text" {...control(item.detail)} /></label></div>}</div>)}</div><div className="field-group subsection"><label>其他特殊狀況（選填）<textarea rows={3} {...control('otherSpecialCondition')} /></label></div></div>
          <div className="compact-section"><div className="question-row"><span className="field-label">經常就診醫院</span><RadioPair name="hospital" value={values.hospital} onChange={(value) => updateValue('hospital', value)} /></div>{values.hospital === 'has' && <div className="conditional-fields iep-table-grid iep-table-grid--four">{([['hospitalName', '醫院名稱'], ['hospitalDepartment', '就醫科別'], ['hospitalFrequency', '就診頻率'], ['hospitalDoctor', '主治醫師']] as const).map(([key, label]) => <div className="field-group" key={key}><label>{label}<input type="text" {...control(key)} /></label></div>)}</div>}</div>
        </div></section>

        <section className="iep-form-section" id="caregiver-section"><h3>4. 家庭與照顧者資料</h3><div className="placement-grid">
          <CaregiverCard title="法定代理人" control={control} prefix="guardian" />
          <CaregiverCard title="實際照顧者" control={caregiverControl} sameGuardian={Boolean(checks.sameGuardian)} onSameGuardianChange={toggleSameGuardian} />
        </div><div className="contact-summary subsection"><div className="field-group"><span className="field-label">家庭經濟狀況</span><div className="radio-group segmented-control economic-status">{[['not-low-income', '非低收入'], ['near-low-income', '中低收入'], ['low-income', '低收入']].map(([value, label]) => <label key={value}><input type="radio" name="economic-status" value={value} checked={values.economicStatus === value} onChange={() => updateValue('economicStatus', value)} /> {label}</label>)}</div></div><div className="iep-table-grid iep-table-grid--three"><div className="field-group"><label>緊急聯絡人<input type="text" {...control('emergencyContact')} /></label></div><div className="field-group"><label>聯絡電話<input type="tel" {...control('emergencyPhone')} /></label></div><div className="field-group"><label>與學生關係<RelationshipSelect {...control('emergencyRelationship')} /></label></div></div></div></section>

        <section className="iep-form-section" id="family-basics-section"><h3>5. 家庭基本狀況</h3><div className="family-basics-grid">
          <div className="compact-section"><span className="field-label">家中手足</span><div className="sibling-fields">{([['siblingsOlderBrother', '兄'], ['siblingsYoungerBrother', '弟'], ['siblingsOlderSister', '姊'], ['siblingsYoungerSister', '妹']] as const).map(([key, label]) => <label className="sibling-item" key={key}><span>{label}</span><input type="number" min="0" {...control(key)} /><span aria-hidden="true">人</span></label>)}</div></div>
          <ConditionalFamilyCard title="父母是否為外籍人士" name="foreign-parent" value={values.foreignParent} onChange={(value) => updateValue('foreignParent', value)} visibleValue="yes"> <div className="iep-table-grid"><div className="field-group"><label>父親國籍<input type="text" {...control('fatherNationality')} /></label></div><div className="field-group"><label>母親國籍<input type="text" {...control('motherNationality')} /></label></div></div></ConditionalFamilyCard>
          <ConditionalFamilyCard title="父母是否為原住民" name="indigenous-parent" value={values.indigenousParent} onChange={(value) => updateValue('indigenousParent', value)} visibleValue="yes"> <div className="iep-table-grid"><div className="field-group"><label>父親族籍<input type="text" {...control('fatherIndigenousGroup')} /></label></div><div className="field-group"><label>母親族籍<input type="text" {...control('motherIndigenousGroup')} /></label></div></div></ConditionalFamilyCard>
          <ConditionalFamilyCard title="家中成員是否有其他身心障礙個案" name="family-disability" value={values.familyDisability} onChange={(value) => updateValue('familyDisability', value)} visibleValue="has"> <div className="iep-table-grid"><div className="field-group"><label>與學生關係<RelationshipSelect {...control('familyDisabilityRelationship')} /></label></div><div className="field-group"><label>障礙情形／說明<textarea rows={3} {...control('familyDisabilityDescription')} /></label></div></div></ConditionalFamilyCard>
        </div></section>

        <section className="iep-form-section" id="family-support-section"><h3>6. 家庭支持</h3><div className="family-support-layout"><div className="field-group"><label>家庭支持現況<textarea rows={4} {...control('familySupportSituation')} /></label></div><div className="compact-section"><span className="field-label">家庭支持服務</span><div className="checkbox-group support-services"><label><input type="checkbox" checked={Boolean(checks.supportNone)} onChange={(event) => toggleSupport('supportNone', event.target.checked)} /> 無此需要</label>{serviceOptions.map(([key, label]) => <label key={key}><input type="checkbox" disabled={Boolean(checks.supportNone)} checked={Boolean(checks[key])} onChange={(event) => toggleSupport(key, event.target.checked)} /> {label}</label>)}</div>{checks.otherSupport && !checks.supportNone && <div className="conditional-fields"><label htmlFor="support-other-text">其他說明</label><input id="support-other-text" type="text" placeholder="請說明其他服務" {...control('otherSupportDescription')} /></div>}</div></div></section>
      </form>
    </section>
  )
}

function RadioPair({ name, value, onChange }: { name: string; value: string; onChange: (value: 'none' | 'has') => void }) {
  return <div className="radio-group"><label><input type="radio" name={name} value="none" checked={value === 'none'} onChange={() => onChange('none')} /> 無</label><label><input type="radio" name={name} value="has" checked={value === 'has'} onChange={() => onChange('has')} /> 有</label></div>
}

function RelationshipSelect(props: ControlProps) {
  return <select {...props}><option value="">請選擇</option>{relationships.map((option) => <option key={option}>{option}</option>)}</select>
}

function CaregiverCard({ title, control, prefix, sameGuardian, onSameGuardianChange }: { title: string; control: (key: string) => ControlProps; prefix?: string; sameGuardian?: boolean; onSameGuardianChange?: (isChecked: boolean) => void }) {
  const key = (field: string) => `${prefix ?? 'caregiver'}${field}`
  return <article className="assessment-group"><div className="sub-card-heading"><h4>{title}</h4>{onSameGuardianChange && <label className="inline-check same-guardian"><input type="checkbox" checked={sameGuardian} onChange={(event) => onSameGuardianChange(event.target.checked)} /> 同法定代理人</label>}</div><div className="iep-table-grid caregiver-fields"><div className="field-group"><label>姓名<input type="text" {...control(key('Name'))} /></label></div><div className="field-group"><label>與學生關係<RelationshipSelect {...control(key('Relationship'))} /></label></div><div className="field-group"><label>聯絡電話<input type="tel" {...control(key('Phone'))} /></label></div><div className="field-group"><label>年齡<input type="number" min="0" {...control(key('Age'))} /></label></div><div className="field-group"><label>教育程度<select {...control(key('Education'))}><option value="">請選擇</option>{educationLevels.map((option) => <option key={option}>{option}</option>)}</select></label></div><div className="field-group"><label>職業<input type="text" {...control(key('Occupation'))} /></label></div></div></article>
}

function ConditionalFamilyCard({ title, name, value, onChange, visibleValue, children }: { title: string; name: string; value: string; onChange: (value: string) => void; visibleValue: string; children: ReactNode }) {
  return <div className="compact-section"><div className="question-row"><span className="field-label">{title}</span><div className="radio-group"><label><input type="radio" name={name} value={visibleValue === 'yes' ? 'no' : 'none'} checked={value !== visibleValue} onChange={() => onChange(visibleValue === 'yes' ? 'no' : 'none')} /> {visibleValue === 'yes' ? '否' : '無'}</label><label><input type="radio" name={name} value={visibleValue} checked={value === visibleValue} onChange={() => onChange(visibleValue)} /> {visibleValue === 'yes' ? '是' : '有'}</label></div></div>{value === visibleValue && <div className="conditional-fields">{children}</div>}</div>
}
