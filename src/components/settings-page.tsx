import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Lock } from "lucide-react"
import { MediaTypeIcon } from "@/components/media-type-icon"
import { RecentlyDeleted } from "@/components/recently-deleted"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MEDIA_LABELS, MEDIA_TYPES, type MediaEntry, type MediaType } from "@/types/media"
import {
  convertRating,
  DEFAULT_SITE_TITLE,
  normalizeSiteTitle,
  RATING_SCALES,
  rescaleNeeded,
  SITE_TITLE_MAX_LENGTH,
  type AppSettings,
  type RatingScale,
} from "@/types/settings"

const listFormat = new Intl.ListFormat("en", { type: "conjunction" })

/**
 * How long typing has to stop before the name is saved. Long enough that a
 * normal pause mid-title is not a write, short enough that tabbing away and
 * looking at the header shows the new name.
 */
const TITLE_DEBOUNCE_MS = 600

/** How long "Saved" stays up before the line goes quiet again. */
const SAVED_NOTE_MS = 2600

/**
 * What stays marked hidden while public viewing is off: entries on their own
 * account, whole types, or both.
 */
function keptHiddenNote(entries: number, types: MediaType[]): string {
  const names = listFormat.format(types.map((type) => MEDIA_LABELS[type].toLowerCase()))
  const entryNote = `${entries} ${entries === 1 ? "entry is" : "entries are"} marked hidden from guests`
  if (types.length === 0) return `${entryNote}.`
  if (entries === 0) return `All ${names} are hidden from guests.`
  return `${entryNote}, and so are all ${names}.`
}

type Props = {
  settings: AppSettings
  /** The library, without what is in Recently deleted. */
  entries: MediaEntry[]
  binned: MediaEntry[]
  canManage: boolean
  onSave: (settings: AppSettings) => Promise<unknown>
  onRescale: (from: AppSettings, to: AppSettings) => Promise<number>
  onRestore: (entry: MediaEntry) => Promise<MediaEntry[]>
  onRemoveForGood: (entry: MediaEntry) => Promise<void>
  onEmptyBin: () => Promise<void>
}

export function SettingsPage({
  settings,
  entries,
  binned,
  canManage,
  onSave,
  onRescale,
  onRestore,
  onRemoveForGood,
  onEmptyBin,
}: Props) {
  // What the form shows. It runs ahead of the stored settings: a switch moves
  // the moment it is clicked and the save follows, rather than the other way
  // round.
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [title, setTitle] = useState(settings.siteTitle)
  const [saving, setSaving] = useState(0)
  const [note, setNote] = useState<{ text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Kept, rather than cleared, once it is answered: the dialog fades out over
  // a couple of hundred milliseconds and would otherwise spend them showing a
  // question with the numbers taken out of it.
  const [rescale, setRescale] = useState<{ next: AppSettings; affected: number; open: boolean } | null>(null)

  // The draft as the handlers see it. A change is built on this rather than on
  // `draft`, so two changes in quick succession build on each other instead of
  // each starting from whatever the last render happened to hold.
  const draftRef = useRef(draft)
  // Saves run one after another. A burst then lands in the order it was made,
  // and the last change is the one that sticks.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  // Nothing but this page writes these settings, so the form is only ever
  // ahead of the store, never behind. Once the writes are done it drops back
  // into step, which both picks up anything the store normalised on the way in
  // and undoes a change whose save failed.
  useEffect(() => {
    if (saving > 0) return
    draftRef.current = settings
    setDraft(settings)
  }, [saving, settings])

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), SAVED_NOTE_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  const countsByType = useMemo(() => {
    const counts = new Map<MediaType, number>()
    for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1)
    return counts
  }, [entries])

  const hiddenCount = useMemo(() => entries.filter((entry) => entry.hidden).length, [entries])

  const datedCount = useMemo(() => entries.filter((entry) => entry.dateFinished !== null).length, [entries])

  // Said only when switching the dates off, where "the column has gone" and
  // "the dates have gone" would otherwise look like the same thing.
  const datedNote = datedCount === 1
    ? "One entry has a finished date. It is kept, and shows again if you turn this back on."
    : `${datedCount} entries have finished dates. They are kept, and show again if you turn this back on.`

  // Only types that are on count here: one switched off is hidden from
  // everyone already, and its guest setting matters again only once it is
  // back.
  const hiddenTypes = draft.enabledTypes.filter((type) => draft.guestHiddenTypes.includes(type))

  const example = useMemo(() => {
    if (!rescale) return null
    const sample = Math.max(1, Math.round(draft.ratingScale * 0.8))
    return {
      before: `${sample}/${draft.ratingScale}`,
      after: `${convertRating(sample, draft, rescale.next)}/${rescale.next.ratingScale}`,
    }
  }, [rescale, draft])

  /** Moves the form to `next` and saves it, converting ratings first if asked. */
  function commit(next: AppSettings, convert = false) {
    const from = draftRef.current
    draftRef.current = next
    setDraft(next)
    setError(null)
    setSaving((count) => count + 1)

    queue.current = queue.current.then(async () => {
      try {
        // Rescale first: if it fails, the stored ratings and the saved scale
        // still agree with each other.
        const changed = convert ? await onRescale(from, next) : 0
        await onSave(next)
        // Clears an earlier failure as well: what is stored now matches the
        // form, whatever happened on the way here.
        setError(null)
        setNote({ text: changed > 0 ? `Saved. ${changed} ${changed === 1 ? "rating" : "ratings"} converted.` : "Saved" })
      } catch (caught) {
        setNote(null)
        setError(caught instanceof Error ? caught.message : "Could not save these settings.")
      } finally {
        setSaving((count) => count - 1)
      }
    })
  }

  function apply(patch: Partial<AppSettings>) {
    commit({ ...draftRef.current, ...patch })
  }

  /**
   * Changes the scale or the exceptional star.
   *
   * Both rewrite ratings that are already given, and rounding means they do not
   * all come back, so this is the one change that asks first — unless no rating
   * would actually move, when there is nothing to ask about.
   */
  function applyRating(patch: Partial<AppSettings>) {
    const current = draftRef.current
    const next = { ...current, ...patch }
    // The bin's ratings are converted too, so a restored entry comes back on
    // the scale in use, and the count has to include them to be the truth.
    const affected = rescaleNeeded(current, next)
      ? [...entries, ...binned].filter((entry) => entry.rating !== null && convertRating(entry.rating, current, next) !== entry.rating).length
      : 0

    if (affected === 0) commit(next)
    else setRescale({ next, affected, open: true })
  }

  function toggleType(type: MediaType, enabled: boolean) {
    const current = draftRef.current
    apply({
      enabledTypes: enabled
        ? MEDIA_TYPES.filter((item) => item === type || current.enabledTypes.includes(item))
        : current.enabledTypes.filter((item) => item !== type),
    })
  }

  function toggleGuestType(type: MediaType, shown: boolean) {
    const current = draftRef.current
    apply({
      // Kept in MEDIA_TYPES order, so the same choice always serialises the
      // same way.
      guestHiddenTypes: shown
        ? current.guestHiddenTypes.filter((item) => item !== type)
        : MEDIA_TYPES.filter((item) => item === type || current.guestHiddenTypes.includes(item)),
    })
  }

  const titleTimer = useRef<number | null>(null)

  /** Saves the typed name, unless it comes to the same as the stored one. */
  function commitTitle(value: string) {
    if (titleTimer.current !== null) {
      window.clearTimeout(titleTimer.current)
      titleTimer.current = null
    }
    const siteTitle = normalizeSiteTitle(value)
    if (siteTitle !== draftRef.current.siteTitle) apply({ siteTitle })
  }

  /**
   * Leaving the field puts the saved name back into it, so a cleared box shows
   * the "media" it fell back to rather than sitting empty. Only on the way out:
   * doing it on the typing pause would take a trailing space back out from
   * under the caret.
   */
  function blurTitle(value: string) {
    commitTitle(value)
    setTitle(normalizeSiteTitle(value))
  }

  function changeTitle(value: string) {
    setTitle(value)
    // Typing saves on a pause, not on a keystroke, so renaming the library is
    // one write and one header rename rather than one per letter.
    if (titleTimer.current !== null) window.clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(() => commitTitle(value), TITLE_DEBOUNCE_MS)
  }

  // Leaving the page mid-word saves what is there rather than dropping it with
  // the timer. The ref keeps the latest typed value in reach of a cleanup that
  // only runs on the way out.
  const flushTitle = useRef<() => void>(() => {})
  useEffect(() => {
    flushTitle.current = () => { if (titleTimer.current !== null) commitTitle(title) }
  })
  useEffect(() => () => flushTitle.current(), [])

  if (!canManage) {
    return (
      <div className="settings-page">
        <div className="settings-locked">
          <Lock size={18} aria-hidden="true" />
          <div>
            <h2>Settings are for the library owner</h2>
            <p>Log in to change what the library is called, which media types appear and which guests can see, how ratings are scored, and whether entries record when you finished them, or to restore something you deleted.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="page-heading settings-heading">
        <div>
          <h1>Settings</h1>
          <p>These apply to everyone who visits your library, not just this browser. Changes save themselves.</p>
        </div>
        <p className={note && saving === 0 ? "settings-status is-saved" : "settings-status"} role="status" aria-live="polite">
          {saving > 0
            ? "Saving..."
            : note
              ? <><Check size={13} aria-hidden="true" /> {note.text}</>
              : null}
        </p>
      </header>

      {error && <p className="form-error settings-error" role="alert">{error}</p>}

      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Library name</CardTitle>
          <CardDescription>
            What this library is called. Everyone who visits sees it.
          </CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <div className="settings-row">
            <div className="settings-row-copy">
              <Label htmlFor="site-title">Name</Label>
              <p>Shown in the header and in the browser tab.</p>
            </div>
            <Input
              id="site-title"
              className="settings-title-input"
              value={title}
              maxLength={SITE_TITLE_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder={DEFAULT_SITE_TITLE}
              onChange={(event) => changeTitle(event.target.value)}
              onBlur={(event) => blurTitle(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Media types</CardTitle>
          <CardDescription>
            Turn off a type to remove its tab and hide its entries. Nothing is deleted, and turning it back on brings everything straight back.
          </CardDescription>
        </CardHeader>
        <CardContent className="settings-type-grid">
          {MEDIA_TYPES.map((type) => {
            const enabled = draft.enabledTypes.includes(type)
            const count = countsByType.get(type) ?? 0
            const lastOne = enabled && draft.enabledTypes.length === 1
            return (
              <div key={type} className={enabled ? "settings-type is-on" : "settings-type"}>
                <span className={`entry-type-icon type-${type}`}>
                  <MediaTypeIcon type={type} size={16} strokeWidth={1.75} />
                </span>
                <div className="settings-type-copy">
                  <Label htmlFor={`type-${type}`}>{MEDIA_LABELS[type]}</Label>
                  <span>
                    {count === 0 ? "No entries" : `${count} ${count === 1 ? "entry" : "entries"}`}
                    {!enabled && count > 0 ? " · hidden" : ""}
                  </span>
                </div>
                {/* A disabled control gets no pointer events, so the tooltip
                    listens on a wrapper instead of the switch itself. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="settings-type-switch">
                      <Switch
                        id={`type-${type}`}
                        checked={enabled}
                        disabled={lastOne}
                        onCheckedChange={(next) => toggleType(type, next)}
                      />
                    </span>
                  </TooltipTrigger>
                  {lastOne && <TooltipContent>At least one type has to stay on</TooltipContent>}
                </Tooltip>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>What an entry records beyond its type, title and status.</CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <div className="settings-row">
            <div className="settings-row-copy">
              <Label htmlFor="rating-scale">Rating scale</Label>
              <p>How many stars a normal rating runs to. Changing it converts every rating you have already given.</p>
            </div>
            <Select
              value={String(draft.ratingScale)}
              onValueChange={(value) => applyRating({ ratingScale: Number(value) as RatingScale })}
            >
              <SelectTrigger id="rating-scale" className="settings-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RATING_SCALES.map((scale) => (
                  <SelectItem key={scale} value={String(scale)}>Out of {scale} stars</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="settings-row">
            <div className="settings-row-copy">
              <Label htmlFor="exceptional">Exceptional rating</Label>
              <p>
                Offer one star above the scale — {draft.ratingScale + 1} out of {draft.ratingScale} — for the rare favourites.
              </p>
            </div>
            <Switch
              id="exceptional"
              checked={draft.exceptionalEnabled}
              onCheckedChange={(exceptionalEnabled) => applyRating({ exceptionalEnabled })}
            />
          </div>

          <Separator />

          <div className="settings-row">
            <div className="settings-row-copy">
              <Label htmlFor="finished-dates">Finished dates</Label>
              <p>
                Record the day you finished something. Off takes the field out of the entry form, the
                date column out of the library and the calendar out of the header — the calendar is
                built from these dates and has nothing to show without them.
              </p>
            </div>
            <Switch
              id="finished-dates"
              checked={draft.finishedDatesEnabled}
              onCheckedChange={(finishedDatesEnabled) => apply({ finishedDatesEnabled })}
            />
          </div>
          {!draft.finishedDatesEnabled && datedCount > 0 && (
            <p className="settings-note">{datedNote}</p>
          )}
        </CardContent>
      </Card>

      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Who can read your library without signing in.</CardDescription>
        </CardHeader>
        <CardContent className="settings-rows">
          <div className="settings-row">
            <div className="settings-row-copy">
              <Label htmlFor="guest-viewing">Public viewing</Label>
              <p>
                Let anyone read the library without an account. Turning this off closes the API as well
                as the interface, so nothing is readable without signing in.
              </p>
            </div>
            <Switch
              id="guest-viewing"
              checked={draft.guestViewing}
              onCheckedChange={(guestViewing) => apply({ guestViewing })}
            />
          </div>
          {draft.guestViewing && (
            <>
              <Separator />
              <fieldset className="settings-fieldset">
                <legend>Shown to guests</legend>
                <p>
                  Switch a type off to keep every one of its entries from guests. They lose its tab as
                  well, and you still see all of it signed in. To hide one entry rather than a whole
                  type, use the menu on its row in the library.
                  {hiddenCount > 0 && ` ${hiddenCount} ${hiddenCount === 1 ? "entry is" : "entries are"} hidden that way.`}
                </p>
                <div className="settings-type-grid">
                  {draft.enabledTypes.map((type) => {
                    const shown = !draft.guestHiddenTypes.includes(type)
                    return (
                      <div key={type} className={shown ? "settings-type is-on" : "settings-type"}>
                        <span className={`entry-type-icon type-${type}`}>
                          <MediaTypeIcon type={type} size={16} strokeWidth={1.75} />
                        </span>
                        <div className="settings-type-copy">
                          <Label htmlFor={`guest-type-${type}`}>{MEDIA_LABELS[type]}</Label>
                          <span>{shown ? "Shown to guests" : "Hidden from guests"}</span>
                        </div>
                        <Switch
                          id={`guest-type-${type}`}
                          checked={shown}
                          onCheckedChange={(next) => toggleGuestType(type, next)}
                        />
                      </div>
                    )
                  })}
                </div>
              </fieldset>
              {hiddenTypes.length === draft.enabledTypes.length && (
                <p className="settings-note">
                  Every type is hidden, so a guest finds an empty library. Turning off public viewing
                  closes it properly instead.
                </p>
              )}
            </>
          )}
          {!draft.guestViewing && (hiddenCount > 0 || hiddenTypes.length > 0) && (
            <p className="settings-note">
              {keptHiddenNote(hiddenCount, hiddenTypes)} That is kept, and applies again if you turn
              public viewing back on.
            </p>
          )}
        </CardContent>
      </Card>

      <RecentlyDeleted
        entries={entries}
        binned={binned}
        onRestore={onRestore}
        onRemoveForGood={onRemoveForGood}
        onEmpty={onEmptyBin}
      />

      <AlertDialog
        open={rescale?.open ?? false}
        onOpenChange={(open) => { if (!open) setRescale((current) => (current ? { ...current, open: false } : null)) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Convert {rescale?.affected} {rescale?.affected === 1 ? "rating" : "ratings"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {rescale && example && (
                <>
                  This changes {rescale.affected} existing {rescale.affected === 1 ? "rating" : "ratings"} to
                  the new scale — a {example.before} becomes {example.after}. Rounding means it cannot be
                  undone exactly.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (!rescale) return
                commit(rescale.next, true)
                setRescale({ ...rescale, open: false })
              }}
            >
              Convert {rescale?.affected} {rescale?.affected === 1 ? "rating" : "ratings"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
