import { forecastTable, headerBlock, serializeItems, filteredItems, type PromptTemplate } from '../serializer';

export const packing: PromptTemplate = {
  id: 'packing',
  title: 'Pack for a trip',
  blurb: 'A packing list built from what you actually own',
  build(ctx) {
    const trip = ctx.trip;
    const tripBlock = trip
      ? `TRIP
Destination: ${trip.place}
Dates: ${trip.start} → ${trip.end}${
          ctx.tripForecast?.length ? `\nDestination forecast:\n${forecastTable(ctx.tripForecast)}` : ''
        }`
      : 'TRIP\n(describe your destination and dates here)';
    return `You are my packing assistant. Below is my real closet — every item with a stable #id — and my trip.

${headerBlock({ location: ctx.location, closetSize: ctx.snap.items.filter((i) => !i.archived).length })}

${tripBlock}

MY CLOSET
${serializeItems(ctx.snap, filteredItems(ctx))}

TASK
Build a packing list for this trip. Use only listed items, reference them by #id. Cover the full date range and likely weather. Keep it minimal — prefer pieces that combine into several outfits.

ANSWER FORMAT (exactly):
ESSENTIAL
- #id Item — one-line reason
OPTIONAL
- #id Item — one-line reason
GAPS TO BUY
- thing I don't own that the trip needs, or "none"
OUTFIT MATH
- N tops × N bottoms → N outfit combinations, one line.`;
  },
};
