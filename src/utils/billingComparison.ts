export function calculateAicDiscountAmount(aicGrossAmount: number, aicNetAmount: number): number {
  return aicGrossAmount - aicNetAmount
}

export function calculateSavingsDifference(netAmount: number, aicNetAmount: number): number {
  return netAmount - aicNetAmount
}
