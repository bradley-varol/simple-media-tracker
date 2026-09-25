import { ArrowDownUp, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SortOrder, StatusFilter } from "@/lib/media"
import { STATUSES, STATUS_LABELS } from "@/types/media"

type Props = {
  query: string
  onQueryChange: (value: string) => void
  status: StatusFilter
  onStatusChange: (value: StatusFilter) => void
  sort: SortOrder
  onSortChange: (value: SortOrder) => void
  /** Whether entries record a finished date, which the sort below reads. */
  showDates: boolean
  showing: number
  total: number
  canManage: boolean
  onAdd: () => void
}

export function ListToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  showDates,
  showing,
  total,
  canManage,
  onAdd,
}: Props) {
  return (
    <div className="list-toolbar">
      <div className="list-summary">
        <span className="summary-number">{showing}</span>
        <span>{showing === 1 ? "entry" : "entries"}{showing !== total ? ` of ${total}` : ""}</span>
      </div>
      <div className="toolbar-controls">
        <div className="search-field">
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label="Search titles"
            placeholder="Search titles..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear search" onClick={() => onQueryChange("")}>
              <X size={13} />
            </Button>
          )}
        </div>
        <Select value={status} onValueChange={(value) => onStatusChange(value as StatusFilter)}>
          <SelectTrigger aria-label="Filter by status" className="toolbar-select status-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((item) => <SelectItem key={item} value={item}>{STATUS_LABELS[item]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => onSortChange(value as SortOrder)}>
          <SelectTrigger aria-label="Sort entries" className="toolbar-select sort-select">
            <ArrowDownUp size={14} aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Title A–Z</SelectItem>
            <SelectItem value="rating">Highest rated</SelectItem>
            <SelectItem value="rating-asc">Lowest rated</SelectItem>
            {showDates && <SelectItem value="completed">Recently finished</SelectItem>}
          </SelectContent>
        </Select>
        {canManage && (
          <>
            <span className="toolbar-action-divider" aria-hidden="true" />
            <Button className="toolbar-add-button" onClick={onAdd}><Plus size={16} /> Add entry</Button>
          </>
        )}
      </div>
    </div>
  )
}
