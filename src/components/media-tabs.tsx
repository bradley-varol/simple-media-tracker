import { MediaTypeIcon } from "@/components/media-type-icon"
import type { MediaTab } from "@/lib/media"
import { MEDIA_LABELS, type MediaType } from "@/types/media"

type Props = {
  active: MediaTab
  counts: Record<MediaTab, number>
  /** The types to draw tabs for, which a guest may get fewer of than the owner. */
  types: MediaType[]
  onChange: (tab: MediaTab) => void
}

export function MediaTabs({ active, counts, types, onChange }: Props) {
  const tabs: MediaTab[] = ["all", ...types]

  return (
    <div className="tabs-scroll">
      <div className="media-tabs" role="tablist" aria-label="Media type">
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={active === tab}
            aria-controls="media-panel"
            tabIndex={active === tab ? 0 : -1}
            className={`media-tab ${active === tab ? "is-active" : ""}`}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
              event.preventDefault()
              const next = (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
              onChange(tabs[next])
              document.getElementById(`tab-${tabs[next]}`)?.focus()
            }}
          >
            <MediaTypeIcon type={tab} className="size-[17px]" strokeWidth={1.8} />
            <span>{tab === "all" ? "All" : MEDIA_LABELS[tab as MediaType]}</span>
            <span className="tab-count">{counts[tab]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
