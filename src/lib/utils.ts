import type { Privacy } from './types';

export const PRIVACY_MARK: Record<Privacy, string> = {
  public: '○',
  followers: '◐',
  private: '●',
};

export const PRIVACY_NAME: Record<Privacy, string> = {
  public: 'Public',
  followers: 'Circle',
  private: 'Private',
};

export const fmtNo = (n: number): string => 'Nº ' + String(n).padStart(3, '0');
export const fmtCount = (n: number): string => String(n).padStart(3, '0');
export const fmtDate = (ts: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ts);
