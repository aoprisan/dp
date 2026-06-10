import { headerBlock, serializeItems, filteredItems, type PromptTemplate } from '../serializer';

export const shopping: PromptTemplate = {
  id: 'shopping',
  title: 'Should I buy this?',
  blurb: 'Check a candidate against everything you own',
  build(ctx) {
    return `You are my anti-impulse shopping advisor. Below is my real closet (stable #id per line) and one thing I'm considering buying.

${headerBlock({ location: ctx.location, closetSize: ctx.snap.items.filter((i) => !i.archived).length })}

MY CLOSET
${serializeItems(ctx.snap, filteredItems(ctx))}

CANDIDATE
${ctx.candidate?.trim() || '(describe the item, price, and where you would wear it)'}

TASK
Tell me honestly whether to buy it, judged against what I already own.

ANSWER FORMAT (exactly):
VERDICT: BUY / SKIP / ONLY IF — one sentence.
PAIRS WITH
- #id Item — the outfit it makes, one line each (at least 3 or say there aren't 3)
ALREADY SIMILAR
- #id Item — how close it is, or "nothing similar"
COST LOGIC
One line: price vs likely wears vs my average cost-per-wear.`;
  },
};
