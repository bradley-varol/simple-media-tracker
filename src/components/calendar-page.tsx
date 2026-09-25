import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { CalendarYear } from "@/components/calendar-year"
import { MediaTypeIcon } from "@/components/media-type-icon"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MediaEntry } from "@/types/media"
import type { AppSettings } from "@/types/settings"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

type Props = {
  entries: MediaEntry[]
  settings: AppSettings
  canManage: boolean
  onEdit: (entry: MediaEntry) => void
}

/** Days in a Monday-first grid covering the whole month, as yyyy-mm-dd keys. */
function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1))
  // getUTCDay is Sunday-first; shift so Monday starts the week.
  const lead = (first.getUTCDay() + 6) % 7
  const start = new Date(Date.UTC(year, month, 1 - lead))

  const days: string[] = []
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    days.push(day.toISOString().slice(0, 10))
    // Stop once the month is finished and the week is complete.
    if (index >= 27 && index % 7 === 6) {
      const next = new Date(day)
      next.setUTCDate(day.getUTCDate() + 1)
      if (next.getUTCMonth() !== month) break
    }
  }
  return days
}

type View = "month" | "year"

export function CalendarPage({ entries, settings, canManage, onEdit }: Props) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }))
  const [view, setView] = useState<View>("month")

  const byDate = useMemo(() => {
    const map = new Map<string, MediaEntry[]>()
    for (const entry of entries) {
      if (!entry.dateFinished) continue
      const existing = map.get(entry.dateFinished)
      if (existing) existing.push(entry)
      else map.set(entry.dateFinished, [entry])
    }
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title))
    return map
  }, [entries])

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
    .format(new Date(cursor.year, cursor.month, 1))
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const monthCount = useMemo(
    () => days.filter((day) => Number(day.slice(5, 7)) === cursor.month + 1)
      .reduce((total, day) => total + (byDate.get(day)?.length ?? 0), 0),
    [days, byDate, cursor],
  )

  const yearCount = useMemo(() => {
    let total = 0
    for (const [date, dayEntries] of byDate) {
      if (Number(date.slice(0, 4)) === cursor.year) total += dayEntries.length
    }
    return total
  }, [byDate, cursor.year])

  // An entry with no completion date cannot appear in either view. Saying so is
  // more useful over a year, where the gap between the library count and what is
  // on screen is wide enough to look like a bug.
  const undatedCount = useMemo(() => entries.filter((entry) => !entry.dateFinished).length, [entries])

  const isYear = view === "year"
  const count = isYear ? yearCount : monthCount
  const period = isYear ? "year" : "month"
  const heading = isYear ? String(cursor.year) : monthLabel

  /** Steps a month in month view and a whole year in year view. */
  function shift(by: number) {
    setCursor((current) => {
      if (isYear) return { ...current, year: current.year + by }
      const date = new Date(current.year, current.month + by, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  function openMonth(month: number) {
    setCursor((current) => ({ ...current, month }))
    setView("month")
  }

  return (
    <div className="calendar-page">
      <header className="page-heading calendar-heading">
        <div>
          <h1>{heading}</h1>
          <p>{count === 0 ? `Nothing finished this ${period}` : `${count} finished this ${period}`}</p>
        </div>
        <div className="calendar-nav">
          <div className="view-toggle" role="group" aria-label="Calendar view">
            {(["month", "year"] as View[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                className={view === option ? "view-toggle-option is-active" : "view-toggle-option"}
                onClick={() => setView(option)}
              >
                {option === "month" ? "Month" : "Year"}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" aria-label={`Previous ${period}`} onClick={() => shift(-1)}>
            <ChevronLeft size={15} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
          >
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Next ${period}`} onClick={() => shift(1)}>
            <ChevronRight size={15} />
          </Button>
        </div>
      </header>

      {isYear ? (
        <CalendarYear
          year={cursor.year}
          byDate={byDate}
          settings={settings}
          canManage={canManage}
          onEdit={onEdit}
          onOpenMonth={openMonth}
        />
      ) : (
        <div className="calendar-grid" role="grid" aria-label={`Entries completed in ${monthLabel}`}>
          {WEEKDAYS.map((day) => <div key={day} className="calendar-weekday" role="columnheader">{day}</div>)}
          {days.map((day) => {
            const inMonth = Number(day.slice(5, 7)) === cursor.month + 1
            const dayEntries = byDate.get(day) ?? []
            return (
              <div
                key={day}
                role="gridcell"
                className={`calendar-day${inMonth ? "" : " is-outside"}${day === todayKey ? " is-today" : ""}`}
              >
                <span className="calendar-date">{Number(day.slice(8, 10))}</span>
                <div className="calendar-entries">
                  {dayEntries.map((entry) => {
                    const content = (
                      <>
                        <span className={`calendar-entry-icon type-${entry.type}`}>
                          <MediaTypeIcon type={entry.type} size={12} strokeWidth={2} />
                        </span>
                        <span className="calendar-entry-title">{entry.title}</span>
                      </>
                    )
                    // Same as the year view: a guest gets a span rather than a
                    // disabled button, which would swallow the tooltip's hover.
                    return (
                      <Tooltip key={entry.id}>
                        <TooltipTrigger asChild>
                          {canManage
                            ? <button type="button" className="calendar-entry" onClick={() => onEdit(entry)}>{content}</button>
                            : <span className="calendar-entry">{content}</span>}
                        </TooltipTrigger>
                        <TooltipContent>
                          {entry.title}{entry.rating ? ` · ${entry.rating}/${settings.ratingScale}` : ""}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {count === 0 && (
        <div className="calendar-empty">
          <CalendarDays size={18} aria-hidden="true" />
          <p>Entries appear here on the day they were completed. Add a completion date to see one.</p>
        </div>
      )}

      <p className="calendar-legend">
        Only entries with a completion date appear here
        {undatedCount > 0 && `, so ${undatedCount} without one ${undatedCount === 1 ? "is" : "are"} not shown`}.
      </p>
    </div>
  )
}
