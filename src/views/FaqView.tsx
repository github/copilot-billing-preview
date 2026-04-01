const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question:
      'Why do I see two rows with one Premium Request to the same model that cost different amounts of AI Credits?',
    answer:
      'Not every request is the same. Saying "Hi" or "Thank you" to Claude Opus 4.6 costs 3 PRUs but consumes very few tokens (AI Credits) — that\'s a waste. At the same time, a complex and detailed plan implementation can run for a long time and consume a lot of AI Credits. AI Credits-based billing reflects the actual work done, so short trivial exchanges become cheaper while long, intensive tasks are billed by what they truly consume.',
  },
  {
    question: 'Why does the AIC net cost stay near zero for most of the month and then spike at the end?',
    answer:
      'Under AI Credits-based billing, every licensed user contributes their monthly included AICs to a shared organization-wide pool — 3,000 AICs for Copilot Business users and 7,000 AICs for Copilot Enterprise users. All usage is drawn from this pool first, so the net cost stays $0.00 until the entire pool is consumed. Once the pool runs out, additional usage is billed at $0.01 per AIC — that is when the line climbs steeply. ' +
      'PRU billing works differently: each user has their own individual discount allocation. Once a user exhausts their personal PRU allowance their further usage is billed at full rate, while other users who have not yet hit their limit still enjoy discounts. This means some users may run out of discounted PRUs while others have unused allowances that go to waste — exactly the inefficiency that pooled AIC entitlements are designed to eliminate.',
  },
  {
    question: 'With the pooled model, can one user consume all AI Credits in the pool?',
    answer:
      'Yes, in theory they can. However, user-level and product budgets allow you to control cost and prevent unexpected consumption by any single user.',
  },
  {
    question: 'Does it mean with the new model we cannot predict how much cost we will end up with?',
    answer:
      'No — it is possible to set an account-level budget that caps your total spend. Once the budget is reached, additional usage is blocked, giving you full predictability over costs.',
  },
  {
    question: 'Can we optimize spending?',
    answer:
      'Yes. When your users consistently spend more than their included entitlements, consider upgrading them to a higher tier (Copilot Enterprise plan). Enterprise users receive 7,000 AICs per month instead of 3,000, which can be more cost-effective than paying for overages at $0.01 per AIC.',
  },
]

export function FaqView() {
  return (
    <section className="faq">
      <h2 className="faq__heading">Frequently Asked Questions</h2>

      <dl className="faq__list">
        {FAQ_ITEMS.map(({ question, answer }, i) => (
          <div key={i} className="faq__item">
            <dt className="faq__question">{question}</dt>
            <dd className="faq__answer">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
