export function TextTabs<T extends string>({
  label,
  value,
  tabs,
  onChange,
}: {
  label: string
  value: T
  tabs: readonly { id: T; label: string }[]
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-4 border-b border-border px-4" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const on = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`h-11 text-[14px] font-bold ${on ? 'text-x underline decoration-x decoration-2 underline-offset-8' : 'text-muted-foreground'}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
