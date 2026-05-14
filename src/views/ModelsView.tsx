import { useState, useMemo } from 'react'
import { InfoIcon } from '@primer/octicons-react'
import type { ModelUsageResult, ModelDailyUsageData } from '../pipeline/aggregators/modelUsageAggregator'
import { DualAxisLineChart, MultiSeriesStackedBarChart } from '../components'
import { BillingProjectionDisclaimer, NegotiatedDiscountDisclaimer, PromotionalDataDisclaimer } from '../components/ui'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAic, formatUsd } from '../utils/format'

function createEmptyModelDailyUsage(date: string): ModelDailyUsageData {
  return {
    date,
    requests: 0,
    aicQuantity: 0,
    grossAmount: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

type ModelsViewProps = {
  modelUsage: ModelUsageResult
  isIndividualReport: boolean
  rangeStart: string | null
  rangeEnd: string | null
}

function formatAverageAicPerRequest(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function roundAverageAicPerRequest(value: number): number {
  return Number(value.toFixed(3))
}

export function ModelsView({ modelUsage, isIndividualReport, rangeStart, rangeEnd }: ModelsViewProps) {
  const [selectedModel, setSelectedModel] = useState<string>(modelUsage.models[0] ?? '')

  const selectedModelTotals = useMemo(
    () => (selectedModel ? modelUsage.totalsByModel[selectedModel] ?? null : null),
    [selectedModel, modelUsage],
  )

  const filledPerModelDailyData = useMemo(() => {
    const raw = selectedModel ? (modelUsage.byModel[selectedModel] ?? []) : []
    return fillDataForRange(raw, rangeStart, rangeEnd, createEmptyModelDailyUsage)
  }, [selectedModel, modelUsage, rangeStart, rangeEnd])

  const selectedModelAicDiscount = selectedModelTotals
    ? calculateAicDiscountAmount(selectedModelTotals.aicGrossAmount, selectedModelTotals.aicNetAmount)
    : 0
  const selectedModelAicNetAmount = selectedModelTotals
    ? selectedModelTotals.aicNetAmount
    : 0
  const dailyAverageAicPerRequest = useMemo(
    () => filledPerModelDailyData.map((day) => ({
      date: day.date,
      averageAicPerRequest: day.requests > 0 ? roundAverageAicPerRequest(day.aicQuantity / day.requests) : 0,
    })),
    [filledPerModelDailyData],
  )
  const overallAverageAicPerRequest = selectedModelTotals && selectedModelTotals.requests > 0
    ? selectedModelTotals.aicQuantity / selectedModelTotals.requests
    : 0
  const overallAverageAicGrossPerRequest = selectedModelTotals && selectedModelTotals.requests > 0
    ? selectedModelTotals.aicGrossAmount / selectedModelTotals.requests
    : 0

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null
  const showNegotiatedDiscountDisclaimer = !isIndividualReport

  return (
    <section className="flex flex-col gap-5" aria-label="Per-Model Breakdown">
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0 text-sm font-bold text-fg-default uppercase tracking-wide">Per-Model Breakdown</h3>
      </div>
      <div className="flex gap-4 items-start justify-between flex-wrap mb-5 w-full">
        <label className="flex flex-col gap-2 text-xs font-medium text-fg-muted uppercase tracking-wide">
          Model
          <select
            className="border border-border-default rounded-md px-3 py-2.5 text-sm min-w-[320px] text-fg-default bg-bg-default focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
          >
            {modelUsage.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedModelTotals && (() => {
        const savings = calculateSavingsDifference(selectedModelTotals.netAmount, selectedModelAicNetAmount)
        return (
          <>
            {periodLabel && (
              <p className="text-base font-normal text-center mb-1 text-fg-default">
                {savings > 0 ? (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}<strong>{formatUsd(savings)} less</strong> under usage-based billing</>
                ) : savings < 0 ? (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}<strong>{formatUsd(Math.abs(savings))} more</strong> under usage-based billing</>
                ) : (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under usage-based billing</>
                )}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 text-center py-7">
                <div className="text-[13px] font-medium text-fg-muted uppercase tracking-wide mb-3">Current billing (PRUs)</div>
                <div className="text-4xl font-bold leading-tight text-fg-default">{formatUsd(selectedModelTotals.netAmount)}</div>
                <div className="text-sm text-fg-default mt-1.5">{selectedModelTotals.requests.toLocaleString()} PRUs</div>
                <div className="text-xs text-fg-muted mt-1">1 PRU = $0.04</div>
                <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                  <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                    <span>Consumed PRUs</span>
                    <span>{formatUsd(selectedModelTotals.grossAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                    <span>Included PRUs</span>
                    <span>−{formatUsd(selectedModelTotals.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                    <span>Overages</span>
                    <span>{formatUsd(selectedModelTotals.netAmount)}</span>
                  </div>
                  {showNegotiatedDiscountDisclaimer && <NegotiatedDiscountDisclaimer />}
                </div>
              </div>
              <div className="bg-bg-default border border-border-default rounded-md px-5 py-4 text-center py-7">
                <div className="text-[13px] font-medium text-fg-muted uppercase tracking-wide mb-3">Usage-based billing (AICs)</div>
                <div className="text-4xl font-bold leading-tight text-app-savings-fg">{formatUsd(selectedModelAicNetAmount)}</div>
                <div className="text-sm text-fg-default mt-1.5">{formatAic(selectedModelTotals.aicQuantity)} AICs</div>
                <div className="text-xs text-fg-muted mt-1">1 AIC = $0.01</div>
                <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                  <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                    <span>Consumed AICs</span>
                    <span>{formatUsd(selectedModelTotals.aicGrossAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                    <span>Included AICs</span>
                    <span>−{formatUsd(selectedModelAicDiscount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                    <span>Additional usage</span>
                    <span>{formatUsd(selectedModelAicNetAmount)}</span>
                  </div>
                  {showNegotiatedDiscountDisclaimer ? <NegotiatedDiscountDisclaimer /> : <PromotionalDataDisclaimer />}
                </div>
              </div>
            </div>
            <BillingProjectionDisclaimer className="mb-6" />
          </>
        )
      })()}

      {selectedModel && filledPerModelDailyData.length > 0 && (
        <div className="grid grid-cols-1 gap-6 w-full">
          <div className="flex flex-col gap-[10px]">
            <MultiSeriesStackedBarChart
              title={`Daily average AIC per Request (${selectedModel})`}
              labels={dailyAverageAicPerRequest.map((day) => day.date)}
              series={[
                {
                  label: 'Average daily AICs per request',
                  color: '#14b8a6',
                  data: dailyAverageAicPerRequest.map((day) => day.averageAicPerRequest),
                },
              ]}
              height={320}
            />
            <p className="m-0 text-base font-normal text-center text-fg-default">
              Average AICs per request for <strong>{selectedModel}</strong> in the current report period:{' '}
              <strong>{formatAverageAicPerRequest(overallAverageAicPerRequest)}</strong>, average gross per request{' '}
              <strong>{formatUsd(overallAverageAicGrossPerRequest)}</strong>
            </p>
          </div>
          <DualAxisLineChart
            title={`Daily Requests & AI Credits (${selectedModel})`}
            labels={filledPerModelDailyData.map((day) => day.date)}
            series={[
              {
                label: 'Premium Requests',
                color: '#6366f1',
                data: filledPerModelDailyData.map((day) => day.requests),
                yAxisID: 'y',
              },
              {
                label: 'AI Credits',
                color: '#22c55e',
                data: filledPerModelDailyData.map((day) => day.aicQuantity),
                yAxisID: 'y1',
              },
            ]}
            height={320}
          />
          <DualAxisLineChart
            title={`Daily Gross Breakdown (${selectedModel})`}
            labels={filledPerModelDailyData.map((day) => day.date)}
            series={[
              {
                label: 'PRU Gross Cost',
                color: '#f59e0b',
                data: filledPerModelDailyData.map((day) => day.grossAmount),
                yAxisID: 'y',
              },
              {
                label: 'AIC Gross Cost',
                color: '#06b6d4',
                data: filledPerModelDailyData.map((day) => day.aicGrossAmount),
                yAxisID: 'y',
              },
            ]}
            height={320}
          />
          <div className="flex items-start gap-[10px] px-4 py-3 bg-bg-accent-muted border border-border-accent/25 rounded-md mt-2">
            <InfoIcon size={16} className="fill-fg-accent shrink-0 mt-0.5" aria-hidden />
            <p className="m-0 text-[13px] text-fg-default leading-normal">Gross cost is shown before included-credits discounts. Under usage-based billing, included AICs from the account-wide pool will reduce net costs.</p>
          </div>
        </div>
      )}
    </section>
  )
}
