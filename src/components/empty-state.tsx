import { Layers3, Plus, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  filtered: boolean
  canAdd: boolean
  onAdd: () => void
  onClear: () => void
}

export function EmptyState({ filtered, canAdd, onAdd, onClear }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{filtered ? <SearchX size={24} strokeWidth={1.5} /> : <Layers3 size={24} strokeWidth={1.5} />}</div>
      <h2>{filtered ? "Nothing matches your filters" : "Your library starts here"}</h2>
      <p>{filtered ? "Try a different title, status, or media tab." : canAdd ? "Add your first movie, show, game, or book to keep it all in one place." : "There are no entries to show yet."}</p>
      {filtered
        ? <Button variant="outline" onClick={onClear}>Clear filters</Button>
        : canAdd ? <Button onClick={onAdd}><Plus size={16} /> Add your first entry</Button> : null}
    </div>
  )
}
