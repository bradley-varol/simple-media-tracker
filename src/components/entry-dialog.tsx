import { useEffect, useState, type FormEvent } from "react"
import { ParentCombobox } from "@/components/parent-combobox"
import { StarRatingInput } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parentCandidates } from "@/lib/media"
import {
  FINISHED_STATUSES,
  MEDIA_LABELS_SINGULAR,
  SEASONED_TYPES,
  STATUSES,
  STATUS_LABELS,
  TITLE_MAX_LENGTH,
  type MediaEntry,
  type MediaEntryInput,
  type MediaStatus,
  type MediaType,
} from "@/types/media"
import type { AppSettings } from "@/types/settings"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: MediaEntry | null
  defaultType: MediaType
  /** The series a new entry starts as a season of, from a row's "Add season". */
  defaultParent: string | null
  entries: MediaEntry[]
  settings: AppSettings
  onSave: (input: MediaEntryInput, id?: string) => Promise<MediaEntry>
}

function makeDraft(entry: MediaEntry | null, defaultType: MediaType, defaultParent: string | null): MediaEntryInput {
  return entry
    ? {
      type: entry.type,
      title: entry.title,
      status: entry.status,
      dateFinished: entry.dateFinished,
      rating: entry.rating,
      hidden: entry.hidden,
      parent: entry.parent,
    }
    : { type: defaultType, title: "", status: "planned", dateFinished: null, rating: null, hidden: false, parent: defaultParent }
}

export function EntryDialog({ open, onOpenChange, entry, defaultType, defaultParent, entries, settings, onSave }: Props) {
  const [draft, setDraft] = useState<MediaEntryInput>(() => makeDraft(entry, defaultType, defaultParent))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A series named in the "Season of" field that does not exist yet. It is
  // created when this entry is saved rather than the moment it is named, so
  // closing the dialog cannot leave an empty series behind.
  const [newParent, setNewParent] = useState<string | null>(null)

  // A show that already has seasons cannot itself become one: the model is two
  // levels deep on purpose.
  const ownSeasonCount = entry ? entries.filter((item) => item.parent === entry.id).length : 0
  const candidates = parentCandidates(entries, draft.type, entry?.id)
  const canHaveSeasons = SEASONED_TYPES.includes(draft.type)
  // A date and a rating belong to something you have stopped: both fields
  // appear together, once the status says so.
  const isFinished = FINISHED_STATUSES.includes(draft.status)
  const showDate = isFinished && settings.finishedDatesEnabled

  // Keep the entry's existing type selectable even if it has since been turned
  // off, so editing it does not silently change what it is.
  const selectableTypes = settings.enabledTypes.includes(draft.type)
    ? settings.enabledTypes
    : [...settings.enabledTypes, draft.type]

  useEffect(() => {
    if (open) {
      setDraft(makeDraft(entry, defaultType, defaultParent))
      setNewParent(null)
      setError(null)
    }
  }, [open, entry, defaultType, defaultParent])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError(null)
    setSaving(true)
    try {
      let parent = draft.parent
      if (newParent) {
        // The series has to exist before a season can point at it. It takes its
        // status and visibility from the season: a series whose only season you
        // finished is not "planned", and one added alongside a hidden entry
        // should not put the title back in front of guests.
        const series = await onSave({
          type: draft.type,
          title: newParent,
          status: draft.status,
          dateFinished: null,
          rating: null,
          hidden: draft.hidden,
          parent: null,
        })
        parent = series.id
        // The series is saved even if the season below is not, so hold on to it:
        // a retry then links to it instead of creating a second one.
        setDraft((current) => ({ ...current, parent: series.id }))
        setNewParent(null)
      }
      await onSave({ ...draft, parent }, entry?.id)
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this entry. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <DialogContent className="entry-dialog sm:max-w-[490px]">
        <DialogHeader className="dialog-heading">
          <DialogTitle>{entry ? "Edit entry" : "Add to your library"}</DialogTitle>
          <DialogDescription>{entry ? "Update the details for this title." : "Keep track of what you want to experience."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="form-field">
            <Label htmlFor="entry-title">Title</Label>
            <Input
              id="entry-title"
              autoFocus
              required
              maxLength={TITLE_MAX_LENGTH}
              placeholder="What are you tracking?"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
          <div className="form-two-columns">
            <div className="form-field">
              <Label htmlFor="entry-type">Type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) => {
                  const type = value as MediaType
                  // Seasons only exist for types that have them, so drop the
                  // link rather than leaving a book pointing at a series.
                  const seasoned = SEASONED_TYPES.includes(type)
                  if (!seasoned) setNewParent(null)
                  setDraft({ ...draft, type, parent: seasoned ? draft.parent : null })
                }}
              >
                <SelectTrigger id="entry-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {selectableTypes.map((type) => (
                    <SelectItem key={type} value={type}>{MEDIA_LABELS_SINGULAR[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="form-field">
              <Label htmlFor="entry-status">Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => {
                  const status = value as MediaStatus
                  // Something you have gone back to has no day it was finished,
                  // so drop the date rather than saving one the form is no
                  // longer showing. The rating survives: a verdict you already
                  // formed is not undone by starting a rewatch, and the row
                  // keeps showing it.
                  //
                  // With finished dates switched off the form is not showing the
                  // date either way, so dropping it here would quietly delete a
                  // date the user cannot see and did not touch. Those are kept
                  // for the switch going back on.
                  const finished = FINISHED_STATUSES.includes(status) || !settings.finishedDatesEnabled
                  setDraft({ ...draft, status, dateFinished: finished ? draft.dateFinished : null })
                }}
              >
                <SelectTrigger id="entry-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {canHaveSeasons && (
            <div className="form-field">
              <Label htmlFor="entry-parent">Season of <span className="optional-label">Optional</span></Label>
              {ownSeasonCount > 0 ? (
                <p className="field-note">
                  This has {ownSeasonCount} {ownSeasonCount === 1 ? "season" : "seasons"} of its own, so it cannot also be a season.
                </p>
              ) : (
                <>
                  <ParentCombobox
                    id="entry-parent"
                    value={draft.parent}
                    pending={newParent}
                    options={candidates}
                    onChange={(parent) => { setNewParent(null); setDraft({ ...draft, parent }) }}
                    onCreate={(title) => { setNewParent(title); setDraft({ ...draft, parent: null }) }}
                  />
                  <p className="field-note">
                    {newParent
                      ? <>“{newParent}” will be added as a new series when you save.</>
                      : settings.finishedDatesEnabled
                        ? "Seasons keep their own rating, status and date, and sit under the series in your library."
                        : "Seasons keep their own rating and status, and sit under the series in your library."}
                  </p>
                </>
              )}
            </div>
          )}
          {showDate && (
            <div className="form-field">
              <Label htmlFor="entry-date">Date finished <span className="optional-label">Optional</span></Label>
              <Input
                id="entry-date"
                type="date"
                value={draft.dateFinished ?? ""}
                onChange={(event) => setDraft({ ...draft, dateFinished: event.target.value || null })}
              />
            </div>
          )}
          {isFinished && (
            <div className="form-field">
              <Label>Rating <span className="optional-label">Optional</span></Label>
              <StarRatingInput rating={draft.rating} settings={settings} onChange={(rating) => setDraft({ ...draft, rating })} />
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <DialogFooter className="form-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : entry ? "Save changes" : "Add entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
