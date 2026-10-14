export interface MainChapter {
  id: string
  label: string
}

interface MainChapterTabsProps {
  chapters: readonly MainChapter[]
  activeChapter: string
  onChange: (chapterId: string) => void
}

export function MainChapterTabs({ chapters, activeChapter, onChange }: MainChapterTabsProps) {
  return (
    <nav className="main-navigation" aria-label="IEP 主章節">
      <div className="page-container tab-scroll-area">
        <div className="main-tabs" role="tablist">
          {chapters.map((chapter) => {
            const isActive = chapter.id === activeChapter
            return (
              <button
                key={chapter.id}
                className={`main-tab${isActive ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`chapter-${chapter.id}`}
                id={`chapter-tab-${chapter.id}`}
                onClick={() => onChange(chapter.id)}
              >
                {chapter.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
