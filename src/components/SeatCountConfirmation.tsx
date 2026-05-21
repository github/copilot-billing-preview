import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PeopleIcon, ArrowRightIcon } from '@primer/octicons-react'
import { ValidationPopover } from './InfoTip'
import { getSeatReductionError, parseSeatCountInput } from '../utils/seatCounts'

export type SeatCountConfirmationProps = {
  fileName: string | null
  defaultBusinessSeats: number
  defaultEnterpriseSeats: number
  error: string | null
  isApplying: boolean
  onConfirm: (counts: { business: number; enterprise: number }) => void
}

export function SeatCountConfirmation({
  fileName,
  defaultBusinessSeats,
  defaultEnterpriseSeats,
  error,
  isApplying,
  onConfirm,
}: SeatCountConfirmationProps) {
  const [businessDraft, setBusinessDraft] = useState<string>(String(defaultBusinessSeats))
  const [enterpriseDraft, setEnterpriseDraft] = useState<string>(String(defaultEnterpriseSeats))

  const businessError = useMemo(() => getSeatReductionError(businessDraft, defaultBusinessSeats), [businessDraft, defaultBusinessSeats])
  const enterpriseError = useMemo(() => getSeatReductionError(enterpriseDraft, defaultEnterpriseSeats), [enterpriseDraft, defaultEnterpriseSeats])
  const hasError = Boolean(businessError || enterpriseError)
  const normalizedBusinessSeats = parseSeatCountInput(businessDraft, defaultBusinessSeats)
  const normalizedEnterpriseSeats = parseSeatCountInput(enterpriseDraft, defaultEnterpriseSeats)
  const hasAddedSeats = normalizedBusinessSeats > defaultBusinessSeats || normalizedEnterpriseSeats > defaultEnterpriseSeats
  const canApply = !hasError && !isApplying

  const onBusinessChange = (event: ChangeEvent<HTMLInputElement>) => setBusinessDraft(event.target.value)
  const onEnterpriseChange = (event: ChangeEvent<HTMLInputElement>) => setEnterpriseDraft(event.target.value)

  const handleApply = () => {
    if (!canApply) return
    onConfirm({
      business: normalizedBusinessSeats,
      enterprise: normalizedEnterpriseSeats,
    })
  }

  const inputBase = 'no-spin-number w-full px-3 py-2 text-[15px] tabular-nums text-right border rounded-md bg-bg-default focus:outline-none'
  const inputOk = `${inputBase} border-border-default focus:border-fg-accent focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]`
  const inputBad = `${inputBase} border-border-danger text-fg-danger focus:border-border-danger focus:shadow-[0_0_0_3px_rgba(207,34,46,0.3)]`

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 py-6 px-4 sm:pt-12 sm:px-6 sm:pb-8 bg-bg-muted">
      <div className="max-w-[680px] w-full bg-bg-default border border-border-default rounded-[16px] shadow-[0_8px_24px_rgba(31,35,40,0.08)] py-8 px-5 sm:py-10 sm:px-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bg-accent-muted border border-border-accent/25 mb-4" aria-hidden="true">
            <PeopleIcon size={28} className="text-fg-accent" />
          </div>
          <h1 className="m-0 mb-2 text-[22px] sm:text-[26px] leading-[1.25] text-fg-default font-bold">Review licensed seat counts</h1>
          <p className="m-0 max-w-[520px] text-fg-muted text-[14px] leading-[1.6]">
            Licensed users without billable activity during the report period may be missing from the
            uploaded CSV. Add any missing Copilot Business and Enterprise seats so included AI Credits
            are pooled across all licensed users and your estimate is more accurate.
          </p>
          <p className="m-0 mt-3 max-w-[520px] text-fg-muted text-[13px] leading-[1.6]">
            Current licensed seat totals are available in your enterprise account under
            <br />
            <strong className="text-fg-default">Billing and licensing &rarr; Licensing</strong>.
          </p>
          {fileName && (
            <p className="m-0 mt-2 text-[12px] text-fg-muted">
              Report: <span className="font-semibold text-fg-default">{fileName}</span>
            </p>
          )}
          {error && (
            <div className="mt-4 py-3 px-4 rounded-md bg-bg-danger-muted text-fg-danger border border-border-danger text-sm" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="seat-confirm-business" className="text-[13px] font-semibold text-fg-default">
              Total Copilot Business seats
            </label>
            <ValidationPopover id="seat-confirm-business-error" text={businessError}>
              <input
                id="seat-confirm-business"
                type="number"
                inputMode="numeric"
                min={defaultBusinessSeats}
                step="1"
                value={businessDraft}
                onChange={onBusinessChange}
                className={businessError ? inputBad : inputOk}
                aria-invalid={businessError ? 'true' : undefined}
                aria-describedby={businessError ? 'seat-confirm-business-error' : undefined}
                disabled={isApplying}
              />
            </ValidationPopover>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="seat-confirm-enterprise" className="text-[13px] font-semibold text-fg-default">
              Total Copilot Enterprise seats
            </label>
            <ValidationPopover id="seat-confirm-enterprise-error" text={enterpriseError}>
              <input
                id="seat-confirm-enterprise"
                type="number"
                inputMode="numeric"
                min={defaultEnterpriseSeats}
                step="1"
                value={enterpriseDraft}
                onChange={onEnterpriseChange}
                className={enterpriseError ? inputBad : inputOk}
                aria-invalid={enterpriseError ? 'true' : undefined}
                aria-describedby={enterpriseError ? 'seat-confirm-enterprise-error' : undefined}
                disabled={isApplying}
              />
            </ValidationPopover>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-fg-on-emphasis bg-bg-success-emphasis hover:bg-app-savings-fg disabled:opacity-50 disabled:cursor-not-allowed rounded-md py-2 px-5 cursor-pointer border-0 focus-visible:outline-2 focus-visible:outline-border-accent focus-visible:outline-offset-2"
          >
            {isApplying ? 'Applying…' : (
              <>
                {hasAddedSeats ? 'Apply and view estimate' : 'Confirm and view estimate'}
                <ArrowRightIcon size={16} aria-hidden />
              </>
            )}
          </button>
        </div>

        <p className="m-0 mt-5 text-[12px] text-fg-muted leading-[1.6] text-center">
          You can revise these counts anytime in the <strong className="text-fg-default">Users</strong> section.
        </p>
      </div>
    </main>
  )
}
