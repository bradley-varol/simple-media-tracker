import { GithubIcon } from "@/components/github-icon"
import { APP_NAME, APP_VERSION, REPOSITORY_URL } from "@/lib/app-info"

export function AppFooter() {
  return (
    <footer className="site-footer">
      <span className="footer-app">
        {APP_NAME}
        <span className="footer-version">v{APP_VERSION}</span>
      </span>
      <a
        className="footer-link"
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
      >
        <GithubIcon size={15} />
        <span>GitHub</span>
      </a>
    </footer>
  )
}
