export const MAX_TOP_BREAKDOWN_ENTRIES = 20

type WithAicQuantity = {
  aicQuantity: number
}

export function compareByAicQuantity<T extends WithAicQuantity>(
  [leftLabel, leftTotals]: [string, T],
  [rightLabel, rightTotals]: [string, T],
): number {
  if (rightTotals.aicQuantity !== leftTotals.aicQuantity) {
    return rightTotals.aicQuantity - leftTotals.aicQuantity
  }

  return leftLabel.localeCompare(rightLabel)
}

export function pickTopEntries<T extends WithAicQuantity>(
  entries: Iterable<[string, T]>,
  limit = MAX_TOP_BREAKDOWN_ENTRIES,
): Record<string, T> {
  return Object.fromEntries(
    Array.from(entries)
      .sort(compareByAicQuantity)
      .slice(0, limit),
  )
}
