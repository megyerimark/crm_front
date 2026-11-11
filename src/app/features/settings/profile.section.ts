import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { User } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-profile-section',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><h3>{{ 'settings.profile' | t }}</h3></div>
        <form class="card-body stack" (ngSubmit)="save()">
          <div class="field"><label>{{ 'common.name' | t }}</label><input class="input" name="name" [(ngModel)]="form.name" /></div>
          <div class="field">
            <label>{{ 'common.email' | t }}</label><input class="input" type="email" name="email" [(ngModel)]="form.email" />
            @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
          </div>
          <div class="field">
            <label>{{ 'common.language' | t }}</label>
            <select class="select" name="locale" [(ngModel)]="form.locale">@for (l of locales; track l.code) { <option [value]="l.code">{{ l.label }}</option> }</select>
          </div>
          <div class="field">
            <label>{{ 'common.theme' | t }}</label>
            <div class="segmented">
              @for (th of themes; track th) { <button type="button" [class.active]="form.theme === th" (click)="form.theme = th">{{ 'common.' + th | t }}</button> }
            </div>
          </div>
          <div class="field">
            <label>{{ 'settings.timezone' | t }}</label>
            <select class="select" name="timezone" [(ngModel)]="form.timezone">
              <option [ngValue]="null">{{ auth.workspace()?.timezone }} ({{ 'nav.workspace' | t }})</option>
              @for (tz of timezones; track tz) { <option [value]="tz">{{ tz }}</option> }
            </select>
          </div>
          <div class="row end"><button class="btn primary" type="submit">{{ 'common.save' | t }}</button></div>
        </form>
      </div>
      <div class="card">
        <div class="card-header"><h3>{{ 'settings.changePassword' | t }}</h3></div>
        <form class="card-body stack" (ngSubmit)="changePassword()">
          <div class="field">
            <label>{{ 'settings.currentPassword' | t }}</label><input class="input" type="password" name="current" autocomplete="current-password" [(ngModel)]="password.current_password" />
            @if (pwErrors()['current_password']) { <span class="error-text">{{ pwErrors()['current_password'] }}</span> }
          </div>
          <div class="field">
            <label>{{ 'settings.newPassword' | t }}</label><input class="input" type="password" name="password" autocomplete="new-password" [(ngModel)]="password.password" />
            @if (pwErrors()['password']) { <span class="error-text">{{ pwErrors()['password'] }}</span> }
          </div>
          <div class="field"><label>{{ 'auth.passwordConfirm' | t }}</label><input class="input" type="password" name="password2" autocomplete="new-password" [(ngModel)]="password.password_confirmation" /></div>
          <div class="row end"><button class="btn" type="submit">{{ 'settings.changePassword' | t }}</button></div>
        </form>
      </div>
    </div>
  `,
})
export class ProfileSection {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly locales = LOCALES;
  protected readonly themes = ['light', 'dark', 'system'] as const;
  protected readonly timezones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['Europe/Budapest', 'Europe/Vienna', 'Europe/Berlin', 'UTC'];
  protected form: Partial<User> = { ...this.auth.user() };
  protected password = { current_password: '', password: '', password_confirmation: '' };
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly pwErrors = signal<Record<string, string>>({});

  save(): void {
    const { name, email, locale, theme, timezone } = this.form;
    this.api.patch<{ user: User }>('auth/profile', { name, email, locale, theme, timezone }).subscribe({
      next: (res) => {
        this.auth.updateUser(res.user);
        this.errors.set({});
        this.toast.success(this.i18n.t('common.saved'));
      },
      error: (err) => this.errors.set(fieldErrors(err)),
    });
  }

  changePassword(): void {
    this.api.put('auth/password', this.password).subscribe({
      next: () => {
        this.password = { current_password: '', password: '', password_confirmation: '' };
        this.pwErrors.set({});
        this.toast.success(this.i18n.t('settings.passwordChanged'));
      },
      error: (err) => this.pwErrors.set(fieldErrors(err)),
    });
  }
}
