import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type QuickStatsResult = {
  lineCount: number
  userCount: number
  orgCount: number
  costCenterCount: number
}

export class QuickStatsAggregator implements Aggregator<TokenUsageRecord, QuickStatsResult, TokenUsageHeader> {
  private count = 0
  private users = new Set<string>()
  private orgs = new Set<string>()
  private costCenters = new Set<string>()

  onHeader(): void {
    // header is intentionally ignored for stats
  }

  accumulate(record: TokenUsageRecord): void {
    this.count += 1

    if (record.username) {
      this.users.add(record.username)
    }

    if (record.organization) {
      this.orgs.add(record.organization)
    }

    if (record.cost_center_name) {
      this.costCenters.add(record.cost_center_name)
    }
  }

  result(): QuickStatsResult {
    return {
      lineCount: this.count,
      userCount: this.users.size,
      orgCount: this.orgs.size,
      costCenterCount: this.costCenters.size,
    }
  }
}
