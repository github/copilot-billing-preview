import type { DailyUsageData } from '../pipeline/aggregators/dailyUsageAggregator'

export function calculateOverviewAicDiscountRate(dailyUsageData: DailyUsageData[], pooledAicCredits: number): number {
  const totalAicQuantity = dailyUsageData.reduce((sum, day) => sum + day.aicQuantity, 0)
  return totalAicQuantity > 0 ? Math.min(pooledAicCredits / totalAicQuantity, 1) : 0
}
