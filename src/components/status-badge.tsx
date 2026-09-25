import { STATUS_LABELS, type MediaStatus } from "@/types/media"

export function StatusBadge({ status }: { status: MediaStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}
