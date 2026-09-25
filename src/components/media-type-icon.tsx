import { BookMarked, BookOpen, Clapperboard, Gamepad2, Layers3, Sparkles, Tv, type LucideProps } from "lucide-react"
import type { MediaTab } from "@/lib/media"

const icons = {
  all: Layers3,
  movie: Clapperboard,
  show: Tv,
  game: Gamepad2,
  book: BookOpen,
  anime: Sparkles,
  manga: BookMarked,
}

export function MediaTypeIcon({ type, ...props }: LucideProps & { type: MediaTab }) {
  const Icon = icons[type]
  return <Icon aria-hidden="true" {...props} />
}
