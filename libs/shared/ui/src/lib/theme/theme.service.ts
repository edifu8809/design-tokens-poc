import { Injectable, signal } from '@angular/core';

export type Brand = 'mr' | 'cuscatlan' | 'gennius';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'design-tokens-poc:theme';

// Which `:root[data-brand][data-theme]` blocks actually exist in dist/css/tokens.css for
// each brand (see BRANDS in build.js) — "gennius" only ships a `semantic.light.json`
// (the Figma export it's synced from has no dark-mode variables yet), so switching to it
// while "dark" is active must fall back to a mode it actually has CSS for.
export const BRAND_MODES: Record<Brand, ThemeMode[]> = {
  mr: ['light', 'dark'],
  cuscatlan: ['light', 'dark'],
  gennius: ['light'],
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly brand = signal<Brand>('mr');
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    const stored = this.readStoredPreference();
    this.setBrand(stored.brand);
    this.setMode(stored.mode);
  }

  setBrand(brand: Brand): void {
    this.apply(brand, this.mode());
  }

  setMode(mode: ThemeMode): void {
    this.apply(this.brand(), mode);
  }

  toggleMode(): void {
    this.setMode(this.mode() === 'light' ? 'dark' : 'light');
  }

  private apply(brand: Brand, mode: ThemeMode): void {
    // Clamp to a mode the brand actually ships CSS for (see BRAND_MODES) — e.g. picking
    // "gennius" while "dark" was active falls back to "light" instead of leaving every
    // --color-* custom property unresolved.
    const supportedModes = BRAND_MODES[brand];
    const resolvedMode = supportedModes.includes(mode) ? mode : supportedModes[0];

    this.brand.set(brand);
    this.mode.set(resolvedMode);

    const root = document.documentElement;
    root.setAttribute('data-brand', brand);
    root.setAttribute('data-theme', resolvedMode);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ brand, mode: resolvedMode }));
    } catch {
      // localStorage can be unavailable (private mode, SSR) — theme still applies for this session.
    }
  }

  private readStoredPreference(): { brand: Brand; mode: ThemeMode } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fall through to defaults
    }

    return { brand: 'mr', mode: 'light' };
  }
}
