/**
 * Cost calculation module for token-based billing.
 *
 * Cost formula:
 *   (num_input_tokens * input_token_multiplier)
 * + (num_output_tokens * output_token_multiplier)
 * + (num_cache_read_tokens * cache_read_token_multiplier)
 *
 * Note: Cache creation/write tokens are free.
 */

export interface ModelPricing {
  inputTokenMultiplier: number
  outputTokenMultiplier: number
  cacheReadTokenMultiplier: number
}

export interface ModelPricingConfig {
  models: Record<string, ModelPricing>
  defaultMultipliers: ModelPricing
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}

export interface CostBreakdown {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  totalCost: number
  /** Total cost converted to AI Units (1 AI Unit = $0.01) */
  aiUnits: number
}

/**
 * AI Unit conversion constant.
 * 1 AI Unit = $0.01
 */
export const AI_UNIT_VALUE = 0.01

/**
 * Converts a dollar cost to AI Units.
 * 1 AI Unit = $0.01, so $0.15125 = 15.125 AI Units
 */
export function costToAiUnits(cost: number): number {
  return cost / AI_UNIT_VALUE
}

/**
 * Calculates the cost for a given token usage based on the provided pricing.
 */
export function calculateCost(usage: TokenUsage, pricing: ModelPricing): CostBreakdown {
  const inputCost = usage.inputTokens * pricing.inputTokenMultiplier
  const outputCost = usage.outputTokens * pricing.outputTokenMultiplier
  const cacheReadCost = usage.cacheReadTokens * pricing.cacheReadTokenMultiplier
  const totalCost = inputCost + outputCost + cacheReadCost

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    totalCost,
    aiUnits: costToAiUnits(totalCost),
  }
}

/**
 * Gets the pricing for a specific model from the config.
 * Falls back to default multipliers if model is not found.
 */
export function getModelPricing(config: ModelPricingConfig, modelName: string): ModelPricing {
  return config.models[modelName] ?? config.defaultMultipliers
}

/**
 * Calculates cost for a model by name using the config.
 */
export function calculateCostForModel(
  config: ModelPricingConfig,
  modelName: string,
  usage: TokenUsage
): CostBreakdown {
  const pricing = getModelPricing(config, modelName)
  return calculateCost(usage, pricing)
}

/**
 * Fetches the model pricing configuration from the static JSON file.
 */
export async function fetchModelPricingConfig(): Promise<ModelPricingConfig> {
  const response = await fetch('/model-pricing.json')
  if (!response.ok) {
    throw new Error(`Failed to fetch model pricing config: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Creates a cost calculator instance with a loaded config.
 * This allows for efficient repeated calculations without re-fetching the config.
 */
export function createCostCalculator(config: ModelPricingConfig) {
  return {
    /**
     * Calculate cost for a specific model.
     */
    calculate(modelName: string, usage: TokenUsage): CostBreakdown {
      return calculateCostForModel(config, modelName, usage)
    },

    /**
     * Get pricing multipliers for a model.
     */
    getPricing(modelName: string): ModelPricing {
      return getModelPricing(config, modelName)
    },

    /**
     * Check if a model has explicit pricing defined.
     */
    hasModelPricing(modelName: string): boolean {
      return modelName in config.models
    },

    /**
     * Get all model names with explicit pricing.
     */
    getConfiguredModels(): string[] {
      return Object.keys(config.models)
    },
  }
}

export type CostCalculator = ReturnType<typeof createCostCalculator>
