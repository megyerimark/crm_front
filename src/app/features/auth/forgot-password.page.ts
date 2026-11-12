import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { fieldErrors } from '../../core/interceptors';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <h1>{{ 'security.forgotTitle' | t }}</h1>
      <p class="muted mt-sm mb">{{ 'security.forgotText' | t }}</p>
      @if (sent()) {
        <div class="banner info mb">{{ 'security.forgotSent' | t }}</div>
      } @else {
        <form class="stack" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">{{ 'auth.email' | t }}</label>
            <input id="email" class="input" type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
            @if (error()) { <span class="error-text">{{ error() }}</span> }
          </div>
          <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'security.forgotSend' | t }}</button>
        </form>
      }
      <p class="mt center"><a routerLink="/login">{{ 'security.backToLogin' | t }}</a></p>
    </app-auth-layout>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(ApiService);
  protected email = '';
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');

  submit(): void {
    this.busy.set(true);
    this.api.post('auth/forgot-password', { email: this.email }).subscribe({
      next: () => this.sent.set(true),
      error: (err) => {
        this.busy.set(false);
        this.error.set(fieldErrors(err)['email'] ?? '');
      },
    });
  }
}
