import { useSyncExternalStore } from "react"
import type { MediaTab } from "@/lib/media"
import { MEDIA_TYPES, type MediaType } from "@/types/media"

export const ROUTES = ["library", "calendar", "settings", "login"] as const
export type Route = (typeof ROUTES)[number]

// The History API rather than a router dependency: real paths survive a
// refresh, give the back button something to do and make pages linkable, in
// about as many lines as the config for a real router would take. PocketBase
// answers any path that is not a file with index.html, as Vite's dev server
// does, so /shows or /calendar loads the app like / does.

// A library tab other than All is a path of its own, named like the tab.
const TAB_PATHS: Record<MediaType, string> = {
  movie: "movies",
  show: "shows",
  game: "games",
  book: "books",
  anime: "anime",
  manga: "manga",
}

function currentSegment(): string {
  return window.location.pathname.replace(/^\/+|\/+$/g, "")
}

function currentRoute(): Route {
  const segment = currentSegment()
  return segment !== "library" && (ROUTES as readonly string[]).includes(segment) ? (segment as Route) : "library"
}

function currentTab(): MediaTab {
  const segment = currentSegment()
  return MEDIA_TYPES.find((type) => TAB_PATHS[type] === segment) ?? "all"
}

// pushState fires nothing, so going somewhere announces itself with an event
// of its own alongside the popstate that back and forward send.
const NAVIGATE = "media-tracker:navigate"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  window.addEventListener(NAVIGATE, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(NAVIGATE, onChange)
  }
}

function go(path: string) {
  if (window.location.pathname === path) return
  window.history.pushState(null, "", path)
  window.dispatchEvent(new Event(NAVIGATE))
}

// Links from before the move to paths, #/calendar or #/login, still land where
// they meant to.
const legacy = window.location.hash.match(/^#\/?([a-z]+)$/)?.[1]
if (legacy && (ROUTES as readonly string[]).includes(legacy)) {
  window.history.replaceState(null, "", `/${legacy}`)
}

export function navigate(route: Route) {
  go(route === "library" ? "/" : `/${route}`)
}

/** Shows a tab of the library, which also takes you to the library. */
export function navigateTab(tab: MediaTab) {
  go(tab === "all" ? "/" : `/${TAB_PATHS[tab]}`)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute, () => "library" as Route)
}

export function useTab(): MediaTab {
  return useSyncExternalStore(subscribe, currentTab, () => "all" as MediaTab)
}
