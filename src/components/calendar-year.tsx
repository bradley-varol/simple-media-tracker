import { useMemo } from "react"
import { MediaTypeIcon } from "@/components/media-type-icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate } from "@/lib/media"
import { MEDIA_LABELS_SINGULAR, type MediaEntry } from "@/types/media"
import { isExceptional, type AppSettings } from "@/types/settings"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type Props = {
  year: number
  /** Keyed by yyyy-mm-dd, already sorted within each day. */
  byDate: Map<string, MediaEntry[]>
  settings: AppSettings
  canManage: boolean
  onEdit: (entry: MediaEntry) => void
  /** Opens the month view on this month of the current year. */
  onOpenMonth: (month: number) => void
}

/**
 * Twelve buckets, one per month, holding that month's entries in the order they
 * were finished. Always twelve, so an empty month still gets a row rather than
 * the year silently skipping it.
 */
export function entriesByMonth(byDate: Map<string, MediaEntry[]>, year: number): MediaEntry[][] {
  const buckets: MediaEntry[][] = Array.from({ length: 12 }, () => [])

  for (const [date, entries] of byDate) {
    if (Number(date.slice(0, 4)) !== year) continue
    const month = Number(date.slice(5, 7)) - 1
    if (month < 0 || month > 11) continue
    buckets[month].push(...entries)
  }

  for (const bucket of buckets) {
    bucket.sort((a, b) => (a.dateFinished ?? "").localeCompare(b.dateFinished ?? "") || a.title.localeCompare(b.title))
  }
  return buckets
}

/**
 * A year of a sparse library reads better as twelve rows of titles than as a
 * mostly-empty grid of days: at roughly four entries a month the titles fit,
 * and "what did I play in March" is the question a year view is actually asked.
 * Which day it happened on stays in the month view, one click away.
 */
export function CalendarYear({ year, byDate, settings, canManage, onEdit, onOpenMonth }: Props) {
  const months = useMemo(() => entriesByMonth(byDate, year), [byDate, year])

  return (
    <div className="year-strip">
      {months.map((entries, month) => (
        <div key={MONTHS[month]} className="year-row">
          <button
            type="button"
            className="year-month"
            aria-label={`Open ${MONTHS[month]} ${year} in the month view`}
            onClick={() => onOpenMonth(month)}
          >
            {MONTHS[month].slice(0, 3)}
            {entries.length > 0 && <span className="year-month-count">{entries.length}</span>}
          </button>
          <div className="year-entries">
            {entries.length === 0 ? (
              <span className="year-empty" aria-label={`Nothing finished in ${MONTHS[month]}`}>—</span>
            ) : entries.map((entry) => {
              const details = [
                entry.title,
                MEDIA_LABELS_SINGULAR[entry.type],
                formatDate(entry.dateFinished),
                entry.rating
                  ? `${entry.rating}/${settings.ratingScale}${isExceptional(entry.rating, settings) ? " · exceptional" : ""}`
                  : null,
              ].filter(Boolean).join(" · ")
              const content = (
                <>
                  <span className={`calendar-entry-icon type-${entry.type}`}>
                    <MediaTypeIcon type={entry.type} size={11} strokeWidth={2} />
                  </span>
                  <span className="year-entry-title">{entry.title}</span>
                </>
              )
              // A guest cannot open the entry, so for them it is not a button: a
              // disabled one would swallow the hover the tooltip listens for.
              return (
                <Tooltip key={entry.id}>
                  <TooltipTrigger asChild>
                    {canManage
                      ? <button type="button" className="year-entry" onClick={() => onEdit(entry)}>{content}</button>
                      : <span className="year-entry">{content}</span>}
                  </TooltipTrigger>
                  <TooltipContent>{details}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
