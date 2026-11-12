import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <h1>{{ 'auth.createAccount' | t }}</h1>
      <p class="muted mt-sm">{{ 'auth.createSub' | t }}</p>
      <div class="banner gold mt mb"><app-icon name="star" [size]="16" /> {{ 'auth.trial' | t }}</div>
      @if (chosenPlan(); as p) {
        <div class="card flat row between mb" style="padding:12px 16px">
          <div>
            <div class="subtle">{{ 'plan.current' | t }}</div>
            <strong>{{ 'plan.' + p | t }}</strong> · {{ (interval() === 'yearly' ? 'landing.yearly' : 'landing.monthly') | t }}
          </div>
          <a class="small" routerLink="/welcome" fragment="pricing">{{ 'common.edit' | t }}</a>
        </div>
      }
      <form class="stack" (ngSubmit)="submit()">
        <div class="field">
          <label for="name">{{ 'auth.name' | t }}</label>
          <input id="name" class="input" name="name" autocomplete="name" [(ngModel)]="form.name" required [class.invalid]="errors()['name']" />
          @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
        </div>
        <div class="field">
          <label for="email">{{ 'auth.email' | t }}</label>
          <input id="email" class="input" type="email" name="email" autocomplete="email" [(ngModel)]="form.email" required [class.invalid]="errors()['email']" />
          @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
        </div>
        @if (!isInvite()) {
          <div class="field">
            <label for="ws">{{ 'auth.workspaceName' | t }}</label>
            <input id="ws" class="input" name="workspace_name" [(ngModel)]="form.workspace_name" required [class.invalid]="errors()['workspace_name']" />
            @if (errors()['workspace_name']) { <span class="error-text">{{ errors()['workspace_name'] }}</span> }
          </div>
        }
        <div class="grid grid-2">
          <div class="field">
            <label for="password">{{ 'auth.password' | t }}</label>
            <input id="password" class="input" type="password" name="password" autocomplete="new-password" [(ngModel)]="form.password" required [class.invalid]="errors()['password']" />
          </div>
          <div class="field">
            <label for="password2">{{ 'auth.passwordConfirm' | t }}</label>
            <input id="password2" class="input" type="password" name="password_confirmation" autocomplete="new-password" [(ngModel)]="form.password_confirmation" required />
          </div>
        </div>
        @if (errors()['password']) { <span class="error-text">{{ errors()['password'] }}</span> }
        <label class="check small">
          <input type="checkbox" name="accept_terms" [(ngModel)]="form.accept_terms" />
          <span>{{ 'auth.acceptTerms' | t }}</span>
        </label>
        @if (errors()['accept_terms']) { <span class="error-text">{{ errors()['accept_terms'] }}</span> }
        <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'auth.register' | t }}</button>
      </form>
      <p class="mt center muted">{{ 'auth.haveAccount' | t }} <a [routerLink]="['/login']" [queryParams]="{ redirect: redirect() }">{{ 'auth.login' | t }}</a></p>
    </app-auth-layout>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly redirect = input<string>();
  readonly email = input<string>();
  readonly plan = input<string>();
  readonly interval = input<string>();

  protected form = { name: '', email: '', workspace_name: '', password: '', password_confirmation: '', accept_terms: false };
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.form.email = this.email() ?? '';
  }

  chosenPlan(): string | null {
    const plan = this.plan();
    return plan === 'pro' || plan === 'business' || plan === 'free' ? plan : null;
  }

  isInvite(): boolean {
    return !!this.redirect()?.startsWith('/invite/');
  }

  submit(): void {
    this.busy.set(true);
    this.errors.set({});
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const intent = this.chosenPlan() ? { plan: this.chosenPlan(), interval: this.interval() === 'yearly' ? 'yearly' : 'monthly' } : {};
    this.auth.register({ ...this.form, ...intent, locale: this.i18n.locale(), timezone }).subscribe({
      next: () => void this.router.navigateByUrl(this.redirect() || '/'),
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }
}
