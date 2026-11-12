import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { timezoneList, UI, saveBlob } from '../../shared/ui';

interface TwoFactorSetup {
  secret: string;
  otpauth_url: string;
  qr_svg: string;
}

/**
 * Profile, e-mail change, password, two-factor authentication, notification preferences and GDPR tools.
 */
@Component({
  selector: 'app-profile-section',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .qr { background: #fff; border-radius: 12px; padding: 10px; display: inline-flex; border: 1px solid var(--border); }
    .qr ::ng-deep svg { width: 190px; height: 190px; }
    .secret { font-family: ui-monospace, monospace; font-size: 15px; letter-spacing: .08em; background: var(--surface-3); padding: 8px 12px; border-radius: 8px; word-break: break-all; }
    .codes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-family: ui-monospace, monospace; font-size: 15px; }
    .codes span { background: var(--surface-3); padding: 8px 10px; border-radius: 8px; text-align: center; }
    .toggle { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
    .toggle:last-of-type { border-bottom: 0; }
    .switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .switch span { position: absolute; inset: 0; background: var(--border-strong); border-radius: 999px; transition: background .2s; }
    .switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s var(--ease); box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .switch input:checked + span { background: var(--primary); }
    .switch input:checked + span::after { transform: translateX(18px); }
    .switch input:focus-visible + span { box-shadow: var(--focus); }
    .danger-zone { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); }
  `],
  template: `
    @if (auth.user(); as u) {
    <div class="grid grid-2">
      <!-- Personal details -->
      <div class="card">
        <div class="card-header"><h3>{{ 'security.sections.profile' | t }}</h3></div>
        <form class="card-body stack" (ngSubmit)="saveProfile()">
          <div class="field"><label>{{ 'common.name' | t }}</label><input class="input" name="name" [(ngModel)]="form.name" /></div>
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

      <!-- E-mail -->
      <div class="card">
        <div class="card-header"><h3>{{ 'security.sections.email' | t }}</h3></div>
        <form class="card-body stack" (ngSubmit)="changeEmail()">
          <div class="field"><label>{{ 'security.emailCurrent' | t }}</label><div class="row"><strong>{{ u.email }}</strong> <span class="badge success">✓</span></div></div>
          @if (u.pending_email) {
            <div class="banner info">{{ 'security.emailPending' | t: { email: u.pending_email } }} <button class="btn ghost sm" type="button" (click)="cancelEmailChange()">{{ 'security.emailPendingCancel' | t }}</button></div>
          }
          <div class="field">
            <label>{{ 'security.emailNew' | t }}</label><input class="input" type="email" name="new_email" autocomplete="email" [(ngModel)]="emailForm.email" />
            @if (emailErrors()['email']) { <span class="error-text">{{ emailErrors()['email'] }}</span> }
          </div>
          <div class="field">
            <label>{{ 'security.confirmPassword' | t }}</label><input class="input" type="password" name="email_password" autocomplete="current-password" [(ngModel)]="emailForm.password" />
            @if (emailErrors()['password']) { <span class="error-text">{{ emailErrors()['password'] }}</span> }
          </div>
          <div class="row end"><button class="btn" type="submit" [disabled]="!emailForm.email || !emailForm.password">{{ 'security.emailChange' | t }}</button></div>
        </form>
      </div>

      <!-- Password -->
      <div class="card">
        <div class="card-header"><h3>{{ 'security.sections.password' | t }}</h3></div>
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

      <!-- Two-factor -->
      <div class="card">
        <div class="card-header">
          <h3>{{ 'security.sections.twoFactor' | t }}</h3>
          <span class="badge" [class.success]="u.two_factor_enabled">{{ u.two_factor_enabled ? '✓ ON' : 'OFF' }}</span>
        </div>
        <div class="card-body stack">
          @if (setup(); as s) {
            <p>{{ 'security.twoFactorScan' | t }}</p>
            <div><span class="qr" [innerHTML]="qr()"></span></div>
            <span class="hint">{{ 'security.twoFactorManual' | t }}</span>
            <span class="secret">{{ s.secret }}</span>
            <p>{{ 'security.twoFactorConfirmStep' | t }}</p>
            <form class="row" (ngSubmit)="confirmTwoFactor()">
              <input class="input" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="otp" placeholder="123456" style="max-width:160px;letter-spacing:.25em;text-align:center" />
              <button class="btn primary" type="submit" [disabled]="otp.length < 6">{{ 'security.twoFactorActivate' | t }}</button>
              <button class="btn ghost" type="button" (click)="setup.set(null)">{{ 'common.cancel' | t }}</button>
            </form>
            @if (twoFactorError()) { <span class="error-text">{{ twoFactorError() }}</span> }
          } @else {
            <p class="muted">{{ (u.two_factor_enabled ? 'security.twoFactorOn' : 'security.twoFactorOff') | t }}</p>
            @if (u.two_factor_enabled) { <span class="subtle">{{ 'security.recoveryLeft' | t: { count: u.two_factor_recovery_codes_left } }}</span> }
            <div class="field">
              <label>{{ 'security.confirmPassword' | t }}</label>
              <input class="input" type="password" name="tf_password" autocomplete="current-password" [(ngModel)]="twoFactorPassword" />
            </div>
            @if (twoFactorError()) { <span class="error-text">{{ twoFactorError() }}</span> }
            <div class="row wrap end">
              @if (u.two_factor_enabled) {
                <button class="btn" (click)="regenerateCodes()" [disabled]="!twoFactorPassword">{{ 'security.recoveryNew' | t }}</button>
                <button class="btn danger" (click)="disableTwoFactor()" [disabled]="!twoFactorPassword">{{ 'security.twoFactorDisable' | t }}</button>
              } @else {
                <button class="btn primary" (click)="startTwoFactor()" [disabled]="!twoFactorPassword"><app-icon name="shield" [size]="16" /> {{ 'security.twoFactorEnable' | t }}</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-header"><h3>{{ 'security.sections.notifications' | t }}</h3></div>
        <div class="card-body">
          @for (pref of prefs; track pref.key) {
            <label class="toggle">
              <span class="switch"><input type="checkbox" [checked]="u[pref.key]" (change)="savePreference(pref.key, $any($event.target).checked)" /><span></span></span>
              <span>{{ pref.label | t }}</span>
            </label>
          }
          @if (!auth.feature('email_reminders')) { <div class="banner gold mt">{{ 'security.notifyPlan' | t }}</div> }
        </div>
      </div>

      <!-- Data & account -->
      <div class="card danger-zone">
        <div class="card-header"><h3>{{ 'security.sections.data' | t }}</h3></div>
        <div class="card-body stack">
          <h3>{{ 'security.exportTitle' | t }}</h3>
          <p class="muted">{{ 'security.exportText' | t }}</p>
          <div><button class="btn" (click)="exportData()"><app-icon name="download" [size]="16" /> {{ 'security.exportButton' | t }}</button></div>
          <hr />
          <h3 style="color:var(--danger)">{{ 'security.deleteTitle' | t }}</h3>
          <p class="muted">{{ 'security.deleteText' | t }}</p>
          <p class="hint">{{ 'security.deleteTeamHint' | t }}</p>
          <div class="field"><label>{{ 'security.confirmPassword' | t }}</label><input class="input" type="password" name="del_password" autocomplete="current-password" [(ngModel)]="deleteForm.password" /></div>
          <div class="field">
            <label>{{ 'security.deleteConfirm' | t: { word: ('security.deleteWord' | t) } }}</label>
            <input class="input" name="del_confirm" autocomplete="off" [(ngModel)]="deleteForm.confirmation" />
          </div>
          @for (e of deleteErrors(); track e) { <span class="error-text">{{ e }}</span> }
          <div class="row end">
            <button class="btn danger" (click)="deleteAccount()" [disabled]="!deleteForm.password || deleteForm.confirmation.trim().toUpperCase() !== ('security.deleteWord' | t)">{{ 'security.deleteButton' | t }}</button>
          </div>
        </div>
      </div>
    </div>
    }

    @if (recoveryCodes(); as codes) {
      <app-modal [title]="'security.recoveryTitle' | t" (closed)="recoveryCodes.set(null)">
        <p class="muted mb">{{ 'security.recoveryText' | t }}</p>
        <div class="codes">@for (c of codes; track c) { <span>{{ c }}</span> }</div>
        <div footer class="modal-footer">
          <button class="btn" (click)="copyCodes(codes)"><app-icon name="copy" [size]="15" /> {{ 'common.copy' | t }}</button>
          <button class="btn" (click)="downloadCodes(codes)"><app-icon name="download" [size]="15" /> {{ 'security.download' | t }}</button>
          <button class="btn primary" (click)="recoveryCodes.set(null)">{{ 'security.done' | t }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class ProfileSection {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly auth = inject(AuthService);

  protected readonly locales = LOCALES;
  protected readonly themes = ['light', 'dark', 'system'] as const;
  protected readonly timezones = timezoneList(this.auth.user()?.timezone);
  protected readonly prefs: { key: 'notify_task_reminders' | 'notify_daily_digest' | 'notify_new_leads'; label: string }[] = [
    { key: 'notify_task_reminders', label: 'security.notifyReminders' },
    { key: 'notify_daily_digest', label: 'security.notifyDigest' },
    { key: 'notify_new_leads', label: 'security.notifyLeads' },
  ];

  protected form: Partial<User> = { ...this.auth.user() };
  protected emailForm = { email: '', password: '' };
  protected password = { current_password: '', password: '', password_confirmation: '' };
  protected deleteForm = { password: '', confirmation: '' };
  protected twoFactorPassword = '';
  protected otp = '';

  protected readonly emailErrors = signal<Record<string, string>>({});
  protected readonly pwErrors = signal<Record<string, string>>({});
  protected readonly deleteErrors = signal<string[]>([]);
  protected readonly twoFactorError = signal('');
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly qr = signal<SafeHtml>('');
  protected readonly recoveryCodes = signal<string[] | null>(null);

  saveProfile(): void {
    const { name, locale, theme, timezone } = this.form;
    this.api.patch<{ user: User }>('auth/profile', { name, locale, theme, timezone }).subscribe((res) => {
      this.auth.updateUser(res.user);
      this.toast.success(this.i18n.t('common.saved'));
    });
  }

  savePreference(key: string, value: boolean): void {
    this.api.patch<{ user: User }>('auth/profile', { [key]: value }).subscribe((res) => {
      this.auth.user.set(res.user);
      this.toast.success(this.i18n.t('common.saved'));
    });
  }

  changeEmail(): void {
    this.emailErrors.set({});
    this.api.post<{ user: User }>('auth/email-change', this.emailForm).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.emailForm = { email: '', password: '' };
        this.toast.success(this.i18n.t('security.emailSent'));
      },
      error: (err) => this.emailErrors.set(fieldErrors(err)),
    });
  }

  cancelEmailChange(): void {
    this.api.delete<{ user: User }>('auth/email-change').subscribe((res) => this.auth.user.set(res.user));
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

  startTwoFactor(): void {
    this.twoFactorError.set('');
    this.api.post<TwoFactorSetup>('auth/two-factor/setup', { password: this.twoFactorPassword }).subscribe({
      next: (res) => {
        /* Server-generated SVG QR code. */
        this.qr.set(this.sanitizer.bypassSecurityTrustHtml(res.qr_svg));
        this.setup.set(res);
        this.otp = '';
      },
      error: (err) => this.twoFactorError.set(Object.values(fieldErrors(err))[0] ?? ''),
    });
  }

  confirmTwoFactor(): void {
    this.twoFactorError.set('');
    this.api.post<{ recovery_codes: string[]; user: User }>('auth/two-factor/confirm', { code: this.otp }).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.setup.set(null);
        this.twoFactorPassword = '';
        this.recoveryCodes.set(res.recovery_codes);
      },
      error: (err) => this.twoFactorError.set(Object.values(fieldErrors(err))[0] ?? ''),
    });
  }

  regenerateCodes(): void {
    this.api.post<{ recovery_codes: string[] }>('auth/two-factor/recovery-codes', { password: this.twoFactorPassword }).subscribe({
      next: (res) => {
        this.twoFactorPassword = '';
        this.recoveryCodes.set(res.recovery_codes);
        this.auth.loadMe().subscribe();
      },
      error: (err) => this.twoFactorError.set(Object.values(fieldErrors(err))[0] ?? ''),
    });
  }

  disableTwoFactor(): void {
    this.api.delete<{ user: User }>('auth/two-factor', { password: this.twoFactorPassword }).subscribe({
      next: (res) => {
        this.auth.user.set(res.user);
        this.twoFactorPassword = '';
        this.twoFactorError.set('');
      },
      error: (err) => this.twoFactorError.set(Object.values(fieldErrors(err))[0] ?? ''),
    });
  }

  copyCodes(codes: string[]): void {
    void navigator.clipboard?.writeText(codes.join('\n')).then(() => this.toast.success(this.i18n.t('security.copied')));
  }

  downloadCodes(codes: string[]): void {
    saveBlob(new Blob([`VállalkozóOS – ${this.auth.user()?.email}\n\n${codes.join('\n')}\n`], { type: 'text/plain' }), 'vallalkozoos-recovery-codes.txt');
  }

  exportData(): void {
    this.api.download('auth/account/export').subscribe((blob) => saveBlob(blob, 'vallalkozoos-export.json'));
  }

  deleteAccount(): void {
    this.deleteErrors.set([]);
    this.api.delete('auth/account', this.deleteForm).subscribe({
      next: () => {
        this.auth.clear();
        this.toast.success(this.i18n.t('security.deleted'));
        void this.router.navigateByUrl('/welcome');
      },
      error: (err) => this.deleteErrors.set(Object.values(fieldErrors(err))),
    });
  }
}
