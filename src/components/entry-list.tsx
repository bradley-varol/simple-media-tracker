import { useEffect, useState } from "react"
import { EntryRow } from "@/components/entry-row"
import type { EntryGroup } from "@/lib/media"
import { SEASONED_TYPES, type MediaEntry } from "@/types/media"
import type { AppSettings } from "@/types/settings"

type Props = {
  groups: EntryGroup[]
  canManage: boolean
  settings: AppSettings
  onEdit: (entry: MediaEntry) => void
  onDelete: (entry: MediaEntry) => void
  onToggleHidden: (entry: MediaEntry) => void
  onAddSeason: (series: MediaEntry) => void
}

export function EntryList({ groups, canManage, settings, onEdit, onDelete, onToggleHidden, onAddSeason }: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // A season matching the current filters is the reason its series is on screen
  // at all, so open those groups automatically rather than hiding the match
  // behind a collapsed row. A series that matches on its own stays collapsed:
  // nothing is hidden behind the toggle that put it there.
  const autoExpanded = groups
    .filter((group) => !group.matched && group.matchedSeasons.length > 0)
    .map((group) => group.entry.id)
    .join(",")

  useEffect(() => {
    if (!autoExpanded) return
    setExpanded((current) => {
      const next = new Set(current)
      for (const id of autoExpanded.split(",")) next.add(id)
      return next
    })
  }, [autoExpanded])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={settings.finishedDatesEnabled ? "entry-list" : "entry-list without-dates"}>
      <div className="list-heading" aria-hidden="true">
        <span>Title</span>
        <span>Status</span>
        {settings.finishedDatesEnabled && <span>Date finished</span>}
        <span>Rating</span>
        <span />
      </div>
      <ul>
        {groups.map((group) => {
          const isExpanded = expanded.has(group.entry.id)
          // A season whose series is missing is listed at the top level, but it
          // is still a season, and a season cannot have seasons.
          const takesSeasons = SEASONED_TYPES.includes(group.entry.type) && !group.entry.parent
          return (
            <li key={group.entry.id} className="entry-group">
              <ul>
                <EntryRow
                  entry={group.entry}
                  canManage={canManage}
                  settings={settings}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleHidden={onToggleHidden}
                  onAddSeason={takesSeasons ? () => onAddSeason(group.entry) : undefined}
                  seasonCount={group.matchedSeasons.length}
                  totalSeasonCount={group.seasons.length}
                  expanded={isExpanded}
                  onToggleSeasons={group.matchedSeasons.length > 0 ? () => toggle(group.entry.id) : undefined}
                  inheritedDate={group.inheritedDate}
                />
                {isExpanded && group.matchedSeasons.map((season) => (
                  <EntryRow
                    key={season.id}
                    entry={season}
                    canManage={canManage}
                    settings={settings}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleHidden={onToggleHidden}
                    isSeason
                  />
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
