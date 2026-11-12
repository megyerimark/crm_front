import { Injectable, signal } from '@angular/core';
import { Theme } from './models';
import { storage } from './storage';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>((storage.get('uf.theme') as Theme) || 'system');
  private readonly media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  constructor() {
    this.apply();
    this.media?.addEventListener('change', () => this.apply());
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    storage.set('uf.theme', theme);
    this.apply();
  }

  isDark(): boolean {
    const theme = this.theme();
    return theme === 'dark' || (theme === 'system' && !!this.media?.matches);
  }

  toggle(): Theme {
    const next: Theme = this.isDark() ? 'light' : 'dark';
    this.set(next);
    return next;
  }

  private apply(): void {
    document.documentElement.dataset['theme'] = this.isDark() ? 'dark' : 'light';
  }
}
