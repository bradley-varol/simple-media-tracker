import { Star } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { isExceptional, maxRating, type AppSettings } from "@/types/settings"

function label(rating: number, settings: AppSettings): string {
  return isExceptional(rating, settings)
    ? `${rating} out of ${settings.ratingScale} stars, exceptional`
    : `${rating} out of ${settings.ratingScale} stars`
}

export function StarRating({ rating, settings }: { rating: number | null; settings: AppSettings }) {
  if (!rating) return <span className="empty-value">—</span>

  const exceptional = isExceptional(rating, settings)
  // A ten star row of icons is a lot of noise in a table, so longer scales read
  // as a number and one star instead of a row of them.
  if (settings.ratingScale > 5) {
    return (
      <span className={exceptional ? "score-rating is-exceptional" : "score-rating"} aria-label={label(rating, settings)}>
        <Star aria-hidden="true" size={14} strokeWidth={1.8} fill="currentColor" />
        <span><strong>{rating}</strong>/{settings.ratingScale}</span>
      </span>
    )
  }

  const shown = exceptional ? maxRating(settings) : settings.ratingScale
  return (
    <span className="star-rating" aria-label={label(rating, settings)}>
      {Array.from({ length: shown }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={index >= settings.ratingScale ? "star-exceptional" : index < rating ? "star-filled" : "star-empty"}
          size={15}
          strokeWidth={1.8}
          fill={index < rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  )
}

export function StarRatingInput({
  rating,
  settings,
  onChange,
}: {
  rating: number | null
  settings: AppSettings
  onChange: (rating: number | null) => void
}) {
  const exceptionalValue = maxRating(settings)
  const compact = settings.ratingScale > 5

  return (
    <div
      className={compact ? "rating-input is-compact" : "rating-input"}
      role="group"
      aria-label={`Rating out of ${settings.ratingScale} stars${settings.exceptionalEnabled ? ", with an exceptional extra star" : ""}`}
    >
      {Array.from({ length: settings.ratingScale }, (_, index) => {
        const value = index + 1
        return (
          <button
            type="button"
            key={value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            aria-pressed={rating === value}
            className={value <= (rating ?? 0) ? "rating-choice is-selected" : "rating-choice"}
            onClick={() => onChange(rating === value ? null : value)}
          >
            <Star size={compact ? 19 : 25} strokeWidth={1.6} fill={value <= (rating ?? 0) ? "currentColor" : "none"} />
          </button>
        )
      })}
      {settings.exceptionalEnabled && (
        <span className="rating-extra-wrapper">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${exceptionalValue} out of ${settings.ratingScale} stars, exceptional`}
                aria-pressed={rating === exceptionalValue}
                className={rating === exceptionalValue ? "rating-choice rating-choice-extra is-selected" : "rating-choice rating-choice-extra"}
                onClick={() => onChange(rating === exceptionalValue ? null : exceptionalValue)}
              >
                <Star size={compact ? 19 : 25} strokeWidth={1.6} fill={rating === exceptionalValue ? "currentColor" : "none"} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Exceptional · {exceptionalValue} out of {settings.ratingScale}</TooltipContent>
          </Tooltip>
        </span>
      )}
      <span className="rating-hint">
        {rating
          ? isExceptional(rating, settings)
            ? `${rating} / ${settings.ratingScale} · exceptional`
            : `${rating} / ${settings.ratingScale}`
          : "Not rated"}
      </span>
    </div>
  )
}
