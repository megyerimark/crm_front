import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

/** "Check your inbox" page shown until the e-mail address is confirmed. */
@Component({
  selector: 'app-verify-email-page',
  imports: [AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <app-empty-state illustration="leads" [title]="'security.verifyTitle' | t" [text]="'security.verifyText' | t: { email: auth.user()?.email }" />
      @if (notice()) { <div class="banner info mb">{{ notice() }}</div> }
      <div class="stack">
        <button class="btn primary block" (click)="check()" [disabled]="busy()">{{ 'security.verifyDone' | t }}</button>
        <button class="btn block" (click)="resend()" [disabled]="busy()">{{ 'security.verifyResend' | t }}</button>
        <button class="btn ghost block" (click)="auth.logout()">{{ 'common.logout' | t }}</button>
      </div>
    </app-auth-layout>
  `,
})
export class VerifyEmailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly notice = signal('');

  resend(): void {
    this.busy.set(true);
    this.api.post('auth/email/resend').subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(this.i18n.t('security.verifyResent'));
      },
      error: () => this.busy.set(false),
    });
  }

  check(): void {
    this.busy.set(true);
    this.auth.loadMe().subscribe({
      next: () => {
        this.busy.set(false);
        if (this.auth.isVerified()) {
          void this.router.navigateByUrl('/');
        } else {
          this.notice.set(this.i18n.t('security.verifyNotYet'));
        }
      },
      error: () => this.busy.set(false),
    });
  }
}
