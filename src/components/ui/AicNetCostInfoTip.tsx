import { InfoTip } from '../InfoTip'

const AIC_NET_COST_INFO = 'All values are provided without any additional negotiated discounts applied.'

export function AicNetCostInfoTip() {
  return (
    <InfoTip
      text={AIC_NET_COST_INFO}
      buttonLabel="More info about usage-based billing net cost"
      className="-translate-y-2"
    />
  )
}
