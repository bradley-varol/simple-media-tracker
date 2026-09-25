import { MEDIA_TYPES, type MediaEntry, type MediaType } from "@/types/media"

/** The id of the single app_settings row, fixed by the migration that seeds it. */
export const SETTINGS_ID = "appsettings0001"

export const RATING_SCALES = [5, 10] as const
export type RatingScale = (typeof RATING_SCALES)[number]

/**
 * The name in the header, and the browser tab.
 *
 * Short by design: it shares one header row with the tabs, so the limit is what
 * fits rather than what a text column could hold. The accent period after it is
 * drawn by the header and is not part of the stored value.
 */
export const SITE_TITLE_MAX_LENGTH = 40
export const DEFAULT_SITE_TITLE = "media"

export type AppSettings = {
  /** What the library is called, in the header and the browser tab. */
  siteTitle: string
  /** Types shown in the tabs, the type picker and the library. */
  enabledTypes: MediaType[]
  /** Stars a normal rating runs to. */
  ratingScale: RatingScale
  /** Whether one extra star above the scale is offered for favourites. */
  exceptionalEnabled: boolean
  /**
   * Whether an entry has a day it was finished.
   *
   * Off takes the field out of the entry dialog, the column out of the library,
   * the sort out of the toolbar and the calendar out of the header, since the
   * calendar is built from these dates and has nothing to draw without them.
   *
   * Dates already stored are kept and shown again if it comes back on. A date
   * is a fact rather than a judgement, so unlike the rating scale this converts
   * nothing.
   */
  finishedDatesEnabled: boolean
  /**
   * Whether anyone who is not signed in may read the library.
   *
   * Enforced by the media_entries API rule, which reads this field, so turning
   * it off closes the API rather than only hiding the interface.
   */
  guestViewing: boolean
  /**
   * Types guests are refused outright: no tab, no entries, while the owner
   * sees them as usual. Enforced by the same API rule as guestViewing.
   *
   * Independent of enabledTypes. A type switched off is hidden from everyone,
   * and one hidden from guests keeps that if it is switched off and on again.
   */
  guestHiddenTypes: MediaType[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  siteTitle: DEFAULT_SITE_TITLE,
  // Anime and manga stay off until switched on, so an existing library does
  // not grow two empty tabs on upgrade.
  enabledTypes: ["movie", "show", "game", "book"],
  ratingScale: 5,
  exceptionalEnabled: true,
  finishedDatesEnabled: true,
  guestViewing: true,
  // Nothing hidden by type until the owner says so, so an upgraded instance
  // shows guests what it always did.
  guestHiddenTypes: [],
}

/**
 * Trims a stored or typed title down to something the header can draw.
 *
 * A blank title is not an empty header but the default one: the header would
 * otherwise collapse to a bare accent period, which reads as a rendering bug
 * rather than a choice.
 */
export function normalizeSiteTitle(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SITE_TITLE

  const trimmed = value.trim().slice(0, SITE_TITLE_MAX_LENGTH).trim()
  return trimmed === "" ? DEFAULT_SITE_TITLE : trimmed
}

export function isRatingScale(value: unknown): value is RatingScale {
  return RATING_SCALES.includes(value as RatingScale)
}

/** The highest rating a user can give under these settings. */
export function maxRating(settings: AppSettings): number {
  return settings.ratingScale + (settings.exceptionalEnabled ? 1 : 0)
}

export function isExceptional(rating: number | null, settings: AppSettings): boolean {
  return settings.exceptionalEnabled && rating !== null && rating > settings.ratingScale
}

/**
 * The types a visitor gets tabs for: every enabled type when signed in, and as
 * a guest only those not hidden from guests.
 *
 * The API already refuses a guest the entries of a hidden type, so this is not
 * what keeps them off the screen. It keeps an empty tab from being drawn for
 * them, and drops their entries from the list for the moment between logging
 * out and the reload that follows.
 */
export function typesVisibleTo(settings: AppSettings, authenticated: boolean): MediaType[] {
  if (authenticated) return settings.enabledTypes
  return settings.enabledTypes.filter((type) => !settings.guestHiddenTypes.includes(type))
}

/** Whether guests are refused this entry, on its own account or its type's. */
export function hiddenFromGuests(entry: Pick<MediaEntry, "type" | "hidden">, settings: AppSettings): boolean {
  return entry.hidden || settings.guestHiddenTypes.includes(entry.type)
}

export function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  if (!value) return DEFAULT_SETTINGS

  const enabled = Array.isArray(value.enabledTypes)
    ? MEDIA_TYPES.filter((type) => (value.enabledTypes as unknown[]).includes(type))
    : DEFAULT_SETTINGS.enabledTypes

  // Unlike enabledTypes, empty is the ordinary state here.
  const guestHidden = Array.isArray(value.guestHiddenTypes)
    ? MEDIA_TYPES.filter((type) => (value.guestHiddenTypes as unknown[]).includes(type))
    : DEFAULT_SETTINGS.guestHiddenTypes

  return {
    siteTitle: normalizeSiteTitle(value.siteTitle),
    // Never leave the library with nothing to show, even if the stored value is
    // empty or has been hand-edited to something meaningless.
    enabledTypes: enabled.length > 0 ? enabled : DEFAULT_SETTINGS.enabledTypes,
    ratingScale: isRatingScale(value.ratingScale) ? value.ratingScale : DEFAULT_SETTINGS.ratingScale,
    exceptionalEnabled: value.exceptionalEnabled ?? DEFAULT_SETTINGS.exceptionalEnabled,
    finishedDatesEnabled: value.finishedDatesEnabled ?? DEFAULT_SETTINGS.finishedDatesEnabled,
    guestViewing: value.guestViewing ?? DEFAULT_SETTINGS.guestViewing,
    guestHiddenTypes: guestHidden,
  }
}

/**
 * Re-expresses a rating on a different scale, so switching from five stars to
 * ten does not silently turn every 4/5 into a 4/10.
 *
 * A rating above the old scale is the "exceptional" one; it stays exceptional
 * if the new settings still offer that, and otherwise lands on the new top.
 */
export function convertRating(rating: number, from: AppSettings, to: AppSettings): number {
  if (from.exceptionalEnabled && rating > from.ratingScale) return maxRating(to)

  const scaled = Math.round((rating / from.ratingScale) * to.ratingScale)
  return Math.min(Math.max(scaled, 1), to.ratingScale)
}

/** True when moving between these settings would change stored ratings. */
export function rescaleNeeded(from: AppSettings, to: AppSettings): boolean {
  return from.ratingScale !== to.ratingScale || from.exceptionalEnabled !== to.exceptionalEnabled
}
