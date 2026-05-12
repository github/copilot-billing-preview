import type { TokenUsageRecord } from './parser'

export const NON_COPILOT_CODE_REVIEW_PRODUCT = 'Code Review for Non-Copilot Users' as const
export const NON_COPILOT_CODE_REVIEW_USER_LABEL = 'Non-Copilot Users' as const
export const PRODUCT_BUDGET_COPILOT_CLOUD_AGENT = 'Copilot Cloud Agent' as const
export const PRODUCT_BUDGET_SPARK = 'Spark' as const
export const PRODUCT_BUDGET_COPILOT = 'Copilot' as const

export type ProductBudgetName =
  | typeof PRODUCT_BUDGET_COPILOT_CLOUD_AGENT
  | typeof PRODUCT_BUDGET_SPARK
  | typeof PRODUCT_BUDGET_COPILOT

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
  if (isSparkProduct(record.product, record.sku)) return 'Spark'
  if (isCodingAgentModel(record.model)) return 'Copilot Cloud Agent'
  return 'Copilot'
}

export function getProductBudgetName(record: Pick<TokenUsageRecord, 'product' | 'sku' | 'model'>): ProductBudgetName {
  if (isSparkProduct(record.product, record.sku)) return PRODUCT_BUDGET_SPARK
  if (isCodingAgentModel(record.model)) return PRODUCT_BUDGET_COPILOT_CLOUD_AGENT
  return PRODUCT_BUDGET_COPILOT
}
