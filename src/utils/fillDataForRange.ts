export type DatedMetric = {
  date: string
}

export function fillDataForRange<T extends DatedMetric>(
  data: T[],
  startDate: string | null,
  endDate: string | null,
  createEmpty: (date: string) => T,
): T[] {
  if (!startDate || !endDate) return data

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return data

  const byDate = new Map<string, T>()
  for (const item of data) {
    byDate.set(item.date, item)
  }

  const out: T[] = []
  for (let current = start; current <= end; current = new Date(current.getTime() + 24 * 60 * 60 * 1000)) {
    const isoDate = current.toISOString().slice(0, 10)
    out.push(byDate.get(isoDate) ?? createEmpty(isoDate))
  }

  return out
}
