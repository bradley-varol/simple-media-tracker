import { useEffect, useState } from "react"
import { pocketbase } from "@/lib/pocketbase"

/**
 * Whether pb_hooks/setup.pb.js will still create the owner account. `null`
 * while the check is in flight, so the app can hold off deciding what to show
 * rather than flashing the wrong screen; a failed check resolves to `false`,
 * sending a visitor to the ordinary login screen instead of stranding them on
 * a loading state if PocketBase is briefly unreachable.
 */
export function useSetup() {
  const [needed, setNeeded] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    pocketbase
      .send<{ needed: boolean }>("/api/setup", { method: "GET" })
      .then((result) => {
        if (!cancelled) setNeeded(result.needed)
      })
      .catch(() => {
        if (!cancelled) setNeeded(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function register(email: string, password: string) {
    await pocketbase.send("/api/setup", {
      method: "POST",
      body: { email: email.trim(), password },
    })
    // The endpoint just refused every future call for us; reflect that
    // locally instead of re-checking over the network.
    setNeeded(false)
  }

  return { needed, register }
}
