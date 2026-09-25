import { useCallback, useEffect, useState } from "react"
import { settingsRepository } from "@/lib/repository"
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/settings"

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setSettings(await settingsRepository.get())
    } catch {
      // An instance that has not run the settings migration, or is simply
      // unreachable, still gets a usable library on the defaults rather than a
      // blank page.
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const save = useCallback(async (next: AppSettings) => {
    const saved = await settingsRepository.update(next)
    setSettings(saved)
    return saved
  }, [])

  return { settings, loading, save, refresh }
}
