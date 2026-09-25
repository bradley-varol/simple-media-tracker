import { useState, type FormEvent } from "react"
import { LogIn, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  /** True when the library is closed to guests, so this page is the whole app. */
  closed: boolean
  onLogin: (email: string, password: string) => Promise<void>
  onCancel: () => void
}

export function LoginPage({ closed, onLogin, onCancel }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onLogin(email, password)
    } catch {
      // Deliberately the same message either way: saying which of the two was
      // wrong tells an attacker which addresses have accounts.
      setError("Could not sign in. Check your email and password.")
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="login-icon" aria-hidden="true">
          {closed ? <Lock size={19} /> : <LogIn size={19} />}
        </span>
        <h1>{closed ? "This library is private" : "Log in"}</h1>
        <p className="login-lead">
          {closed
            ? "Its owner has turned off public viewing. Sign in to see it."
            : "Sign in to add and manage entries."}
        </p>

        <form className="entry-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-field">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="form-field">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="login-actions">
            {/* With the library closed there is nowhere to go back to. */}
            {!closed && (
              <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>Cancel</Button>
            )}
            <Button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Log in"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
