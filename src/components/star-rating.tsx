import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { snapRating } from '@/lib/model'

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  value: number | null
  onChange?: (value: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md'
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const starClass = size === 'sm' ? 'size-4' : 'size-7'
  const hit = size === 'sm' ? 'size-5' : 'size-11'

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  function setStars(next: number) {
    const snapped = snapRating(next)
    if (snapped === null) return
    onChange?.(snapped)
  }

  function onDraft(raw: string) {
    setDraft(raw)
    if (raw.trim() === '') return
    const snapped = snapRating(raw)
    if (snapped !== null && Math.abs(snapped - Number(raw)) < 0.001) onChange?.(snapped)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="group" aria-label="별점">
        {[1, 2, 3, 4, 5].map((index) => {
          const amount = Math.min(1, Math.max(0, (value ?? 0) - (index - 1)))
          return (
            <span key={index} className={`relative grid place-items-center ${hit}`}>
              <span className={`relative ${starClass}`}>
                <Star className={`${starClass} text-muted-foreground/35`} />
                <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${amount * 100}%` }}>
                  <Star className={`${starClass} fill-[#f5c518] text-[#f5c518]`} />
                </span>
              </span>
              {readOnly ? null : (
                <>
                  <button
                    type="button"
                    className="absolute inset-y-0 left-0 w-1/2"
                    aria-label={`${index - 0.5}점`}
                    onClick={() => setStars(index - 0.5)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 w-1/2"
                    aria-label={`${index}점`}
                    onClick={() => setStars(index)}
                  />
                </>
              )}
            </span>
          )
        })}
      </div>
      {readOnly ? (
        value === null ? null : <span className="text-sm tabular-nums text-muted-foreground">{value.toFixed(1)}</span>
      ) : (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={5}
          step={0.5}
          aria-label="별점 숫자"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onBlur={() => {
            const snapped = snapRating(draft)
            if (snapped === null) {
              setDraft(value === null ? '' : String(value))
              return
            }
            onChange?.(snapped)
          }}
          className="h-11 w-16 rounded-lg border bg-card text-center text-base tabular-nums"
        />
      )}
    </div>
  )
}
