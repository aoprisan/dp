import { headerBlock, serializeItems, filteredItems, type PromptTemplate } from '../serializer';

export const stylist: PromptTemplate = {
  id: 'stylist',
  title: 'Plan my week',
  blurb: 'Outfits for the days ahead, matched to the forecast',
  build(ctx) {
    const dates = ctx.dates?.length
      ? ctx.dates
      : (ctx.forecast?.days.slice(0, 7) ?? []).map((d): { date: string; planned?: string } => ({
          date: d.date,
        }));
    const dateList = dates
      .map((d) => `- ${d.date}${d.planned ? ` (already planned: ${d.planned})` : ''}`)
      .join('\n');
    return `You are my personal stylist. Below is my real closet — every item I own, with a stable #id per line — plus my local weather.

${headerBlock({ location: ctx.location, forecast: ctx.forecast, closetSize: ctx.snap.items.filter((i) => !i.archived).length })}

MY CLOSET
${serializeItems(ctx.snap, filteredItems(ctx))}

TASK
Plan outfits for these dates:
${dateList}

Use only listed items and reference them by #id. Respect the forecast (warmth 1=lightest, 5=warmest). Prefer under-worn pieces when it doesn't hurt the outfit. Skip dates that are already planned.

ANSWER FORMAT (exactly):
For each date, one block:
2026-06-11 — [weather one-liner]
Outfit: #id Item, #id Item, #id Item
Why: one line.

End with "Repeats:" listing any item used twice, or "none".`;
  },
};
