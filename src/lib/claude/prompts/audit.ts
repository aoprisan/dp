import { headerBlock, serializeItems, type PromptTemplate } from '../serializer';

export const audit: PromptTemplate = {
  id: 'audit',
  title: 'Audit my wardrobe',
  blurb: 'What to let go, what is missing, the capsule inside',
  build(ctx) {
    return `You are a ruthless but kind wardrobe consultant. Below is my full closet including archived pieces, with prices, wear counts and last-worn dates per line (#id is stable).

${headerBlock({ location: ctx.location, closetSize: ctx.snap.items.length })}

MY CLOSET (including ARCHIVED)
${serializeItems(ctx.snap, () => true)}

TASK
Audit it. Judge by wear history, cost-per-wear (price ÷ wears), redundancy and versatility — not by trend.

ANSWER FORMAT (exactly):
SELL / DONATE (5)
- #id Item — one-line why (use the wear data)
GAPS (3)
- missing piece — what it would unlock with items I own (#ids)
CAPSULE (20)
- #id Item, grouped under TOPS / BOTTOMS / DRESSES / OUTERWEAR / SHOES / EXTRAS
One closing sentence: the single best habit change for this wardrobe.`;
  },
};
