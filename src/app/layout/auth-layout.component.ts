import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { I18nService, LOCALES } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/theme.service';
import { LogoComponent } from '../shared/logo.component';
import { WorkflowIllustrationComponent } from '../shared/workflow-illustration.component';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-auth-layout',
  imports: [LogoComponent, WorkflowIllustrationComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: 100vh; }
    .brand-panel { background: radial-gradient(900px 600px at 15% 0%, #1b6e60 0, #0c2a25 50%, #06120f 100%); color: #d5e7e1; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .brand-panel h1 { font-size: 40px; color: #fff; max-width: 480px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 800; }
    .illu { max-width: 440px; margin: 28px 0 6px; }
    .brand-panel { position: relative; overflow: hidden; }
    .brand-panel::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 44px 44px; pointer-events: none; }
    .brand-panel > * { position: relative; z-index: 1; }
    .brand-panel ul { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-direction: column; gap: 14px; }
    .brand-panel li { display: flex; gap: 10px; align-items: center; }
    .brand-panel li app-icon { color: #7fe0c6; }
    .brand-panel h1 em { font-style: normal; color: var(--accent); }
    .form-panel { display: flex; flex-direction: column; padding: 24px; background: var(--surface); }
    .form-inner { width: 100%; max-width: 420px; margin: auto; padding: 24px 0; }
    .tools { display: flex; justify-content: flex-end; gap: 6px; }
    .mobile-logo { display: none; margin-bottom: 28px; }
    @media (max-width: 900px) { :host { grid-template-columns: 1fr; } .brand-panel { display: none; } .mobile-logo { display: block; } }
  `],
  template: `
    <section class="brand-panel">
      <app-logo [size]="36" [inverse]="true" />
      <div>
        <h1>{{ 'app.tagline' | t }}</h1>
        <app-workflow-illustration class="illu" />
        <ul>
          <li><app-icon name="check" /> {{ 'auth.benefits1' | t }}</li>
          <li><app-icon name="check" /> {{ 'auth.benefits2' | t }}</li>
          <li><app-icon name="check" /> {{ 'auth.benefits3' | t }}</li>
        </ul>
      </div>
      <small style="opacity:.65">{{ 'app.poweredBy' | t }}</small>
    </section>
    <section class="form-panel">
      <div class="tools">
        @for (l of locales; track l.code) {
          <button class="btn ghost sm" [class.primary]="i18n.locale() === l.code" (click)="i18n.use(l.code)">{{ l.code.toUpperCase() }}</button>
        }
        <button class="btn ghost sm icon" (click)="theme.toggle()" aria-label="Theme"><app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="16" /></button>
      </div>
      <div class="form-inner">
        <div class="mobile-logo"><app-logo [size]="34" /></div>
        <ng-content />
      </div>
    </section>
  `,
})
export class AuthLayoutComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly locales = LOCALES;
  protected readonly appName = environment.appName;
}
