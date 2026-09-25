// The widest the rating column allows: a ten star scale plus the exceptional
// eleventh. The scale actually in force is a setting — see maxRating().
export const ABSOLUTE_MAX_RATING = 11

/** The longest title the collection accepts. See the entries migration. */
export const TITLE_MAX_LENGTH = 200

export const MEDIA_TYPES = ["movie", "show", "game", "book", "anime", "manga"] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export const STATUSES = ["planned", "in_progress", "completed", "abandoned"] as const
export type MediaStatus = (typeof STATUSES)[number]

export type MediaEntry = {
  id: string
  type: MediaType
  title: string
  status: MediaStatus
  dateFinished: string | null
  rating: number | null
  hidden: boolean
  /**
   * The series this entry is a season of, or null for a standalone entry.
   * Seasons are ordinary entries, so they keep their own rating, status and
   * completion date while the series keeps a rating of its own. Only one level
   * is allowed: a season is never itself a parent.
   */
  parent: string | null
  /**
   * When the entry was moved to Recently deleted, or null while it is in the
   * library. The server sets and clears it, never the entry form, which is why
   * it is left out of MediaEntryInput.
   */
  deleted: string | null
  created: string
  updated: string
}

export type MediaEntryInput = Pick<
  MediaEntry,
  "type" | "title" | "status" | "dateFinished" | "rating" | "hidden" | "parent"
>

export const MEDIA_LABELS: Record<MediaType, string> = {
  movie: "Movies",
  show: "Shows",
  game: "Games",
  book: "Books",
  anime: "Anime",
  manga: "Manga",
}

/** Singular form, for the type picker and row subtitles. */
export const MEDIA_LABELS_SINGULAR: Record<MediaType, string> = {
  movie: "Movie",
  show: "Show",
  game: "Game",
  book: "Book",
  anime: "Anime",
  manga: "Manga",
}

/** Types that can be broken into seasons. */
export const SEASONED_TYPES: MediaType[] = ["show", "anime"]

/**
 * The statuses that own a finish date and a rating. Nothing you have not
 * stopped watching has a day it was finished or a verdict to give, so the
 * dialog only offers both fields for these two. An existing rating is kept
 * when the status moves away, since it stays true; the date is not.
 */
export const FINISHED_STATUSES: MediaStatus[] = ["completed", "abandoned"]

export const STATUS_LABELS: Record<MediaStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
}

export function isMediaType(value: unknown): value is MediaType {
  return MEDIA_TYPES.includes(value as MediaType)
}

export function isMediaStatus(value: unknown): value is MediaStatus {
  return STATUSES.includes(value as MediaStatus)
}

export function normalizeEntry(input: MediaEntryInput): MediaEntryInput {
  const title = input.title.trim()
  if (!title) throw new Error("Add a title before saving.")
  if (title.length > TITLE_MAX_LENGTH) {
    throw new Error(`The title must be ${TITLE_MAX_LENGTH} characters or fewer.`)
  }
  if (!isMediaType(input.type)) throw new Error("Choose a media type.")
  if (!isMediaStatus(input.status)) throw new Error("Choose a status.")

  const rating = input.rating === null ? null : Number(input.rating)
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > ABSOLUTE_MAX_RATING)) {
    throw new Error(`Rating must be a whole number between 1 and ${ABSOLUTE_MAX_RATING}.`)
  }

  const dateFinished = input.dateFinished || null
  if (dateFinished && !/^\d{4}-\d{2}-\d{2}$/.test(dateFinished)) {
    throw new Error("Choose a valid completion date.")
  }

  return {
    type: input.type,
    title,
    status: input.status,
    dateFinished,
    rating,
    hidden: Boolean(input.hidden),
    parent: input.parent || null,
  }
}
