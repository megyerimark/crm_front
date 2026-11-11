import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { Workspace } from '../../core/models';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-onboarding-page',
  imports: [FormsModule, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <h1>{{ 'auth.onboardingTitle' | t }}</h1>
      <p class="muted mt-sm mb">{{ 'auth.onboardingText' | t }}</p>
      <div class="banner gold mb"><app-icon name="star" [size]="16" /> {{ 'auth.trial' | t }}</div>
      <form class="stack" (ngSubmit)="submit()">
        <div class="field">
          <label for="ws">{{ 'auth.workspaceName' | t }}</label>
          <input id="ws" class="input" name="name" [(ngModel)]="name" required />
          @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
        </div>
        <div class="grid grid-2">
          <div class="field">
            <label for="currency">{{ 'settings.currency' | t }}</label>
            <select id="currency" class="select" name="currency" [(ngModel)]="currency">
              <option value="HUF">HUF</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="CHF">CHF</option>
            </select>
          </div>
          <div class="field">
            <label for="country">{{ 'settings.country' | t }}</label>
            <select id="country" class="select" name="country" [(ngModel)]="country">
              <option value="HU">Magyarország</option><option value="AT">Österreich</option><option value="DE">Deutschland</option><option value="SK">Slovensko</option><option value="RO">România</option>
            </select>
          </div>
        </div>
        <div class="row">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ 'common.create' | t }}</button>
          @if (auth.workspaces().length) { <button class="btn" type="button" (click)="router.navigateByUrl('/')">{{ 'common.cancel' | t }}</button> }
          <span class="spacer"></span>
          <button class="btn ghost" type="button" (click)="auth.logout()">{{ 'common.logout' | t }}</button>
        </div>
      </form>
    </app-auth-layout>
  `,
})
export class OnboardingPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected name = '';
  protected currency = 'HUF';
  protected country = 'HU';
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  submit(): void {
    this.busy.set(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.api.post<{ data: Workspace }>('workspaces', { name: this.name, currency: this.currency, country: this.country, timezone, locale: this.i18n.locale() }).subscribe({
      next: (res) => {
        this.auth.setWorkspace(res.data.id);
        this.auth.loadMe().subscribe(() => void this.router.navigateByUrl('/'));
      },
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }
}
