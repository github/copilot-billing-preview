import { formatUsd } from '../../utils/format'
import { TriangleDownIcon, TriangleUpIcon, PlusIcon } from '@primer/octicons-react'

export type BillingComparisonCardProps = {
  title: string
  currentLabel: string
  currentValue: number
  aicLabel: string
  aicValue: number
  savingsText: string
  overspendText: string
  equalText?: string
}

export function BillingComparisonCard({
  title,
  currentLabel,
  currentValue,
  aicLabel,
  aicValue,
  savingsText,
  overspendText,
  equalText = 'AIC and PRU billing are equal',
}: BillingComparisonCardProps) {
  const diff = aicValue - currentValue
  const absDiff = Math.abs(diff)
  const pctChange = currentValue !== 0 ? (diff / currentValue) * 100 : 0
  const aicCheaper = diff < 0
  const same = Math.abs(diff) < 0.01

  return (
    <div className="bg-bg-muted border border-border-default rounded-md px-4 py-3 min-w-[260px] max-w-[340px] flex flex-col gap-[10px]">
      <h4 className="m-0 text-xs font-bold text-fg-muted uppercase tracking-wider">{title}</h4>
      <div className="flex flex-col gap-[6px]">
        <div className="flex justify-between items-center gap-4">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{currentLabel}</span>
          <span className="text-sm font-semibold text-fg-default tabular-nums">{formatUsd(currentValue)}</span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{aicLabel}</span>
          <span className="text-sm font-semibold text-fg-default tabular-nums">{formatUsd(aicValue)}</span>
        </div>
        <div className="h-px bg-border-default my-[2px]" />
        <div className="flex justify-between items-center gap-4">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">Difference</span>
          <span className={`text-sm font-semibold tabular-nums ${same ? 'text-fg-default' : aicCheaper ? 'text-app-savings-fg' : 'text-fg-danger'}`}>
            {same ? formatUsd(0) : `${aicCheaper ? '−' : '+'}${formatUsd(absDiff)}`}
            {!same && currentValue !== 0 && (
              <span className="text-xs font-medium">
                {` (${Math.abs(pctChange).toFixed(1)}%)`}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className={`flex items-center gap-2 px-[10px] py-2 rounded-md text-xs font-semibold ${same ? 'bg-bg-muted text-fg-muted border border-border-default' : aicCheaper ? 'bg-app-savings-bg text-app-savings-fg border border-app-savings-border' : 'bg-app-overspend-bg text-app-overspend-fg border border-app-overspend-border'}`}>
        {same ? <PlusIcon size={16} className="shrink-0" aria-hidden /> : aicCheaper ? <TriangleDownIcon size={16} className="shrink-0" aria-hidden /> : <TriangleUpIcon size={16} className="shrink-0" aria-hidden />}
        <span className="leading-[1.3]">
          {same ? equalText : aicCheaper ? savingsText : overspendText}
        </span>
      </div>
    </div>
  )
}
