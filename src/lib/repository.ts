import type { RecordModel } from "pocketbase"
import { pocketbase } from "@/lib/pocketbase"
import {
  isMediaStatus,
  isMediaType,
  normalizeEntry,
  type MediaEntry,
  type MediaEntryInput,
} from "@/types/media"
import { normalizeSettings, SETTINGS_ID, type AppSettings } from "@/types/settings"

export interface MediaRepository {
  /** The library, and for a signed-in owner whatever is in Recently deleted too. */
  list(): Promise<MediaEntry[]>
  create(input: MediaEntryInput): Promise<MediaEntry>
  update(id: string, input: MediaEntryInput): Promise<MediaEntry>
  /** Moves an entry, and a series' seasons with it, to Recently deleted. */
  moveToBin(id: string): Promise<MediaEntry[]>
  /** Brings an entry back, with whatever has to come back alongside it. */
  restore(id: string): Promise<MediaEntry[]>
  /** Removes an entry in Recently deleted for good, returning the ids that went. */
  removeForGood(id: string): Promise<string[]>
  /** Removes everything in Recently deleted for good. */
  emptyBin(): Promise<string[]>
}

function toPocketBaseData(input: MediaEntryInput) {
  const entry = normalizeEntry(input)
  return {
    type: entry.type,
    title: entry.title,
    status: entry.status,
    date_finished: entry.dateFinished ? `${entry.dateFinished} 00:00:00.000Z` : "",
    rating: entry.rating ?? 0,
    hidden: entry.hidden,
    parent: entry.parent ?? "",
  }
}

function fromPocketBaseRecord(record: RecordModel): MediaEntry {
  if (!isMediaType(record.type) || !isMediaStatus(record.status)) {
    throw new Error("A PocketBase entry has an unknown type or status.")
  }

  return {
    id: record.id,
    type: record.type,
    title: String(record.title),
    status: record.status,
    dateFinished: record.date_finished ? String(record.date_finished).slice(0, 10) : null,
    rating: Number(record.rating) > 0 ? Number(record.rating) : null,
    hidden: Boolean(record.hidden),
    parent: record.parent ? String(record.parent) : null,
    deleted: record.deleted ? String(record.deleted) : null,
    created: String(record.created),
    updated: String(record.updated),
  }
}

class PocketBaseRepository implements MediaRepository {
  async list() {
    const records = await pocketbase.collection("media_entries").getFullList({ sort: "-updated" })
    return records.map(fromPocketBaseRecord)
  }

  async create(input: MediaEntryInput) {
    const record = await pocketbase.collection("media_entries").create(toPocketBaseData(input))
    return fromPocketBaseRecord(record)
  }

  async update(id: string, input: MediaEntryInput) {
    const record = await pocketbase.collection("media_entries").update(id, toPocketBaseData(input))
    return fromPocketBaseRecord(record)
  }

  // Recently deleted goes through routes of its own rather than the records
  // API, so a series and its seasons move in one transaction. The grouping
  // rules live with them, in pb_hooks/recently-deleted.js.

  async moveToBin(id: string) {
    const records = await pocketbase.send<RecordModel[]>(binPath(id), { method: "POST" })
    return records.map(fromPocketBaseRecord)
  }

  async restore(id: string) {
    const records = await pocketbase.send<RecordModel[]>(`${binPath(id)}/restore`, { method: "POST" })
    return records.map(fromPocketBaseRecord)
  }

  async removeForGood(id: string) {
    return pocketbase.send<string[]>(binPath(id), { method: "DELETE" })
  }

  async emptyBin() {
    return pocketbase.send<string[]>("/api/recently-deleted", { method: "DELETE" })
  }
}

function binPath(id: string) {
  return `/api/recently-deleted/${encodeURIComponent(id)}`
}

export const repository: MediaRepository = new PocketBaseRepository()

export interface SettingsRepository {
  get(): Promise<AppSettings>
  update(settings: AppSettings): Promise<AppSettings>
}

function fromSettingsRecord(record: RecordModel): AppSettings {
  return normalizeSettings({
    siteTitle: record.siteTitle,
    enabledTypes: record.enabledTypes,
    ratingScale: record.ratingScale,
    exceptionalEnabled: record.exceptionalEnabled,
    finishedDatesEnabled: record.finishedDatesEnabled,
    guestViewing: record.guestViewing,
    guestHiddenTypes: record.guestHiddenTypes,
  })
}

class PocketBaseSettingsRepository implements SettingsRepository {
  async get() {
    return fromSettingsRecord(await pocketbase.collection("app_settings").getOne(SETTINGS_ID))
  }

  async update(settings: AppSettings) {
    const record = await pocketbase.collection("app_settings").update(SETTINGS_ID, {
      siteTitle: settings.siteTitle,
      enabledTypes: settings.enabledTypes,
      ratingScale: settings.ratingScale,
      exceptionalEnabled: settings.exceptionalEnabled,
      finishedDatesEnabled: settings.finishedDatesEnabled,
      guestViewing: settings.guestViewing,
      guestHiddenTypes: settings.guestHiddenTypes,
    })
    return fromSettingsRecord(record)
  }
}

export const settingsRepository: SettingsRepository = new PocketBaseSettingsRepository()
