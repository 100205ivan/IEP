export interface AssessmentSubChapter {
  id: string
  label: string
}

interface AssessmentSubTabsProps {
  chapters: readonly AssessmentSubChapter[]
  activeChapter: string
  onChange: (chapterId: string) => void
  ariaLabel?: string
  idPrefix?: string
}

export function AssessmentSubTabs({ chapters, activeChapter, onChange, ariaLabel = '壹、子章節', idPrefix = 'assessment' }: AssessmentSubTabsProps) {
  return (
    <nav className="sub-navigation" aria-label={ariaLabel}>
      <div className="sub-tabs" role="tablist">
        {chapters.map((chapter) => {
          const isActive = chapter.id === activeChapter
          return (
            <button
              key={chapter.id}
              className={`sub-tab${isActive ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-${chapter.id}`}
              id={`${idPrefix}-tab-${chapter.id}`}
              onClick={() => onChange(chapter.id)}
            >
              {chapter.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
