import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { repository } from "@/lib/repository"
import type { MediaEntry, MediaEntryInput } from "@/types/media"
import { convertRating, type AppSettings } from "@/types/settings"

export function useMediaEntries() {
  // Everything the API hands over: the library, and signed in, Recently
  // deleted as well. They are held together so that rescaling ratings reaches
  // entries waiting in the bin too — one restored afterwards would otherwise
  // come back scored on a scale the library no longer uses.
  const [records, setRecords] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  // Counts the changes applied from the server's answers. A full list that
  // was fetched before one of them landed would put the old state back, so
  // refresh() checks this and fetches again rather than applying it.
  const changes = useRef(0)

  const entries = useMemo(() => records.filter((record) => !record.deleted), [records])
  const binned = useMemo(() => records.filter((record) => record.deleted), [records])

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      let nextRecords: MediaEntry[]
      let before: number
      do {
        before = changes.current
        // oxlint-disable-next-line no-await-in-loop
        nextRecords = await repository.list()
      } while (changes.current !== before && currentRequest === requestId.current)
      if (currentRequest === requestId.current) setRecords(nextRecords)
    } catch {
      if (currentRequest === requestId.current) {
        setError("Could not load your library. Check that PocketBase is running and the collection migration has been applied.")
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /** Swaps in the server's copies of records it has just changed. */
  const merge = useCallback((changed: MediaEntry[]) => {
    changes.current += 1
    const byId = new Map(changed.map((record) => [record.id, record]))
    setRecords((current) => current.map((record) => byId.get(record.id) ?? record))
  }, [])

  const drop = useCallback((ids: string[]) => {
    changes.current += 1
    const gone = new Set(ids)
    setRecords((current) => current.filter((record) => !gone.has(record.id)))
  }, [])

  const save = useCallback(async (input: MediaEntryInput, id?: string) => {
    const entry = id ? await repository.update(id, input) : await repository.create(input)
    changes.current += 1
    setRecords((current) => id
      ? current.map((item) => item.id === id ? entry : item)
      : [entry, ...current],
    )
    return entry
  }, [])

  const moveToBin = useCallback(async (id: string) => {
    const moved = await repository.moveToBin(id)
    merge(moved)
    return moved
  }, [merge])

  const restore = useCallback(async (id: string) => {
    const restored = await repository.restore(id)
    merge(restored)
    return restored
  }, [merge])

  const removeForGood = useCallback(async (id: string) => {
    drop(await repository.removeForGood(id))
  }, [drop])

  const emptyBin = useCallback(async () => {
    drop(await repository.emptyBin())
  }, [drop])

  /**
   * Re-expresses every rating on a new scale, the bin's included. Only entries
   * that actually change are written, so switching the exceptional star on and
   * off is free.
   */
  const rescaleRatings = useCallback(async (from: AppSettings, to: AppSettings) => {
    const pending = records
      .filter((entry) => entry.rating !== null)
      .map((entry) => ({ entry, rating: convertRating(entry.rating as number, from, to) }))
      .filter(({ entry, rating }) => rating !== entry.rating)

    const updated: MediaEntry[] = []
    for (const { entry, rating } of pending) {
      // oxlint-disable-next-line no-await-in-loop
      updated.push(await repository.update(entry.id, {
        type: entry.type,
        title: entry.title,
        status: entry.status,
        dateFinished: entry.dateFinished,
        rating,
        hidden: entry.hidden,
        parent: entry.parent,
      }))
    }

    if (updated.length) merge(updated)
    return updated.length
  }, [records, merge])

  return { entries, binned, loading, error, refresh, save, moveToBin, restore, removeForGood, emptyBin, rescaleRatings }
}
