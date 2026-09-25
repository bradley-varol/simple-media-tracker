import { useState } from "react"
import { X } from "lucide-react"
import { Toast } from "radix-ui"
import { BIN_DAYS } from "@/lib/media"
import type { MediaEntry } from "@/types/media"

/** What the last delete moved to Recently deleted. */
export type Deletion = {
  entry: MediaEntry
  seasons: number
}

type Props = {
  /**
   * Left in place once the toast closes: it is only ever replaced by the next
   * delete, which keeps the exit animation from being cut off by an unmount.
   */
  deletion: Deletion | null
  /**
   * The deletion is no longer in the bin as it went in: restored or removed
   * from Settings while the toast was still up. There is nothing left for Undo
   * to do, so the toast closes rather than offering it.
   */
  settled: boolean
  onUndo: (entry: MediaEntry) => Promise<unknown>
}

/**
 * Long enough to notice the wrong row went and reach for the button. Radix
 * holds the timer while the pointer or focus is on the toast, so reading it —
 * or the reason an undo failed — does not run the clock down.
 */
const UNDO_MS = 10_000

export function UndoToast({ deletion, settled, onUndo }: Props) {
  return (
    <Toast.Provider duration={UNDO_MS} swipeDirection="down">
      {/* Keyed on the deletion, so a second delete starts a fresh toast and
          timer rather than relabelling the first one mid-countdown. */}
      {deletion && (
        <DeletionToast
          key={`${deletion.entry.id}:${deletion.entry.deleted}`}
          deletion={deletion}
          settled={settled}
          onUndo={onUndo}
        />
      )}
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  )
}

function DeletionToast({ deletion, settled, onUndo }: { deletion: Deletion } & Omit<Props, "deletion">) {
  const [open, setOpen] = useState(true)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { entry, seasons } = deletion
  const what = seasons > 0
    ? `“${entry.title}” and ${seasons} ${seasons === 1 ? "season" : "seasons"}`
    : `“${entry.title}”`
  const where = `${seasons > 0 ? "They wait" : "It waits"} in Recently deleted in Settings for ${BIN_DAYS} days.`
  const still = `${seasons > 0 ? "They are" : "It is"} still in Recently deleted in Settings.`

  async function undo() {
    if (undoing) return
    setUndoing(true)
    setError(null)
    try {
      await onUndo(entry)
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore it.")
    } finally {
      setUndoing(false)
    }
  }

  return (
    <Toast.Root
      className="toast"
      open={open && !settled}
      onOpenChange={setOpen}
    >
      <div className="toast-copy">
        <Toast.Title className="toast-title">Deleted {what}</Toast.Title>
        <Toast.Description className="toast-description">
          {error ? `${error} ${still}` : where}
        </Toast.Description>
      </div>
      {/* The action is a real Radix action, so screen readers are told where
          else to find it: they may not reach the toast before it goes. */}
      <Toast.Action asChild altText="Restore it from Recently deleted in Settings">
        <button type="button" className="toast-action" disabled={undoing} onClick={(event) => { event.preventDefault(); void undo() }}>
          {undoing ? "Restoring..." : "Undo"}
        </button>
      </Toast.Action>
      <Toast.Close className="toast-close" aria-label="Dismiss">
        <X size={14} aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  )
}
