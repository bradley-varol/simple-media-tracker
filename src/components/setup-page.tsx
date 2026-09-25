import { useState, type FormEvent } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  onRegister: (email: string, password: string) => Promise<void>
}

// Shown in place of the whole app until an account exists — see useSetup and
// pb_hooks/setup.pb.js, which is what actually enforces that this only works
// once. There is nowhere for this form to cancel back to: with no account yet,
// there is no library and no login to fall back on.
export function SetupPage({ onRegister }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onRegister(email, password)
    } catch {
      // The only way this fails once the checks above pass is someone else's
      // setup request winning the race, or PocketBase itself rejecting the
      // email — nothing worth distinguishing for whoever is looking at this.
      setError("Could not create the account. If someone else just finished setting this up, sign in instead.")
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="login-icon" aria-hidden="true">
          <UserPlus size={19} />
        </span>
        <h1>Set up your library</h1>
        <p className="login-lead">
          Nobody has an account yet. Create the one you will sign in with — it
          has full control of the library, and this page will not be offered
          again.
        </p>

        <form className="entry-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-field">
            <Label htmlFor="setup-email">Email</Label>
            <Input
              id="setup-email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="form-field">
            <Label htmlFor="setup-password">Password</Label>
            <Input
              id="setup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="form-field">
            <Label htmlFor="setup-confirm">Confirm password</Label>
            <Input
              id="setup-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="login-actions">
            <Button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
