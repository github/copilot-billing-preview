import type { TokenUsageRecord } from '../parser'
import { getDefaultSupportedUsageReportAdapter, type ReportFormat, type ReportFormatMetadata } from '../reportAdapters'
import { getReportUsageMetrics } from '../reportUsageMetrics'

export type AggregatorUsageMetrics = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export function getAggregatorReportFormat(
  reportMetadataOrFormat?: ReportFormat | ReportFormatMetadata,
): ReportFormat {
  if (!reportMetadataOrFormat) {
    return getDefaultSupportedUsageReportAdapter().metadata.format
  }

  return typeof reportMetadataOrFormat === 'string'
    ? reportMetadataOrFormat
    : reportMetadataOrFormat.format
}

export function getAggregatorUsageMetrics(
  record: TokenUsageRecord,
  reportFormat?: ReportFormat,
): AggregatorUsageMetrics {
  const metrics = getReportUsageMetrics(record, getAggregatorReportFormat(reportFormat))
  const comparison = metrics.transitionPeriodComparison ?? {
    requests: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }

  return {
    requests: comparison.requests,
    grossAmount: comparison.grossAmount,
    discountAmount: comparison.discountAmount,
    netAmount: comparison.netAmount,
    aicQuantity: metrics.aiCredits.quantity,
    aicGrossAmount: metrics.aiCredits.grossAmount,
    aicNetAmount: metrics.aiCredits.netAmount,
  }
}
