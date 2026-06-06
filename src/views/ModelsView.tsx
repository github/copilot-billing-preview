import { useState, useMemo } from 'react'
import { InfoIcon } from '@primer/octicons-react'
import type { ModelUsageResult, ModelDailyUsageData, ModelUsageTotals } from '../pipeline/aggregators/modelUsageAggregator'
import { DualAxisLineChart, MultiSeriesStackedBarChart } from '../components'
import { BillingProjectionDisclaimer, BillingTotalsCards } from '../components/ui'
import { th, thNum, td, tdNum } from '../components/ui/tableStyles'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAic, formatUsd } from '../utils/format'
import { isNativeAiCreditsMode, type ReportMode } from '../utils/reportMode'

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
  reportMode?: ReportMode
  showOrganizationPromotionalDataDisclaimer?: boolean
}

type ModelDriverRow = {
  model: string
  totals: ModelUsageTotals
}

type ModelDriverSummary = {
  totalAicQuantity: number
  topAicModels: ModelDriverRow[]
  hasUsage: boolean
}

function formatAverageAicPerRequest(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function roundAverageAicPerRequest(value: number): number {
  return Number(value.toFixed(3))
}

function formatShare(value: number, total: number): string {
  if (value <= 0 || total <= 0) return '0%'

  return (value / total).toLocaleString(undefined, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

function sortByMetric(metric: (totals: ModelUsageTotals) => number) {
  return (a: ModelDriverRow, b: ModelDriverRow) => metric(b.totals) - metric(a.totals) || a.model.localeCompare(b.model)
}

function getModelDriverSummary(modelUsage: ModelUsageResult): ModelDriverSummary {
  const rows: ModelDriverRow[] = []

  for (const model of modelUsage.models) {
    const totals = modelUsage.totalsByModel[model]
    if (totals) {
      rows.push({ model, totals })
    }
  }

  const totalAicQuantity = rows.reduce((sum, row) => sum + row.totals.aicQuantity, 0)
  const byAicQuantity = [...rows].sort(sortByMetric((totals) => totals.aicQuantity))

  return {
    totalAicQuantity,
    topAicModels: byAicQuantity.slice(0, 3),
    hasUsage: totalAicQuantity > 0,
  }
}

export function ModelsView({
  modelUsage,
  isIndividualReport,
  rangeStart,
  rangeEnd,
  reportMode = 'transition-period-billing-preview',
  showOrganizationPromotionalDataDisclaimer = true,
}: ModelsViewProps) {
  const [selectedModel, setSelectedModel] = useState<string>(modelUsage.models[0] ?? '')
  const isNativeAiCredits = isNativeAiCreditsMode(reportMode)

  const modelDriverSummary = useMemo(
    () => getModelDriverSummary(modelUsage),
    [modelUsage],
  )

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

  return (
    <section className="flex flex-col gap-3" aria-label="Models">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="m-0 text-lg text-fg-default">Models</h2>
        <span className="text-[13px] text-fg-muted">
          {modelUsage.models.length.toLocaleString()} total
        </span>
      </div>

      {modelDriverSummary.hasUsage ? (
        <div className="bg-bg-default border border-border-default rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default text-xs font-bold tracking-[0.05em] uppercase text-fg-muted bg-bg-muted">
            Top models by AIC consumption
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Rank</th>
                  <th className={th}>Model</th>
                  <th className={thNum}>AICs</th>
                  <th className={thNum}>% of AICs</th>
                  <th className={thNum}>Gross cost</th>
                </tr>
              </thead>
              <tbody>
                {modelDriverSummary.topAicModels.map((row, index) => (
                  <tr key={row.model}>
                    <td className={`${td} text-fg-muted tabular-nums`}>{index + 1}</td>
                    <td className={`${td} font-semibold text-fg-default`}>{row.model}</td>
                    <td className={tdNum}>{formatAic(row.totals.aicQuantity)}</td>
                    <td className={tdNum}>{formatShare(row.totals.aicQuantity, modelDriverSummary.totalAicQuantity)}</td>
                    <td className={tdNum}>{formatUsd(row.totals.aicGrossAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="m-0 text-sm text-fg-muted leading-normal">
          No AIC consumption or gross usage-based cost appears in this report.
        </p>
      )}
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
            {!isNativeAiCredits && periodLabel && (
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

            <BillingTotalsCards
              pruNetAmount={selectedModelTotals.netAmount}
              pruGrossAmount={selectedModelTotals.grossAmount}
              pruDiscountAmount={selectedModelTotals.discountAmount}
              pruQuantity={selectedModelTotals.requests}
              aicNetAmount={selectedModelAicNetAmount}
              aicGrossAmount={selectedModelTotals.aicGrossAmount}
              aicDiscountAmount={selectedModelAicDiscount}
              aicQuantity={selectedModelTotals.aicQuantity}
              showExistingDiscountDisclaimer={!isIndividualReport}
              showPromotionalDataDisclaimer={isIndividualReport}
              showOrganizationPromotionalDataDisclaimer={!isIndividualReport && showOrganizationPromotionalDataDisclaimer}
              reportMode={reportMode}
              className="mb-3"
            />
            {!isNativeAiCredits && <BillingProjectionDisclaimer className="mb-6" />}
          </>
        )
      })()}

      {selectedModel && filledPerModelDailyData.length > 0 && (
        <div className="grid grid-cols-1 gap-6 w-full">
          {!isNativeAiCredits && (
            <>
              <div className="flex flex-col gap-[10px]">
                <MultiSeriesStackedBarChart
                  title={`Daily average AICs per PRU (${selectedModel})`}
                  labels={dailyAverageAicPerRequest.map((day) => day.date)}
                  series={[
                    {
                      label: 'Average daily AICs per PRU',
                      color: '#14b8a6',
                      data: dailyAverageAicPerRequest.map((day) => day.averageAicPerRequest),
                    },
                  ]}
                  height={320}
                />
                <p className="m-0 text-base font-normal text-center text-fg-default">
                  Average AICs per PRU for <strong>{selectedModel}</strong> in the current report period:{' '}
                  <strong>{formatAverageAicPerRequest(overallAverageAicPerRequest)}</strong>, average gross per PRU{' '}
                  <strong>{formatUsd(overallAverageAicGrossPerRequest)}</strong>
                </p>
                <p className="m-0 text-[13px] text-center text-fg-muted leading-normal">
                  Note: PRU quantities include billing-period model multipliers, so AICs per PRU should not be read as AICs per actual request when comparing models.
                </p>
              </div>
              <DualAxisLineChart
                title={`Daily PRUs & AI Credits (${selectedModel})`}
                labels={filledPerModelDailyData.map((day) => day.date)}
                series={[
                  {
                    label: 'PRUs',
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
            </>
          )}
          <DualAxisLineChart
            title={`Daily AI Credits gross and net cost (${selectedModel})`}
            labels={filledPerModelDailyData.map((day) => day.date)}
            series={[
              {
                label: 'AIC Gross Cost',
                color: '#06b6d4',
                data: filledPerModelDailyData.map((day) => day.aicGrossAmount),
                yAxisID: 'y',
              },
              {
                label: 'AIC Net Cost',
                color: '#22c55e',
                data: filledPerModelDailyData.map((day) => day.aicNetAmount),
                yAxisID: 'y',
              },
            ]}
            formatYAsCurrency
            height={320}
          />
          <div className="flex items-start gap-[10px] px-4 py-3 bg-bg-accent-muted border border-border-accent/25 rounded-md mt-2">
            <InfoIcon size={16} className="fill-fg-accent shrink-0 mt-0.5" aria-hidden />
            <p className="m-0 text-[13px] text-fg-default leading-normal">Gross cost is shown before included-credits discounts. Included AICs from the account-wide pool reduce net costs.</p>
          </div>
        </div>
      )}
    </section>
  )
}
