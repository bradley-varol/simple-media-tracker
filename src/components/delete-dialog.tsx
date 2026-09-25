import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { BIN_DAYS } from "@/lib/media"
import type { MediaEntry } from "@/types/media"

type Props = {
  entry: MediaEntry | null
  /** Seasons that will go with it. Deleting a series deletes its seasons. */
  seasons: MediaEntry[]
  onClose: () => void
  /**
   * Moves the entry to Recently deleted. The server takes a series' seasons
   * along in the same request, so there is nothing to do here per season.
   */
  onDelete: (entry: MediaEntry) => Promise<void>
}

export function DeleteDialog({ entry, seasons, onClose, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmDelete() {
    if (!entry || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(entry)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this entry.")
    } finally {
      setDeleting(false)
    }
  }

  const seasonCount = `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"}`

  return (
    <AlertDialog open={Boolean(entry)} onOpenChange={(open) => { if (!open && !deleting) { setError(null); onClose() } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{seasons.length > 0 ? "Delete this series?" : "Delete this entry?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {entry
              ? seasons.length > 0
                ? `“${entry.title}” and its ${seasonCount} will move to Recently deleted in Settings, where you can restore them for ${BIN_DAYS} days.`
                : `“${entry.title}” will move to Recently deleted in Settings, where you can restore it for ${BIN_DAYS} days.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="form-error" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
            {deleting ? "Deleting..." : seasons.length > 0 ? `Delete series and ${seasonCount}` : "Delete entry"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
