const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question:
      'Why do I see two rows with one Premium Request to the same model that cost different amounts of AI Credits?',
    answer:
      'Not every request is the same. Saying "Hi" or "Thank you" to Claude Opus 4.6 costs 3 PRUs but consumes very few tokens (AI Credits) — that\'s a waste. At the same time, a complex and detailed plan implementation can run for a long time and consume a lot of AI Credits. Usage-based billing reflects the actual work done, so short trivial exchanges become cheaper while long, intensive tasks are billed by what they truly consume.',
  },
  {
    question: 'Why does the AIC net cost stay near zero for most of the month and then spike at the end?',
    answer:
      'Under usage-based billing, every licensed user contributes their monthly included AICs to a shared account-wide pool — 3,000 AICs for Copilot Business users and 7,000 AICs for Copilot Enterprise users. All usage is drawn from this pool first, so the net cost stays $0.00 until the entire pool is consumed. Once the pool runs out, additional usage is billed at $0.01 per AIC — that is when the line climbs steeply. ' +
      'PRU billing works differently: each user has their own individual discount allocation. Once a user exhausts their personal PRU allowance their further usage is billed at full rate, while other users who have not yet hit their limit still enjoy discounts. This means some users may run out of discounted PRUs while others have unused allowances that go to waste — exactly the inefficiency that pooled included credits are designed to eliminate.',
  },
  {
    question: 'With the pooled model, can one user consume all AI Credits in the pool?',
    answer:
      'Yes, in theory they can. However, user-level and product budgets allow you to control cost and prevent unexpected consumption by any single user.',
  },
  {
    question: "Does this mean that with the new model we can't predict our total cost?",
    answer:
      'No — it is possible to set an account-level budget that caps your total spend. Once the budget is reached, additional usage is blocked, giving you full predictability over costs.',
  },
  {
    question: 'Can we optimize spending?',
    answer:
      'Yes. Use account, product, and user budgets to cap spend, and review per-user and per-model usage to see where AI Credits are concentrated. That makes it easier to spot unusually expensive workloads and tune usage before additional spend grows.',
  },
  {
    question:
      'I have more Copilot licenses in my organization than the number of users in this report. Why?',
    answer:
      'This is expected. Users with no activity during the billing period are not captured by this report, as there are no Premium Requests or AI Credits to report on. You can adjust the numbers in the "Users" section to correctly estimate the included AI Credits pool size.',
  },
  {
    question: 'What is Copilot Cloud Agent? Is it the same as Copilot Coding Agent?',
    answer:
      'Yes. Copilot Coding Agent has been rebranded to Copilot Cloud Agent. If your CSV report shows models with "coding agent" in the name, they correspond to the Copilot Cloud Agent product. The functionality is identical.',
  },
]

export function FaqView() {
  return (
    <section className="max-w-[960px]">
      <h2 className="text-lg font-semibold text-fg-default mb-6">Frequently Asked Questions</h2>

      <dl className="flex flex-col gap-4 m-0 p-0">
        {FAQ_ITEMS.map(({ question, answer }, i) => (
          <div key={i} className="bg-bg-default border border-border-default rounded-lg px-6 py-5">
            <dt className="text-base font-semibold text-fg-default mb-3">{question}</dt>
            <dd className="text-sm text-fg-muted leading-relaxed m-0">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
