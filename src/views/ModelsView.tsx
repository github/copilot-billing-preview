import { useState, useMemo } from 'react'
import type { ModelUsageResult, ModelDailyUsageData } from '../pipeline/aggregators/modelUsageAggregator'
import { BillingComparisonCard, DualAxisLineChart } from '../components'
import { formatUsd } from '../utils/format'

function formatAiu(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

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

function fillDataForRange(
  data: ModelDailyUsageData[],
  startDate: string | null,
  endDate: string | null,
): ModelDailyUsageData[] {
  if (!startDate || !endDate) return data

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return data

  const byDate = new Map<string, ModelDailyUsageData>()
  for (const item of data) {
    byDate.set(item.date, item)
  }

  const out: ModelDailyUsageData[] = []
  for (let current = start; current <= end; current = new Date(current.getTime() + 24 * 60 * 60 * 1000)) {
    const isoDate = current.toISOString().slice(0, 10)
    out.push(byDate.get(isoDate) ?? createEmptyModelDailyUsage(isoDate))
  }

  return out
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
    return fillDataForRange(raw, rangeStart, rangeEnd)
  }, [selectedModel, modelUsage, rangeStart, rangeEnd])

  const selectedModelAicDiscount = selectedModelTotals ? aicDiscountRate * selectedModelTotals.aiuGrossAmount : 0
  const selectedModelAicNetCost = selectedModelTotals
    ? Math.max(selectedModelTotals.aiuGrossAmount - selectedModelAicDiscount, 0)
    : 0

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

        {selectedModelTotals && (
          <div className="overview-cards">
            <div className="per-model__summary">
              <h4 className="cost-breakdown-card__title">PRU Cost</h4>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">Premium Requests</span>
                <span className="per-model__summary-value">{selectedModelTotals.requests.toLocaleString()}</span>
              </div>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">PRU Gross Cost</span>
                <span className="per-model__summary-value">{formatUsd(selectedModelTotals.grossAmount)}</span>
              </div>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">PRU Discounts</span>
                <span className="per-model__summary-value per-model__summary-value--muted">
                  {formatUsd(selectedModelTotals.discountAmount)}
                </span>
              </div>
              <div className="per-model__summary-row per-model__summary-row--highlight">
                <span className="per-model__summary-label">Net Cost</span>
                <span className="per-model__summary-value per-model__summary-value--bold">
                  {formatUsd(selectedModelTotals.netAmount)}
                </span>
              </div>
            </div>

            <div className="per-model__summary">
              <h4 className="cost-breakdown-card__title">AIC Cost</h4>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">AI Credits</span>
                <span className="per-model__summary-value">{formatAiu(selectedModelTotals.aiuQuantity)}</span>
              </div>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">AIC Gross Cost</span>
                <span className="per-model__summary-value">{formatUsd(selectedModelTotals.aiuGrossAmount)}</span>
              </div>
              <div className="per-model__summary-row">
                <span className="per-model__summary-label">AIC Discount</span>
                <span className="per-model__summary-value per-model__summary-value--muted">
                  {formatUsd(selectedModelAicDiscount)}
                </span>
              </div>
              <div className="per-model__summary-row per-model__summary-row--highlight">
                <span className="per-model__summary-label">Net Cost</span>
                <span className="per-model__summary-value per-model__summary-value--bold">
                  {formatUsd(selectedModelAicNetCost)}
                </span>
              </div>
            </div>

            <BillingComparisonCard
              title="Billing Comparison Gross"
              currentLabel="Current (PRU gross)"
              currentValue={selectedModelTotals.grossAmount}
              aicLabel="AIC (gross)"
              aicValue={selectedModelTotals.aiuGrossAmount}
              savingsText="AIC gross billing is cheaper for this model"
              overspendText="AIC gross billing is more expensive for this model"
            />
            <BillingComparisonCard
              title="Billing Comparison Net"
              currentLabel="Current (PRU net)"
              currentValue={selectedModelTotals.netAmount}
              aicLabel="AIC (net)"
              aicValue={selectedModelAicNetCost}
              savingsText="AIC net billing is cheaper for this model"
              overspendText="AIC net billing is more expensive for this model"
            />
          </div>
        )}
      </div>

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
