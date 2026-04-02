import type { TokenUsageRecord } from './parser'

export const NON_COPILOT_CODE_REVIEW_PRODUCT = 'Code Review for Non-Copilot Users' as const
export const NON_COPILOT_CODE_REVIEW_USER_LABEL = 'Non-Copilot Users' as const

export function isSparkProduct(product: string, sku: string): boolean {
  const normalizedProduct = product.trim().toLowerCase()
  const normalizedSku = sku.trim().toLowerCase()

  return normalizedProduct === 'spark' || normalizedSku === 'spark_premium_request'
}

export function isCodingAgentModel(model: string): boolean {
  const normalizedModel = model.trim().toLowerCase()
  return normalizedModel.includes('coding agent') || normalizedModel.includes('padawan')
}

export function isCodeReviewModel(model: string): boolean {
  return model.trim().toLowerCase().includes('code review')
}

export function isNonCopilotCodeReviewUsage(record: Pick<TokenUsageRecord, 'username' | 'model'>): boolean {
  return record.username.trim().length === 0 && isCodeReviewModel(record.model)
}

export function getFriendlyProductName(record: Pick<TokenUsageRecord, 'username' | 'product' | 'sku' | 'model'>): string {
  if (isNonCopilotCodeReviewUsage(record)) return NON_COPILOT_CODE_REVIEW_PRODUCT
  if (isSparkProduct(record.product, record.sku)) return 'Spark'
  if (isCodingAgentModel(record.model)) return 'Copilot Cloud Agent'
  if (isCodeReviewModel(record.model)) return 'Code Review'
  return 'Copilot'
}
