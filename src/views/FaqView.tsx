const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question:
      'Why do I see two rows with one Premium Request to the same model that cost different amounts of AI Credits?',
    answer:
      'Not every request is the same. Saying "Hi" or "Thank you" to Claude Opus 4.6 costs 3 PRUs but consumes very few tokens (AI Credits) — that\'s a waste. At the same time, a complex and detailed plan implementation can run for a long time and consume a lot of AI Credits. AI Credits-based billing reflects the actual work done, so short trivial exchanges become cheaper while long, intensive tasks are billed by what they truly consume.',
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
