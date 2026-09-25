import { useEffect, useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { AppFooter } from "@/components/app-footer"
import { AuthControls } from "@/components/auth-controls"
import { CalendarPage } from "@/components/calendar-page"
import { DeleteDialog } from "@/components/delete-dialog"
import { EmptyState } from "@/components/empty-state"
import { EntryDialog } from "@/components/entry-dialog"
import { EntryList } from "@/components/entry-list"
import { ListToolbar } from "@/components/list-toolbar"
import { LoginPage } from "@/components/login-page"
import { MediaTabs } from "@/components/media-tabs"
import { SettingsPage } from "@/components/settings-page"
import { SetupPage } from "@/components/setup-page"
import { UndoToast, type Deletion } from "@/components/undo-toast"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useMediaEntries } from "@/hooks/use-media-entries"
import { useSettings } from "@/hooks/use-settings"
import { useSetup } from "@/hooks/use-setup"
import { groupEntries, seasonsOf, topLevelEntries, type MediaTab, type SortOrder, type StatusFilter } from "@/lib/media"
import { navigate, navigateTab, useRoute, useTab } from "@/lib/route"
import type { MediaEntry } from "@/types/media"
import { typesVisibleTo } from "@/types/settings"

function LoadingList({ showDates }: { showDates: boolean }) {
  return (
    <div className="loading-list" aria-label="Loading entries">
      {[0, 1, 2, 3].map((index) => (
        <div className="loading-row" key={index}>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
          {showDates && <Skeleton className="h-5 w-24" />}
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

function App() {
  const { entries, binned, loading, error, refresh, save, moveToBin, restore, removeForGood, emptyBin, rescaleRatings } = useMediaEntries()
  const { settings, loading: settingsLoading, save: saveSettings } = useSettings()
  const { authenticated, login, logout } = useAuth()
  const { needed: setupNeeded, register } = useSetup()
  const route = useRoute()
  const activeTab = useTab()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortOrder>("completed")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MediaEntry | null>(null)
  const [newSeasonOf, setNewSeasonOf] = useState<MediaEntry | null>(null)
  const [deleting, setDeleting] = useState<MediaEntry | null>(null)
  const [lastDeletion, setLastDeletion] = useState<Deletion | null>(null)

  // The tabs this visitor gets. A guest is never sent entries of a type hidden
  // from guests — the API refuses them — but the tab would still be drawn,
  // empty, unless it is left out here.
  const visibleTypes = useMemo(() => typesVisibleTo(settings, authenticated), [settings, authenticated])

  // Entries of a switched-off type stay in the database but leave the library.
  // So do a hidden type's for a guest: the list can still hold them for the
  // moment between logging out and the reload that follows.
  const libraryEntries = useMemo(
    () => entries.filter((entry) => visibleTypes.includes(entry.type)),
    [entries, visibleTypes],
  )

  // Seasons are part of a show rather than separate things watched, so they do
  // not inflate the counts or the "showing x of y" summary.
  const series = useMemo(() => topLevelEntries(libraryEntries), [libraryEntries])

  const counts = useMemo(() => ({
    all: series.length,
    ...Object.fromEntries(visibleTypes.map((type) => [type, series.filter((entry) => entry.type === type).length])),
  }) as Record<MediaTab, number>, [series, visibleTypes])

  const tabEntries = useMemo(() => series.filter((entry) => activeTab === "all" || entry.type === activeTab), [series, activeTab])
  const visibleGroups = useMemo(() => groupEntries(libraryEntries, activeTab, status, query, sort), [libraryEntries, activeTab, status, query, sort])
  const deletingSeasons = useMemo(() => deleting ? seasonsOf(entries, deleting.id) : [], [entries, deleting])
  // Whether the last deletion is still in the bin as it went in, stamp and all.
  // Restoring or removing it from Settings settles it, and so does deleting it
  // again later, which gives it a new stamp and a toast of its own.
  const deletionSettled = useMemo(
    () => !lastDeletion || !binned.some((item) => item.id === lastDeletion.entry.id && item.deleted === lastDeletion.entry.deleted),
    [binned, lastDeletion],
  )

  // Which of the three screens this visit is depends on two answers that only
  // arrive over the network: whether an owner account exists yet, and whether
  // the library is open to guests. Both requests go out together on mount, so
  // the wait is a single round trip — see the hold on the first paint below.
  const booting = settingsLoading || setupNeeded === null

  // With the library closed to guests there is nothing to show and nobody to
  // show it to, so login replaces the whole interface rather than sitting over
  // it.
  const lockedOut = !authenticated && !settings.guestViewing

  // Nobody has an account yet, so there is nothing to sign into and nothing to
  // show a guest either.
  const setupPending = setupNeeded === true

  // Turning off the type you were looking at would otherwise leave an empty tab
  // selected with no way back to it. Logging out while on a type hidden from
  // guests is the same situation. Until the settings arrive the types are only
  // the defaults, which would send a refresh on /anime back to All.
  useEffect(() => {
    if (!settingsLoading && activeTab !== "all" && !visibleTypes.includes(activeTab)) navigateTab("all")
  }, [activeTab, visibleTypes, settingsLoading])

  // The calendar is built from finished dates and has nothing to draw without
  // them, so it goes when they do rather than answering to a switch of its own.
  useEffect(() => {
    if (route === "calendar" && !settings.finishedDatesEnabled) navigate("library")
  }, [route, settings.finishedDatesEnabled])

  // Sorting by a date the library no longer records would order it by nothing.
  // The toolbar drops that option at the same time, so this is the one move
  // back out of it.
  useEffect(() => {
    if (sort === "completed" && !settings.finishedDatesEnabled) setSort("title")
  }, [sort, settings.finishedDatesEnabled])

  // The tab is the same library as the header, so it carries the same name. The
  // title in index.html is only what shows before the settings have loaded.
  // Writing it before they arrive would put the default name in the tab for a
  // moment, which is a rename flickering past on every refresh.
  useEffect(() => {
    if (settingsLoading) return
    document.title = settings.siteTitle
  }, [settings.siteTitle, settingsLoading])

  function startAdd() {
    if (!authenticated) return
    setEditing(null)
    setNewSeasonOf(null)
    setDialogOpen(true)
  }

  function startAddSeason(entry: MediaEntry) {
    if (!authenticated) return
    setEditing(null)
    setNewSeasonOf(entry)
    setDialogOpen(true)
  }

  function startEdit(entry: MediaEntry) {
    if (!authenticated) return
    setEditing(entry)
    setDialogOpen(true)
  }

  function toggleHidden(entry: MediaEntry) {
    if (!authenticated) return
    void save({
      type: entry.type,
      title: entry.title,
      status: entry.status,
      dateFinished: entry.dateFinished,
      rating: entry.rating,
      hidden: !entry.hidden,
      parent: entry.parent,
    }, entry.id)
  }

  async function deleteEntry(entry: MediaEntry) {
    const moved = await moveToBin(entry.id)
    // The server's copy, which carries the stamp that tells this deletion from
    // an earlier one of the same entry.
    const binnedEntry = moved.find((item) => item.id === entry.id) ?? entry
    setLastDeletion({ entry: binnedEntry, seasons: moved.length - 1 })
  }

  function clearFilters() {
    navigateTab("all")
    setStatus("all")
    setQuery("")
  }

  async function handleLogin(email: string, password: string) {
    await login(email, password)
    await refresh()
    navigate("library")
  }

  async function handleRegister(email: string, password: string) {
    await register(email, password)
    await login(email, password)
    await refresh()
  }

  function handleLogout() {
    setDialogOpen(false)
    setDeleting(null)
    setLastDeletion(null)
    logout()
    navigate("library")
    void refresh()
  }

  // Nothing at all until those two answers are in. Drawing the header and an
  // empty library first would flash a library past someone who is about to be
  // asked to log in, and would show the default name to anyone who renamed
  // theirs. The page is already blank while the bundle loads, so this reads as
  // that same moment lasting a beat longer rather than as a screen of its own.
  if (booting) return null

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <button type="button" className="brand" aria-label={`${settings.siteTitle}, back to library`} onClick={() => navigate("library")}>
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
            <span className="brand-title">{settings.siteTitle}<span className="brand-period">.</span></span>
          </button>
          <div className="header-tabs">
            {!lockedOut && !setupPending && route !== "login" && route === "library" && (
              <MediaTabs active={activeTab} counts={counts} types={visibleTypes} onChange={navigateTab} />
            )}
          </div>
          {!lockedOut && !setupPending && (
            <AuthControls
              authenticated={authenticated}
              route={route}
              showCalendar={settings.finishedDatesEnabled}
              onNavigate={navigate}
              onLogin={() => navigate("login")}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>

      <main className="main-content">
        {setupPending ? (
          <SetupPage onRegister={handleRegister} />
        ) : lockedOut || route === "login" ? (
          <LoginPage closed={lockedOut} onLogin={handleLogin} onCancel={() => navigate("library")} />
        ) : route === "settings" ? (
          <SettingsPage
            settings={settings}
            entries={entries}
            binned={binned}
            canManage={authenticated}
            onSave={saveSettings}
            onRescale={rescaleRatings}
            onRestore={(entry) => restore(entry.id)}
            onRemoveForGood={(entry) => removeForGood(entry.id)}
            onEmptyBin={emptyBin}
          />
        ) : route === "calendar" ? (
          <CalendarPage entries={libraryEntries} settings={settings} canManage={authenticated} onEdit={startEdit} />
        ) : (
          <section className="library-section" aria-label="Media library">
            <div id="media-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
              <ListToolbar
                query={query}
                onQueryChange={setQuery}
                status={status}
                onStatusChange={setStatus}
                sort={sort}
                onSortChange={setSort}
                showDates={settings.finishedDatesEnabled}
                showing={visibleGroups.length}
                total={tabEntries.length}
                canManage={authenticated}
                onAdd={startAdd}
              />
              {error ? (
                <div className="load-error" role="alert">
                  <div>
                    <h2>Couldn’t reach your library</h2>
                    <p>{error}</p>
                  </div>
                  <Button variant="outline" onClick={() => void refresh()}><RotateCcw size={15} /> Retry</Button>
                </div>
              ) : loading ? <LoadingList showDates={settings.finishedDatesEnabled} /> : visibleGroups.length > 0 ? (
                <EntryList
                  groups={visibleGroups}
                  canManage={authenticated}
                  settings={settings}
                  onEdit={startEdit}
                  onDelete={setDeleting}
                  onToggleHidden={toggleHidden}
                  onAddSeason={startAddSeason}
                />
              ) : (
                <EmptyState canAdd={authenticated} filtered={Boolean(libraryEntries.length && (query || status !== "all" || (activeTab !== "all" && tabEntries.length === 0)))} onAdd={startAdd} onClear={clearFilters} />
              )}
            </div>
          </section>
        )}
      </main>

      <AppFooter />

      {authenticated && (
        <>
          <EntryDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            entry={editing}
            defaultType={newSeasonOf?.type ?? (activeTab === "all" ? settings.enabledTypes[0] : activeTab)}
            defaultParent={newSeasonOf?.id ?? null}
            entries={libraryEntries}
            settings={settings}
            onSave={save}
          />
          <DeleteDialog entry={deleting} seasons={deletingSeasons} onClose={() => setDeleting(null)} onDelete={deleteEntry} />
          <UndoToast deletion={lastDeletion} settled={deletionSettled} onUndo={(entry) => restore(entry.id)} />
        </>
      )}
    </div>
  )
}

export default App
