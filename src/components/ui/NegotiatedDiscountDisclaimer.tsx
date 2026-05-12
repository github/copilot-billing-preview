export const NEGOTIATED_DISCOUNT_DISCLAIMER = 'All values are provided without any additional negotiated discounts applied.'

type NegotiatedDiscountDisclaimerProps = {
  className?: string
}

export function NegotiatedDiscountDisclaimer({ className = '' }: NegotiatedDiscountDisclaimerProps) {
  return (
    <p className={`m-0 mt-1 text-[12px] text-fg-muted leading-normal ${className}`.trim()}>
      {NEGOTIATED_DISCOUNT_DISCLAIMER}
    </p>
  )
}
