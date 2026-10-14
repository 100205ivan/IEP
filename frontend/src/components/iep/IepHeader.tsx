interface IepHeaderProps {
  studentName: string
  schoolYear: string
  semester: string
}

export function IepHeader({ studentName, schoolYear, semester }: IepHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-content page-container">
        <div className="brand">
          <span className="brand-name">EyeEP</span>
          <span className="brand-subtitle">個別化教育計畫</span>
        </div>
        <div className="student-summary" aria-label="目前學生與學期">
          <span className="student-name">{studentName}</span>
          <span>{schoolYear}學年度</span>
          <span>{semester}</span>
        </div>
        <div className="save-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          尚未連接儲存功能
        </div>
      </div>
    </header>
  )
}
