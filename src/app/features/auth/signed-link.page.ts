import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

/**
 * Landing page of the signed links in e-mails (address verification and e-mail change).
 * It forwards the signed parameters to the API, which validates the signature.
 */
@Component({
  selector: 'app-signed-link-page',
  imports: [RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @switch (state()) {
        @case ('loading') { <p class="muted">{{ 'security.verifying' | t }}</p> }
        @case ('done') {
          <app-empty-state illustration="tasks" [title]="'security.verified' | t" [text]="message()" />
          <a class="btn primary block" [routerLink]="auth.isLoggedIn() ? '/' : '/login'">{{ 'security.continue' | t }}</a>
        }
        @case ('error') {
          <app-empty-state illustration="search" [title]="'security.invalidLink' | t" />
          <a class="btn block" routerLink="/login">{{ 'security.backToLogin' | t }}</a>
        }
      }
    </app-auth-layout>
  `,
})
export class SignedLinkPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly state = signal<'loading' | 'done' | 'error'>('loading');
  protected readonly message = signal('');

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const kind = this.route.snapshot.data['kind'] as 'verify' | 'email-change';
    const [id, hash, expires, signature] = ['id', 'hash', 'expires', 'signature'].map((key) => q.get(key) ?? '');
    if (!/^\d+$/.test(id) || !/^[a-f0-9]{40}$/.test(hash)) {
      this.state.set('error');
      return;
    }
    const base = kind === 'verify' ? 'auth/email/verify' : 'auth/email-change/confirm';
    this.api.get<{ message: string }>(`${base}/${id}/${hash}`, { expires, signature }).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.state.set('done');
        if (this.auth.isLoggedIn()) {
          this.auth.loadMe().subscribe();
        }
      },
      error: () => this.state.set('error'),
    });
  }
}
