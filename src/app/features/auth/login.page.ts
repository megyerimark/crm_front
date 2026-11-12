import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { fieldErrors } from '../../core/interceptors';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @if (challenge()) {
        <h1>{{ 'security.twoFactorTitle' | t }}</h1>
        <p class="muted mt-sm mb">{{ (useRecovery() ? 'security.recoveryCode' : 'security.twoFactorText') | t }}</p>
        <form class="stack" (ngSubmit)="submitCode()">
          @if (useRecovery()) {
            <div class="field">
              <label for="recovery">{{ 'security.recoveryCode' | t }}</label>
              <input id="recovery" class="input" name="recovery" autocomplete="off" [(ngModel)]="recoveryCode" placeholder="xxxxx-xxxxx" />
            </div>
          } @else {
            <div class="field">
              <label for="otp">{{ 'security.code' | t }}</label>
              <input id="otp" class="input" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="code" placeholder="123456" style="font-size:22px;letter-spacing:.3em;text-align:center;height:52px" />
            </div>
          }
          @if (codeError()) { <span class="error-text">{{ codeError() }}</span> }
          <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'security.verify' | t }}</button>
          <button class="btn ghost block" type="button" (click)="useRecovery.set(!useRecovery())">{{ (useRecovery() ? 'security.useApp' : 'security.useRecovery') | t }}</button>
          <button class="btn ghost block" type="button" (click)="challenge.set(null)">{{ 'security.backToLogin' | t }}</button>
        </form>
      } @else {
      <h1>{{ 'auth.welcome' | t }}</h1>
      <p class="muted mt-sm mb">{{ 'auth.welcomeSub' | t }}</p>
      <form class="stack" (ngSubmit)="submit()">
        <div class="field">
          <label for="email">{{ 'auth.email' | t }}</label>
          <input id="email" class="input" type="email" name="email" autocomplete="email" [(ngModel)]="email" required [class.invalid]="errors()['email']" />
          @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
        </div>
        <div class="field">
          <label for="password">{{ 'auth.password' | t }}</label>
          <input id="password" class="input" type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />
        </div>
        <div class="row end"><a routerLink="/forgot-password" class="small">{{ 'security.forgot' | t }}</a></div>
        <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'auth.login' | t }}</button>
      </form>
      }
      <p class="mt center muted">{{ 'auth.noAccount' | t }} <a [routerLink]="['/register']" [queryParams]="{ redirect: redirect() }">{{ 'auth.register' | t }}</a></p>
    </app-auth-layout>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly redirect = input<string>();

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly challenge = signal<string | null>(null);
  protected readonly useRecovery = signal(false);
  protected readonly codeError = signal('');
  protected code = '';
  protected recoveryCode = '';

  submit(): void {
    this.busy.set(true);
    this.errors.set({});
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        if ('token' in res) {
          void this.router.navigateByUrl(this.redirect() || '/');
        } else {
          this.busy.set(false);
          this.challenge.set(res.challenge);
        }
      },
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }

  submitCode(): void {
    const challenge = this.challenge();
    if (!challenge) return;
    this.busy.set(true);
    this.codeError.set('');
    this.auth.completeTwoFactor(challenge, this.useRecovery() ? null : this.code, this.useRecovery() ? this.recoveryCode : null).subscribe({
      next: () => void this.router.navigateByUrl(this.redirect() || '/'),
      error: (err) => {
        this.busy.set(false);
        const errors = fieldErrors(err);
        if (errors['challenge']) {
          this.challenge.set(null);
          this.errors.set({ email: errors['challenge'] });
        } else {
          this.codeError.set(Object.values(errors)[0] ?? '');
        }
      },
    });
  }
}
