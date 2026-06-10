export type Theme = 'system' | 'light' | 'dark';

export interface SavedLocation {
  name: string;
  lat: number;
  lon: number;
}

export function resolveDark(theme: Theme): boolean {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return theme === 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', resolveDark(theme));
}
