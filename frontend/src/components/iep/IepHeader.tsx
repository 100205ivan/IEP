interface IepHeaderProps {
  studentName: string
  schoolYear: string
  semester: string
  saveStatus: 'unsaved' | 'saving' | 'saved' | 'error'
  onSave: () => void
  onSchoolYearChange: (value: string) => void
  disabled?: boolean
}

const statusLabels = { unsaved: '尚未儲存', saving: '儲存中', saved: '儲存成功', error: '儲存失敗' }

export function IepHeader({ studentName, schoolYear, semester, saveStatus, onSave, onSchoolYearChange, disabled }: IepHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-content page-container">
        <div className="brand">
          <span className="brand-name">EyeEP</span>
          <span className="brand-subtitle">個別化教育計畫</span>
        </div>
        <div className="student-summary" aria-label="目前學生與學期">
          <span className="student-name">{studentName}</span>
          <label className="school-year-editor">學年度 <input aria-label="學年度" inputMode="numeric" value={schoolYear} onChange={(event) => onSchoolYearChange(event.target.value)} /></label>
          <span>{semester}</span>
        </div>
        <div className="header-actions">
          <div className="save-status" role="status">
            <span className="status-dot" aria-hidden="true" />
            {statusLabels[saveStatus]}
          </div>
          <button className="button button--primary iep-save-button" type="button" onClick={onSave} disabled={disabled || saveStatus === 'saving'}>{saveStatus === 'saving' ? '儲存中…' : '儲存 IEP'}</button>
        </div>
      </div>
    </header>
  )
}
