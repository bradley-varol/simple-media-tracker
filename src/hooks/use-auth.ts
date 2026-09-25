import { useSyncExternalStore } from "react"
import { pocketbase } from "@/lib/pocketbase"

function subscribe(onChange: () => void) {
  return pocketbase.authStore.onChange(onChange)
}

function getToken() {
  return pocketbase.authStore.token
}

export function useAuth() {
  const token = useSyncExternalStore(subscribe, getToken)
  const authenticated = Boolean(token && pocketbase.authStore.isValid && pocketbase.authStore.record?.collectionName === "users")

  async function login(email: string, password: string) {
    await pocketbase.collection("users").authWithPassword(email.trim(), password)
  }

  function logout() {
    pocketbase.authStore.clear()
  }

  return {
    authenticated,
    email: authenticated ? String(pocketbase.authStore.record?.email ?? "") : "",
    login,
    logout,
  }
}
