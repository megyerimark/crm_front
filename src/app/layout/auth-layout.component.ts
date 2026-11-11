import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { I18nService, LOCALES } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/theme.service';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-auth-layout',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: 100vh; }
    .brand-panel { background: radial-gradient(circle at 20% 10%, #2b3f9e 0, #101a45 45%, #070b1c 100%); color: #dfe5ff; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .brand-panel h1 { font-size: 36px; color: #fff; max-width: 460px; line-height: 1.15; }
    .brand-panel ul { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-direction: column; gap: 14px; }
    .brand-panel li { display: flex; gap: 10px; align-items: center; }
    .brand-panel li app-icon { color: #f5c24c; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: #fff; }
    .logo-mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #3c5cff, #2236b8); display: flex; align-items: center; justify-content: center; }
    .form-panel { display: flex; flex-direction: column; padding: 24px; background: var(--surface); }
    .form-inner { width: 100%; max-width: 420px; margin: auto; padding: 24px 0; }
    .tools { display: flex; justify-content: flex-end; gap: 6px; }
    @media (max-width: 900px) { :host { grid-template-columns: 1fr; } .brand-panel { display: none; } }
  `],
  template: `
    <section class="brand-panel">
      <div class="logo"><div class="logo-mark"><app-icon name="zap" /></div> {{ appName }}</div>
      <div>
        <h1>{{ 'app.tagline' | t }}</h1>
        <ul>
          <li><app-icon name="check" /> {{ 'auth.benefits1' | t }}</li>
          <li><app-icon name="check" /> {{ 'auth.benefits2' | t }}</li>
          <li><app-icon name="check" /> {{ 'auth.benefits3' | t }}</li>
        </ul>
      </div>
      <small style="opacity:.6">{{ 'app.poweredBy' | t }}</small>
    </section>
    <section class="form-panel">
      <div class="tools">
        @for (l of locales; track l.code) {
          <button class="btn ghost sm" [class.primary]="i18n.locale() === l.code" (click)="i18n.use(l.code)">{{ l.code.toUpperCase() }}</button>
        }
        <button class="btn ghost sm icon" (click)="theme.toggle()" aria-label="Theme"><app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="16" /></button>
      </div>
      <div class="form-inner"><ng-content /></div>
    </section>
  `,
})
export class AuthLayoutComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly locales = LOCALES;
  protected readonly appName = environment.appName;
}
