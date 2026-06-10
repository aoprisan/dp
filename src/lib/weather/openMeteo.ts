import { getSetting, setSetting } from '$lib/db/repo';

export interface GeoResult {
  name: string;
  country?: string;
  admin1?: string;
  lat: number;
  lon: number;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  tMax: number;
  tMin: number;
  precipProb: number;
  code: number; // WMO weather code
}

export interface Forecast {
  fetchedAt: number;
  lat: number;
  lon: number;
  days: DayForecast[];
}

export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const json = await res.json();
  return (json.results ?? []).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    country: r.country as string | undefined,
    admin1: r.admin1 as string | undefined,
    lat: r.latitude as number,
    lon: r.longitude as number,
  }));
}

const CACHE_KEY = 'forecastCache';

/** Fetch up to 16 forecast days; falls back to the Dexie cache offline (§1).
 * The service worker also runtime-caches the network layer. */
export async function getForecast(lat: number, lon: number, days = 7): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=auto&forecast_days=${Math.min(days, 16)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`forecast failed (${res.status})`);
    const json = await res.json();
    const d = json.daily;
    const forecast: Forecast = {
      fetchedAt: Date.now(),
      lat,
      lon,
      days: (d.time as string[]).map((date, i) => ({
        date,
        tMax: d.temperature_2m_max[i],
        tMin: d.temperature_2m_min[i],
        precipProb: d.precipitation_probability_max?.[i] ?? 0,
        code: d.weather_code[i],
      })),
    };
    await setSetting(CACHE_KEY, forecast);
    return forecast;
  } catch (e) {
    const cached = await getSetting<Forecast>(CACHE_KEY);
    if (cached && Math.abs(cached.lat - lat) < 0.25 && Math.abs(cached.lon - lon) < 0.25) return cached;
    throw e;
  }
}

export async function cachedForecast(): Promise<Forecast | undefined> {
  return getSetting<Forecast>(CACHE_KEY);
}

export function wmoLabel(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly cloudy';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorm';
}

export type WeatherGlyph = 'sun' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export function wmoGlyph(code: number): WeatherGlyph {
  if (code <= 1) return 'sun';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}
