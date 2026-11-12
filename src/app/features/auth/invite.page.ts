import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/interceptors';
import { Role, Workspace } from '../../core/models';
import { AuthLayoutComponent } from '../../layout/auth-layout.component';
import { UI } from '../../shared/ui';

interface InvitationInfo {
  email: string;
  role: Role;
  workspace: string;
  inviter: string | null;
  expires_at: string;
}

@Component({
  selector: 'app-invite-page',
  imports: [RouterLink, AuthLayoutComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @if (invalid()) {
        <h1>{{ 'auth.inviteTitle' | t }}</h1>
        <div class="banner danger mt">{{ 'auth.inviteInvalid' | t }}</div>
        <a class="btn mt" routerLink="/">{{ 'common.back' | t }}</a>
      } @else if (info(); as inv) {
        <h1>{{ 'auth.inviteTitle' | t }}</h1>
        <p class="muted mt-sm mb">{{ 'auth.inviteText' | t: { inviter: inv.inviter, workspace: inv.workspace, role: ('roles.' + inv.role | t) } }}</p>
        @if (loggedIn()) {
          @if (error()) { <div class="banner danger mb">{{ error() }}</div> }
          <button class="btn primary block" (click)="accept()" [disabled]="busy()">{{ 'auth.acceptInvite' | t }}</button>
        } @else {
          <div class="banner info mb">{{ 'auth.inviteLogin' | t: { email: inv.email } }}</div>
          <div class="row">
            <a class="btn primary" [routerLink]="['/login']" [queryParams]="{ redirect: '/invite/' + token() }">{{ 'auth.login' | t }}</a>
            <a class="btn" [routerLink]="['/register']" [queryParams]="{ redirect: '/invite/' + token(), email: inv.email }">{{ 'auth.register' | t }}</a>
          </div>
        }
      } @else {
        <p class="muted">{{ 'common.loading' | t }}</p>
      }
    </app-auth-layout>
  `,
})
export class InvitePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly token = input.required<string>();

  protected readonly info = signal<InvitationInfo | null>(null);
  protected readonly invalid = signal(false);
  protected readonly loggedIn = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    this.loggedIn.set(await this.auth.ensureLoaded());
    this.api.get<{ data: InvitationInfo }>(`invitations/${this.token()}`).subscribe({
      next: (res) => this.info.set(res.data),
      error: () => this.invalid.set(true),
    });
  }

  accept(): void {
    this.busy.set(true);
    this.api.post<{ data: Workspace }>(`invitations/${this.token()}/accept`).subscribe({
      next: (res) => {
        this.auth.setWorkspace(res.data.id);
        this.auth.loadMe().subscribe(() => void this.router.navigateByUrl('/'));
      },
      error: (err) => {
        this.error.set(errorMessage(err, ''));
        this.busy.set(false);
      },
    });
  }
}
