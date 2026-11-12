import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { fieldErrors } from '../../core/interceptors';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <h1>{{ 'security.resetTitle' | t }}</h1>
      @if (done()) {
        <div class="banner info mt mb">{{ 'security.resetDone' | t }}</div>
        <a class="btn primary block" routerLink="/login">{{ 'auth.login' | t }}</a>
      } @else {
        <p class="muted mt-sm mb">{{ email }}</p>
        <form class="stack" (ngSubmit)="submit()">
          <div class="field">
            <label for="password">{{ 'settings.newPassword' | t }}</label>
            <input id="password" class="input" type="password" name="password" autocomplete="new-password" [(ngModel)]="password" required />
          </div>
          <div class="field">
            <label for="password2">{{ 'auth.passwordConfirm' | t }}</label>
            <input id="password2" class="input" type="password" name="password_confirmation" autocomplete="new-password" [(ngModel)]="confirmation" required />
          </div>
          @for (e of errorList(); track e) { <span class="error-text">{{ e }}</span> }
          <button class="btn primary block" type="submit" [disabled]="busy()">{{ 'security.resetSave' | t }}</button>
        </form>
      }
    </app-auth-layout>
  `,
})
export class ResetPasswordPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected email = this.route.snapshot.queryParamMap.get('email') ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected password = '';
  protected confirmation = '';
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly errorList = signal<string[]>([]);

  submit(): void {
    this.busy.set(true);
    this.api.post('auth/reset-password', { token: this.token, email: this.email, password: this.password, password_confirmation: this.confirmation }).subscribe({
      next: () => this.done.set(true),
      error: (err) => {
        this.busy.set(false);
        this.errorList.set(Object.values(fieldErrors(err)));
      },
    });
  }
}
