import { MarkGithubIcon } from '@primer/octicons-react'
import { appLinks } from '../config/links'

const linkClasses = 'text-fg-accent underline underline-offset-2 hover:no-underline'

export function SunsetPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 py-6 px-4 sm:pt-12 sm:px-6 sm:pb-8 bg-bg-muted">
      <div className="max-w-[760px] w-full bg-bg-default border border-border-default rounded-[16px] shadow-[0_8px_24px_rgba(31,35,40,0.08)] py-8 px-5 sm:py-12 sm:px-10">
        <MarkGithubIcon size={48} className="block mx-auto mb-4 text-fg-default" aria-hidden />
        <h1 className="m-0 mb-6 text-center text-[26px] sm:text-[32px] leading-[1.2] text-fg-default font-bold">
          Copilot Billing Preview has been retired
        </h1>
        <p className="mx-auto mb-6 max-w-[640px] text-fg-muted text-[15px] leading-[1.7]">
          We&apos;ve retired the GitHub Copilot Billing Preview app, and it&apos;s no longer available. You can review
          and manage your Copilot spend directly in your GitHub billing settings.
        </p>
        <p className="mx-auto mb-8 max-w-[640px] text-fg-muted text-[15px] leading-[1.7]">
          The app helped you understand your bill during the move to <strong>usage-based billing</strong>. Your billing
          settings now give you a more complete view that the app&apos;s underlying reports couldn&apos;t show,
          including user-level budgets, cost centers, and usage pool allocation.
        </p>
        <section className="mx-auto max-w-[640px] px-6 py-5 text-left border border-border-default rounded-lg bg-bg-muted">
          <h2 className="m-0 mb-3 text-[18px] text-fg-default font-bold">What to use instead</h2>
          <p className="m-0 mb-3 text-fg-muted text-[15px] leading-[1.7]">
            You can review and manage your Copilot spend in your billing settings:
          </p>
          <ul className="m-0 pl-5 list-disc text-fg-muted text-[15px] leading-[1.7] flex flex-col gap-2">
            <li>
              See your AI usage on the <strong>AI usage</strong> page in your{' '}
              <a className={linkClasses} href={appLinks.billingSettings} target="_blank" rel="noopener noreferrer">
                billing settings
              </a>
              , where you can group, filter, and export your AI credit data.
            </li>
            <li>
              Set{' '}
              <a className={linkClasses} href={appLinks.budgetsDocs} target="_blank" rel="noopener noreferrer">
                budgets
              </a>{' '}
              to cap your spend.
            </li>
            <li>
              If you&apos;re an organization or enterprise, user-level budgets help you control and track spend at an
              individual level.
            </li>
            <li>Pull raw usage data anytime from your usage reports and the billing API.</li>
          </ul>
          <p className="m-0 mt-4 text-fg-muted text-[15px] leading-[1.7]">
            To learn more, see{' '}
            <a className={linkClasses} href={appLinks.copilotBillingDocs} target="_blank" rel="noopener noreferrer">
              GitHub Copilot billing
            </a>
            .
          </p>
        </section>
      </div>
      <footer className="text-center text-fg-muted text-[12px] leading-[1.6] pt-6 px-4 pb-10 max-w-[960px] mx-auto w-full">
        GitHub billing remains the source of record for your Copilot spend.
      </footer>
    </main>
  )
}
