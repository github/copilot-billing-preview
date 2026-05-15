export type UserSpendSegmentId = 'power' | 'heavy' | 'typical' | 'light' | 'near-zero'

export type UserSpendInput = {
  username: string
  spendSegment?: UserSpendSegmentId
  totals: {
    aicGrossAmount: number
    aicQuantity: number
  }
}

export type ClassifiedUserSpendInput = UserSpendInput & {
  spendSegment: UserSpendSegmentId
}

export type UserSpendDriver = {
  username: string
  aicGrossAmount: number
  aicQuantity: number
  shareOfTotal: number
}

export type UserSpendSegment = {
  id: UserSpendSegmentId
  label: string
  description: string
  userCount: number
  totalAicGrossAmount: number
  totalAicQuantity: number
  averageAicGrossAmount: number
  medianAicGrossAmount: number
  shareOfTotal: number
  topUsers: UserSpendDriver[]
}

export type UserSpendInsights = {
  totalUsers: number
  totalAicGrossAmount: number
  totalAicQuantity: number
  positiveUserCount: number
  topUsers: UserSpendDriver[]
  topUserShare: number
  topUsersShare: number
  top10PercentUserCount: number
  top10PercentShare: number
  concentrationHeadline: string
  segments: UserSpendSegment[]
}

const SEGMENT_DEFINITIONS: Record<UserSpendSegmentId, Pick<UserSpendSegment, 'label' | 'description'>> = {
  'power': {
    label: 'Power users',
    description: 'Top 5% of active users by AIC gross cost.',
  },
  'heavy': {
    label: 'Heavy users',
    description: 'Next 15% of active users by AIC gross cost.',
  },
  'typical': {
    label: 'Typical users',
    description: 'Middle 55% of active users by AIC gross cost.',
  },
  'light': {
    label: 'Light users',
    description: 'Lowest 25% of active users with AIC gross cost.',
  },
  'near-zero': {
    label: 'Near-zero users',
    description: 'Users with no AIC gross cost in this report.',
  },
}

const SEGMENT_ORDER: UserSpendSegmentId[] = ['power', 'heavy', 'typical', 'light', 'near-zero']

export function getUserSpendSegmentLabel(id: UserSpendSegmentId): string {
  return SEGMENT_DEFINITIONS[id].label
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function createDriver(user: UserSpendInput, totalAicGrossAmount: number): UserSpendDriver {
  return {
    username: user.username,
    aicGrossAmount: user.totals.aicGrossAmount,
    aicQuantity: user.totals.aicQuantity,
    shareOfTotal: totalAicGrossAmount > 0 ? user.totals.aicGrossAmount / totalAicGrossAmount : 0,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function createSegment(
  id: UserSpendSegmentId,
  users: ClassifiedUserSpendInput[],
  totalAicGrossAmount: number,
): UserSpendSegment {
  const totalSegmentAicGrossAmount = users.reduce((sum, user) => sum + user.totals.aicGrossAmount, 0)
  const totalAicQuantity = users.reduce((sum, user) => sum + user.totals.aicQuantity, 0)

  return {
    id,
    ...SEGMENT_DEFINITIONS[id],
    userCount: users.length,
    totalAicGrossAmount: totalSegmentAicGrossAmount,
    totalAicQuantity,
    averageAicGrossAmount: users.length > 0 ? totalSegmentAicGrossAmount / users.length : 0,
    medianAicGrossAmount: median(users.map((user) => user.totals.aicGrossAmount)),
    shareOfTotal: totalAicGrossAmount > 0 ? totalSegmentAicGrossAmount / totalAicGrossAmount : 0,
    topUsers: users.slice(0, 3).map((user) => createDriver(user, totalAicGrossAmount)),
  }
}

function getSegmentId(index: number, positiveUserCount: number): UserSpendSegmentId {
  const powerCutoff = Math.max(1, Math.ceil(positiveUserCount * 0.05))
  const heavyCutoff = Math.max(powerCutoff, Math.ceil(positiveUserCount * 0.20))
  const typicalCutoff = Math.max(heavyCutoff, Math.ceil(positiveUserCount * 0.75))

  if (index < powerCutoff) return 'power'
  if (index < heavyCutoff) return 'heavy'
  if (index < typicalCutoff) return 'typical'
  return 'light'
}

function sortUsersByAicGrossAmount<T extends UserSpendInput>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const amountDiff = b.totals.aicGrossAmount - a.totals.aicGrossAmount
    return amountDiff !== 0 ? amountDiff : a.username.localeCompare(b.username)
  })
}

export function classifyUserSpendSegments(users: UserSpendInput[]): Map<string, UserSpendSegmentId> {
  const assignments = new Map<string, UserSpendSegmentId>()
  const sortedUsers = sortUsersByAicGrossAmount(users)
  const positiveUsers = sortedUsers.filter((user) => user.totals.aicGrossAmount > 0)

  positiveUsers.forEach((user, index) => {
    assignments.set(user.username, getSegmentId(index, positiveUsers.length))
  })
  sortedUsers
    .filter((user) => user.totals.aicGrossAmount <= 0)
    .forEach((user) => assignments.set(user.username, 'near-zero'))

  return assignments
}

export function calculateUserSpendInsights(users: ClassifiedUserSpendInput[], topUserLimit = 5): UserSpendInsights {
  const totalAicGrossAmount = users.reduce((sum, user) => sum + user.totals.aicGrossAmount, 0)
  const totalAicQuantity = users.reduce((sum, user) => sum + user.totals.aicQuantity, 0)
  const sortedUsers = sortUsersByAicGrossAmount(users)
  const positiveUsers = sortedUsers.filter((user) => user.totals.aicGrossAmount > 0)
  const topUsers = positiveUsers.slice(0, topUserLimit).map((user) => createDriver(user, totalAicGrossAmount))
  const topUsersTotal = topUsers.reduce((sum, user) => sum + user.aicGrossAmount, 0)
  const top10PercentUserCount = totalAicGrossAmount > 0 ? Math.max(1, Math.ceil(positiveUsers.length * 0.10)) : 0
  const top10PercentTotal = positiveUsers
    .slice(0, top10PercentUserCount)
    .reduce((sum, user) => sum + user.totals.aicGrossAmount, 0)

  const segmentUsers = new Map<UserSpendSegmentId, ClassifiedUserSpendInput[]>(SEGMENT_ORDER.map((id) => [id, []]))
  sortedUsers.forEach((user) => {
    segmentUsers.get(user.spendSegment)?.push(user)
  })

  const topDriver = topUsers[0]
  const top10PercentShare = totalAicGrossAmount > 0 ? top10PercentTotal / totalAicGrossAmount : 0
  const top10PercentUserLabel = `${top10PercentUserCount.toLocaleString()} ${top10PercentUserCount === 1 ? 'user' : 'users'}`
  const concentrationHeadline = totalAicGrossAmount > 0 && top10PercentUserCount > 0
    ? `The top 10% of users (${top10PercentUserLabel}) account for ${formatPercent(top10PercentShare)} of AIC gross cost.`
    : 'No AIC gross cost was found in this report.'

  return {
    totalUsers: users.length,
    totalAicGrossAmount,
    totalAicQuantity,
    positiveUserCount: positiveUsers.length,
    topUsers,
    topUserShare: topDriver?.shareOfTotal ?? 0,
    topUsersShare: totalAicGrossAmount > 0 ? topUsersTotal / totalAicGrossAmount : 0,
    top10PercentUserCount,
    top10PercentShare,
    concentrationHeadline,
    segments: SEGMENT_ORDER.map((id) => createSegment(id, segmentUsers.get(id) ?? [], totalAicGrossAmount)),
  }
}
