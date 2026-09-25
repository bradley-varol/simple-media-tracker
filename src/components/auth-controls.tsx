import { CalendarDays, Library, LogIn, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Route } from "@/lib/route"

type Props = {
  authenticated: boolean
  route: Route
  /** Whether the calendar page exists, which follows the finished dates. */
  showCalendar: boolean
  onNavigate: (route: Route) => void
  onLogin: () => void
  onLogout: () => void
}

function NavButton({ route, current, label, icon, onNavigate }: {
  route: Route
  current: Route
  label: string
  icon: React.ReactNode
  onNavigate: (route: Route) => void
}) {
  const active = current === route
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={active ? "nav-button is-active" : "nav-button"}
          onClick={() => onNavigate(route)}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function AuthControls({ authenticated, route, showCalendar, onNavigate, onLogin, onLogout }: Props) {
  return (
    <div className="auth-controls">
      <nav className="header-nav" aria-label="Pages">
        {route !== "library" && (
          <NavButton route="library" current={route} label="Library" icon={<Library size={16} />} onNavigate={onNavigate} />
        )}
        {showCalendar && (
          <NavButton route="calendar" current={route} label="Calendar" icon={<CalendarDays size={16} />} onNavigate={onNavigate} />
        )}
        {authenticated && (
          <NavButton route="settings" current={route} label="Settings" icon={<Settings size={16} />} onNavigate={onNavigate} />
        )}
      </nav>
      {authenticated ? (
        <Button type="button" variant="ghost" size="sm" onClick={onLogout}><LogOut size={14} /> Log out</Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onLogin}><LogIn size={14} /> Log in</Button>
      )}
    </div>
  )
}
