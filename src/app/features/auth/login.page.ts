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
        <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'auth.login' | t }}</button>
      </form>
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

  submit(): void {
    this.busy.set(true);
    this.errors.set({});
    this.auth.login(this.email, this.password).subscribe({
      next: () => void this.router.navigateByUrl(this.redirect() || '/'),
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }
}
