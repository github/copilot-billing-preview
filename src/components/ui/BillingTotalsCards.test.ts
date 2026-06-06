import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EXISTING_DISCOUNT_DISCLAIMER } from './ExistingDiscountDisclaimer'
import { BillingTotalsCards } from './BillingTotalsCards'

const BASE_PROPS = {
  pruNetAmount: 0,
  pruGrossAmount: 0,
  pruDiscountAmount: 0,
  pruQuantity: 0,
  aicNetAmount: 0,
  aicGrossAmount: 0.48,
  aicDiscountAmount: 0.48,
  aicQuantity: 48.173382,
  licenseAmount: 486,
  licenseSeatCounts: {
    business: 1,
    enterprise: 12,
  },
}

describe('BillingTotalsCards', () => {
  it('keeps the usage-based billing title and disclosures for native summer organization reports', () => {
    const html = renderToStaticMarkup(createElement(BillingTotalsCards, {
      ...BASE_PROPS,
      reportMode: 'native-ai-credits',
      showExistingDiscountDisclaimer: true,
      showOrganizationPromotionalDataDisclaimer: true,
    }))

    expect(html).toContain('Usage-based billing (AICs)')
    expect(html).toContain(EXISTING_DISCOUNT_DISCLAIMER)
    expect(html).toContain('Promotional amounts are used in this simulation.')
    expect(html).not.toContain('AI Credits usage')
    expect(html).not.toContain('Current billing (PRUs)')
  })

  it('omits the organization promotional note for native standard-period reports', () => {
    const html = renderToStaticMarkup(createElement(BillingTotalsCards, {
      ...BASE_PROPS,
      reportMode: 'native-ai-credits',
      showExistingDiscountDisclaimer: true,
      showOrganizationPromotionalDataDisclaimer: false,
    }))

    expect(html).toContain(EXISTING_DISCOUNT_DISCLAIMER)
    expect(html).not.toContain('Promotional amounts are used in this simulation.')
  })

  it('formats included discount rows with a single explicit minus sign', () => {
    const html = renderToStaticMarkup(createElement(BillingTotalsCards, {
      ...BASE_PROPS,
      pruDiscountAmount: -1,
      aicDiscountAmount: -2.34,
    }))

    expect(html).toContain('−$1.00')
    expect(html).toContain('−$2.34')
    expect(html).not.toContain('−$-')
  })
})
