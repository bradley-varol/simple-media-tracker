import { ChevronRight, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { MediaTypeIcon } from "@/components/media-type-icon"
import { StarRating } from "@/components/star-rating"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate } from "@/lib/media"
import { MEDIA_LABELS, type MediaEntry } from "@/types/media"
import { hiddenFromGuests, type AppSettings } from "@/types/settings"

type Props = {
  entry: MediaEntry
  canManage: boolean
  settings: AppSettings
  onEdit: (entry: MediaEntry) => void
  onDelete: (entry: MediaEntry) => void
  onToggleHidden: (entry: MediaEntry) => void
  /** Opens a new entry as a season of this one. Only a series row has it. */
  onAddSeason?: () => void
  /** Seasons on show, which the filters may have narrowed. */
  seasonCount?: number
  /** Seasons the series actually has, for when the filters narrowed them. */
  totalSeasonCount?: number
  expanded?: boolean
  onToggleSeasons?: () => void
  isSeason?: boolean
  /** A date taken from this series' seasons, shown muted; see inheritedSeasonDate. */
  inheritedDate?: string | null
}

/**
 * Why guests cannot see this entry, for the owner's indicator. The reasons
 * stack — an entry can be hidden on its own and through its type — so name the
 * one that would surprise the owner if it went unsaid.
 */
function hiddenLabel(entry: MediaEntry, settings: AppSettings): string {
  if (!settings.guestViewing) return "Hidden from guests, which applies again when public viewing is on"
  if (settings.guestHiddenTypes.includes(entry.type)) {
    const kind = MEDIA_LABELS[entry.type].toLowerCase()
    return entry.hidden
      ? `Hidden from guests, and stays hidden once ${kind} are shown to them again`
      : `Hidden from guests along with all ${kind}`
  }
  return "Hidden from guests"
}

export function EntryRow({
  entry,
  canManage,
  settings,
  onEdit,
  onDelete,
  onToggleHidden,
  onAddSeason,
  seasonCount = 0,
  totalSeasonCount = seasonCount,
  expanded = false,
  onToggleSeasons,
  isSeason = false,
  inheritedDate = null,
}: Props) {
  // Filters narrow the seasons a group opens onto, so count what is actually
  // there rather than letting the row promise seasons the filters excluded.
  const seasonLabel = seasonCount === totalSeasonCount
    ? `${seasonCount} ${seasonCount === 1 ? "season" : "seasons"}`
    : `${seasonCount} of ${totalSeasonCount} seasons`

  return (
    <li className={isSeason ? "entry-row is-season" : "entry-row"}>
      <div className="entry-name-cell">
        <span className={`entry-type-icon type-${entry.type}`}>
          <MediaTypeIcon type={entry.type} size={isSeason ? 15 : 17} strokeWidth={1.75} />
        </span>
        <div className="entry-name-content">
          {canManage
            ? <button className="entry-title" type="button" onClick={() => onEdit(entry)}>{entry.title}</button>
            : <span className="entry-title is-static">{entry.title}</span>}
          {/* The disclosure lives on the count rather than in front of the
              title, so the icon and title sit flush left on every row instead
              of reserving room for a caret only some rows have. */}
          {seasonCount > 0 && (onToggleSeasons ? (
            <button
              type="button"
              className={expanded ? "season-count season-toggle is-expanded" : "season-count season-toggle"}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Hide" : "Show"} ${seasonLabel} of ${entry.title}`}
              onClick={onToggleSeasons}
            >
              <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
              {seasonLabel}
            </button>
          ) : (
            <span className="season-count">{seasonLabel}</span>
          ))}
        </div>
      </div>
      <div className="entry-status-cell"><StatusBadge status={entry.status} /></div>
      {settings.finishedDatesEnabled && (
        <div className="entry-date-cell">
          {inheritedDate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inherited-date">{formatDate(inheritedDate)}</span>
              </TooltipTrigger>
              <TooltipContent>From the latest season with a date</TooltipContent>
            </Tooltip>
          ) : formatDate(entry.dateFinished)}
        </div>
      )}
      <div className="entry-rating-cell"><StarRating rating={entry.rating} settings={settings} /></div>
      {canManage && (
        <div className="entry-actions-cell">
          {hiddenFromGuests(entry, settings) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden-indicator" role="img" aria-label={hiddenLabel(entry, settings)}>
                  <EyeOff size={14} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{hiddenLabel(entry, settings)}</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${entry.title}`} className="row-action-button">
                <MoreHorizontal size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => onEdit(entry)}><Pencil size={14} /> Edit entry</DropdownMenuItem>
              {onAddSeason && <DropdownMenuItem onSelect={onAddSeason}><Plus size={14} /> Add season</DropdownMenuItem>}
              {/* With no guests to hide from — public viewing off, or the whole
                  type kept from them — the action means nothing. The indicator
                  beside the menu still shows, so an entry already hidden is
                  never in a state the owner cannot see. */}
              {settings.guestViewing && !settings.guestHiddenTypes.includes(entry.type) && (
                <DropdownMenuItem onSelect={() => onToggleHidden(entry)}>
                  {entry.hidden ? <><Eye size={14} /> Unhide from guests</> : <><EyeOff size={14} /> Hide from guests</>}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(entry)}><Trash2 size={14} /> Delete entry</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  )
}
