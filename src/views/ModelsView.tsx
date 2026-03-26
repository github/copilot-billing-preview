import { useState, useMemo } from 'react'
import type { ModelUsageResult, ModelDailyUsageData } from '../pipeline/aggregators/modelUsageAggregator'
import { DualAxisLineChart } from '../components'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAiu, formatUsd } from '../utils/format'

function createEmptyModelDailyUsage(date: string): ModelDailyUsageData {
  return {
    date,
    requests: 0,
    aiuQuantity: 0,
    grossAmount: 0,
    aiuGrossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

type ModelsViewProps = {
  modelUsage: ModelUsageResult
  aicDiscountRate: number
  rangeStart: string | null
  rangeEnd: string | null
}

export function ModelsView({ modelUsage, aicDiscountRate, rangeStart, rangeEnd }: ModelsViewProps) {
  const [selectedModel, setSelectedModel] = useState<string>(modelUsage.models[0] ?? '')

  const selectedModelTotals = useMemo(
    () => (selectedModel ? modelUsage.totalsByModel[selectedModel] ?? null : null),
    [selectedModel, modelUsage],
  )

  const filledPerModelDailyData = useMemo(() => {
    const raw = selectedModel ? (modelUsage.byModel[selectedModel] ?? []) : []
    return fillDataForRange(raw, rangeStart, rangeEnd, createEmptyModelDailyUsage)
  }, [selectedModel, modelUsage, rangeStart, rangeEnd])

  const selectedModelAicDiscount = selectedModelTotals ? aicDiscountRate * selectedModelTotals.aiuGrossAmount : 0
  const selectedModelAicNetCost = selectedModelTotals
    ? Math.max(selectedModelTotals.aiuGrossAmount - selectedModelAicDiscount, 0)
    : 0

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <section className="per-model" aria-label="Per-Model Breakdown">
      <div className="per-model__header">
        <h3 className="per-model__title">Per-Model Breakdown</h3>
      </div>
      <div className="per-model__controls">
        <label className="per-model__label">
          Model
          <select
            className="per-model__select"
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
        const savings = selectedModelTotals.netAmount - selectedModelAicNetCost
        return (
          <>
            {periodLabel && (
              <p className="comparison-framing">
                {savings > 0 ? (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}<strong>{formatUsd(savings)} less</strong> under token-based pricing</>
                ) : savings < 0 ? (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}<strong>{formatUsd(Math.abs(savings))} more</strong> under token-based pricing</>
                ) : (
                  <><strong>{selectedModel}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under token-based pricing</>
                )}
              </p>
            )}

            <div className="comparison-grid">
              <div className="card comparison-card">
                <div className="comparison-card__label">Current billing (PRUs)</div>
                <div className="comparison-card__big-number">{formatUsd(selectedModelTotals.netAmount)}</div>
                <div className="comparison-card__period">{selectedModelTotals.requests.toLocaleString()} PRUs</div>
                <div className="comparison-card__rate">1 PRU = $0.04</div>
                <div className="comparison-card__breakdown">
                  <div className="comparison-card__breakdown-row">
                    <span>Gross cost</span>
                    <span>{formatUsd(selectedModelTotals.grossAmount)}</span>
                  </div>
                  <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                    <span>Discounts</span>
                    <span>−{formatUsd(selectedModelTotals.discountAmount)}</span>
                  </div>
                  <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                    <span>Net cost</span>
                    <span>{formatUsd(selectedModelTotals.netAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="card comparison-card">
                <div className="comparison-card__label">Token-based billing (AICs)</div>
                <div className="comparison-card__big-number comparison-card__big-number--aiu">{formatUsd(selectedModelAicNetCost)}</div>
                <div className="comparison-card__period">{formatAiu(selectedModelTotals.aiuQuantity)} AICs</div>
                <div className="comparison-card__rate">1 AIC = $0.01</div>
                <div className="comparison-card__breakdown">
                  <div className="comparison-card__breakdown-row">
                    <span>Gross cost</span>
                    <span>{formatUsd(selectedModelTotals.aiuGrossAmount)}</span>
                  </div>
                  <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                    <span>Included credits discount</span>
                    <span>−{formatUsd(selectedModelAicDiscount)}</span>
                  </div>
                  <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                    <span>Net cost</span>
                    <span>{formatUsd(selectedModelAicNetCost)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {selectedModel && filledPerModelDailyData.length > 0 && (
        <div className="per-model__charts charts-grid">
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
                data: filledPerModelDailyData.map((day) => day.aiuQuantity),
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
                data: filledPerModelDailyData.map((day) => day.aiuGrossAmount),
                yAxisID: 'y',
              },
            ]}
            height={320}
          />
        </div>
      )}
    </section>
  )
}
