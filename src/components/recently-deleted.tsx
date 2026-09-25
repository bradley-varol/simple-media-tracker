import { useEffect, useMemo, useRef, useState } from "react"
import { Check, RotateCcw, Trash2 } from "lucide-react"
import { MediaTypeIcon } from "@/components/media-type-icon"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BIN_DAYS, binGroups, binnedSeasonsOf, deletedLabel, timeLeftLabel, type BinGroup } from "@/lib/media"
import { MEDIA_LABELS_SINGULAR, type MediaEntry } from "@/types/media"

/** How long a finished action's note stays up, the same as a settings save's "Saved". */
const NOTE_MS = 2600

type Props = {
  /** The library, for naming the series of a season deleted on its own. */
  entries: MediaEntry[]
  binned: MediaEntry[]
  onRestore: (entry: MediaEntry) => Promise<MediaEntry[]>
  onRemoveForGood: (entry: MediaEntry) => Promise<void>
  onEmpty: () => Promise<void>
}

/**
 * What a confirmation is about. Kept, rather than cleared, once it is answered,
 * so the dialog does not spend its fade-out showing a question with the names
 * taken out of it.
 */
type Confirmation =
  | { kind: "one"; group: BinGroup; index: number; seasons: number; separate: number; open: boolean }
  | { kind: "all"; count: number; open: boolean }

function entryCount(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`
}

function seasonCount(count: number) {
  return `${count} ${count === 1 ? "season" : "seasons"}`
}

/** What the row is, before when it went: its type, its seasons or its series. */
function describe(group: BinGroup): string {
  const { entry, seasons, series } = group
  if (series) return `Season of ${series.title}${series.deleted ? ", also deleted" : ""}`
  const type = MEDIA_LABELS_SINGULAR[entry.type]
  return seasons.length > 0 ? `${type} · ${seasonCount(seasons.length)}` : type
}

export function RecentlyDeleted({ entries, binned, onRestore, onRemoveForGood, onEmpty }: Props) {
  const groups = useMemo(() => binGroups(binned, entries), [binned, entries])
  // One action at a time: a restore and a removal racing over the same series
  // would each be answering a question the other had already changed.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)

  // A finished action takes its row, and the button that had focus, out of the
  // page. Focus moves to the row that slides into its place, or the one above
  // if it was the last, or the heading once the list is empty — rather than
  // dropping to the top of the document.
  const headingRef = useRef<HTMLDivElement>(null)
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>())
  const focusAfter = useRef<number | null>(null)

  //
  // It waits for `busy` to clear as well as for the list to change: a disabled
  // button cannot take focus, and the two may not land in the same render.
  useEffect(() => {
    if (focusAfter.current === null || busy) return
    const index = Math.min(focusAfter.current, groups.length - 1)
    focusAfter.current = null
    const next = index >= 0 ? restoreButtons.current.get(groups[index].entry.id) : undefined
    ;(next ?? headingRef.current)?.focus()
  }, [groups, busy])

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), NOTE_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  // Read once per render rather than ticking: nothing here is precise to less
  // than a day, and the page is rarely open long enough for a day to turn.
  const now = new Date()

  /**
   * Runs one action and says how it went. `index` is the row it empties, which
   * is where focus goes once the list has redrawn without it.
   */
  async function run(index: number, action: () => Promise<string>) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNote(null)
    focusAfter.current = index
    try {
      setNote(await action())
    } catch (caught) {
      focusAfter.current = null
      setError(caught instanceof Error ? caught.message : "Could not change Recently deleted.")
    } finally {
      setBusy(false)
    }
  }

  function restore(group: BinGroup, index: number) {
    void run(index, async () => {
      const restored = await onRestore(group.entry)
      const others = restored.length - 1
      return others > 0
        ? `Restored “${group.entry.title}” and ${others} more`
        : `Restored “${group.entry.title}”`
    })
  }

  function confirmed() {
    if (!confirm) return
    setConfirm({ ...confirm, open: false })
    if (confirm.kind === "all") {
      void run(0, async () => {
        await onEmpty()
        return "Emptied Recently deleted"
      })
    } else {
      const { group, index } = confirm
      void run(index, async () => {
        await onRemoveForGood(group.entry)
        return `Deleted “${group.entry.title}” for good`
      })
    }
  }

  /**
   * What Delete for good takes with a series: every season of it in the bin,
   * including any deleted on their own before it, which have rows of their own
   * that go too. Said in the dialog, since the row only counts the seasons that
   * went in with it.
   */
  function askRemove(group: BinGroup, index: number) {
    const seasons = group.entry.parent ? 0 : binnedSeasonsOf(binned, group.entry.id).length
    setConfirm({ kind: "one", group, index, seasons, separate: seasons - group.seasons.length, open: true })
  }

  return (
    <Card className="settings-card">
      <CardHeader>
        {/* Focusable from script only, as the place focus lands once the last
            row has gone. */}
        <CardTitle ref={headingRef} tabIndex={-1} className="bin-heading">Recently deleted</CardTitle>
        <CardDescription>
          Deleted entries wait here for {BIN_DAYS} days, then are deleted for good. Restoring one puts it
          back as it was, with the seasons that were deleted alongside it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="form-error bin-error" role="alert">{error}</p>}

        {groups.length === 0 ? (
          <p className="bin-empty">Nothing has been deleted in the last {BIN_DAYS} days.</p>
        ) : (
          <ul className="bin-list">
            {groups.map((group, index) => {
              const { entry, series } = group
              // A season comes back into its series, so restoring one whose
              // series is also here brings the series with it. Said on the
              // button, because it changes what the click does.
              const bringsSeries = series?.deleted ? series : null
              const restoreButton = (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bin-restore"
                  disabled={busy}
                  ref={(node) => {
                    if (node) restoreButtons.current.set(entry.id, node)
                    else restoreButtons.current.delete(entry.id)
                  }}
                  aria-label={bringsSeries ? `Restore “${entry.title}” and “${bringsSeries.title}”` : `Restore “${entry.title}”`}
                  onClick={() => restore(group, index)}
                >
                  <RotateCcw size={13} aria-hidden="true" /> Restore
                </Button>
              )
              return (
                <li key={entry.id} className="bin-row">
                  <span className={`entry-type-icon type-${entry.type}`}>
                    <MediaTypeIcon type={entry.type} size={15} strokeWidth={1.75} />
                  </span>
                  <div className="bin-row-copy">
                    <span className="bin-row-title">{entry.title}</span>
                    <span className="bin-row-meta">
                      {describe(group)} · {deletedLabel(entry.deleted ?? "", now)} · {timeLeftLabel(entry.deleted ?? "", now)}
                    </span>
                  </div>
                  <div className="bin-row-actions">
                    {bringsSeries ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{restoreButton}</TooltipTrigger>
                        <TooltipContent>Brings “{bringsSeries.title}” back too</TooltipContent>
                      </Tooltip>
                    ) : restoreButton}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="row-action-button"
                          disabled={busy}
                          aria-label={`Delete “${entry.title}” for good`}
                          onClick={() => askRemove(group, index)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete for good</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Kept in the layout while empty, so it is a live region before it
            has anything to announce: a row that is acted on simply vanishes,
            and this is what says what became of it. */}
        <div className="bin-footer">
          <p className="bin-status" role="status" aria-live="polite">
            {note && <><Check size={13} aria-hidden="true" /> {note}</>}
          </p>
          {groups.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bin-empty-button"
              disabled={busy}
              onClick={() => setConfirm({ kind: "all", count: binned.length, open: true })}
            >
              Empty Recently deleted
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog
        open={confirm?.open ?? false}
        onOpenChange={(open) => { if (!open) setConfirm((current) => (current ? { ...current, open: false } : null)) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "all"
                ? "Empty Recently deleted?"
                : `Delete “${confirm?.group.entry.title ?? ""}” for good?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "all"
                ? `All ${entryCount(confirm.count)} in it will be deleted for good. This cannot be undone.`
                : confirm && confirm.seasons > 0
                  ? `Its ${seasonCount(confirm.seasons)} ${confirm.seasons === 1 ? "goes" : "go"} with it${confirm.separate > 0 ? `, including ${confirm.separate} listed on ${confirm.separate === 1 ? "its" : "their"} own` : ""}. This cannot be undone.`
                  : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmed}>
              {confirm?.kind === "all" ? "Empty Recently deleted" : "Delete for good"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
