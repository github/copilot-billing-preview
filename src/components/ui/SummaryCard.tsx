import type { ReactNode } from 'react'

interface BaseSummaryCardProps {
  label: string
  value: ReactNode
}

interface StaticSummaryCardProps extends BaseSummaryCardProps {
  clickable?: false
}

interface ClickableSummaryCardProps extends BaseSummaryCardProps {
  clickable: true
  onClick: () => void
  disabled?: boolean
}

export type SummaryCardProps = StaticSummaryCardProps | ClickableSummaryCardProps

export function SummaryCard(props: SummaryCardProps) {
  const { label, value, clickable } = props

  if (clickable) {
    const { onClick, disabled } = props
    return (
      <button
        type="button"
        className="bg-bg-default border border-border-default rounded-md py-4 px-6 flex flex-row items-center justify-between gap-1 min-w-[140px] cursor-pointer text-left appearance-none hover:bg-bg-muted hover:border-border-emphasis disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        disabled={disabled}
        onClick={onClick}
      >
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{label}</span>
          <span className="text-2xl font-bold text-fg-default tabular-nums">{value}</span>
        </div>
        <span className="text-fg-muted font-bold text-xl leading-none" aria-hidden>
          &gt;
        </span>
      </button>
    )
  }

  return (
    <div className="bg-bg-default border border-border-default rounded-md py-4 px-6 flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-fg-default tabular-nums">{value}</span>
    </div>
  )
}
