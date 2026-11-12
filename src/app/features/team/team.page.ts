import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { Invitation, Member, Role } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-team-page',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ 'team.title' | t }}</h1>
          @if (auth.subscription()?.usage?.['users']; as u) { <p>{{ 'team.seats' | t: { used: u.used, limit: u.limit ?? '∞' } }}</p> }
        </div>
      </div>

      @if (auth.isAdmin()) {
        @if (auth.feature('team')) {
          <div class="card mb">
            <div class="card-header"><h3>{{ 'team.invite' | t }}</h3></div>
            <form class="card-body row wrap" (ngSubmit)="invite()">
              <input class="input" style="flex:1;min-width:220px" type="email" name="email" [(ngModel)]="email" [placeholder]="'common.email' | t" required />
              <select class="select" style="width:auto" name="role" [(ngModel)]="role">
                @for (r of roles; track r) { <option [value]="r">{{ 'roles.' + r | t }} – {{ 'team.roleHelp.' + r | t }}</option> }
              </select>
              <button class="btn primary" type="submit" [disabled]="busy()">{{ 'team.invite' | t }}</button>
              @if (error()) { <span class="error-text" style="width:100%">{{ error() }}</span> }
            </form>
          </div>
        } @else {
          <div class="locked mb"><app-icon name="lock" /><p class="mt-sm">{{ 'team.businessOnly' | t }}</p><a class="btn gold mt" routerLink="/settings/subscription">{{ 'common.upgrade' | t }}</a></div>
        }
      }

      <div class="card">
        <div class="card-header"><h3>{{ 'team.members' | t }}</h3></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ 'common.name' | t }}</th><th>{{ 'team.role' | t }}</th><th>{{ 'common.created' | t }}</th><th></th></tr></thead>
          <tbody>
            @for (m of members.members(); track m.id) {
              <tr>
                <td><div class="row"><span class="avatar">{{ m.name | initials }}</span><div><div class="cell-title">{{ m.name }}</div><div class="cell-sub">{{ m.email }}</div></div></div></td>
                <td>
                  @if (auth.isAdmin() && m.role !== 'owner' && m.id !== auth.user()?.id) {
                    <select class="select sm" style="width:auto" [ngModel]="m.role" (ngModelChange)="changeRole(m, $event)">
                      @for (r of roles; track r) { <option [value]="r">{{ 'roles.' + r | t }}</option> }
                    </select>
                  } @else { <span class="badge" [class.solid]="m.role === 'owner'">{{ 'roles.' + m.role | t }}</span> }
                </td>
                <td class="subtle">{{ m.joined_at | dt: 'date' }}</td>
                <td class="right">@if (auth.isAdmin() && m.role !== 'owner' && m.id !== auth.user()?.id) { <button class="btn sm danger" (click)="remove(m)">{{ 'team.remove' | t }}</button> }</td>
              </tr>
            }
          </tbody>
        </table></div>
      </div>

      @if (auth.role() === 'owner' && otherMembers().length) {
        <div class="card mt">
          <div class="card-header"><h3>{{ 'security.transferTitle' | t }}</h3></div>
          <div class="card-body row wrap">
            <span class="muted spacer">{{ 'security.transferText' | t }}</span>
            <select class="select" style="width:auto" [(ngModel)]="newOwner">
              <option [ngValue]="null">–</option>
              @for (m of otherMembers(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
            </select>
            <button class="btn" [disabled]="!newOwner" (click)="transfer()">{{ 'security.transferButton' | t }}</button>
          </div>
        </div>
      }

      @if (invitations().length) {
        <div class="card mt">
          <div class="card-header"><h3>{{ 'team.invitations' | t }}</h3></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>{{ 'common.email' | t }}</th><th>{{ 'team.role' | t }}</th><th>{{ 'common.status' | t }}</th><th>{{ 'team.expires' | t }}</th><th></th></tr></thead>
            <tbody>
              @for (i of invitations(); track i.id) {
                <tr>
                  <td>{{ i.email }}</td><td>{{ 'roles.' + i.role | t }}</td>
                  <td><span class="badge" [class.info]="i.status === 'pending'" [class.success]="i.status === 'accepted'">{{ 'team.statuses.' + i.status | t }}</span></td>
                  <td class="subtle">{{ i.expires_at | dt }}</td>
                  <td class="right">@if (auth.isAdmin() && i.status === 'pending') { <button class="btn sm" (click)="revoke(i)">{{ 'team.revoke' | t }}</button> }</td>
                </tr>
              }
            </tbody>
          </table></div>
        </div>
      }
    </div>
  `,
})
export class TeamPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);

  protected readonly roles: Role[] = ['admin', 'member', 'viewer'];
  protected readonly invitations = signal<Invitation[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected email = '';
  protected newOwner: number | null = null;
  protected role: Role = 'member';

  ngOnInit(): void {
    this.members.load(true);
    this.loadInvitations();
  }

  loadInvitations(): void {
    this.api.get<{ data: Invitation[] }>('team/invitations').subscribe((res) => this.invitations.set(res.data));
  }

  invite(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.post('team/invitations', { email: this.email, role: this.role }).subscribe({
      next: () => {
        this.busy.set(false);
        this.email = '';
        this.toast.success(this.i18n.t('team.inviteSent'));
        this.loadInvitations();
        this.auth.refreshSubscription();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(fieldErrors(err)['email'] ?? '');
      },
    });
  }

  changeRole(member: Member, role: Role): void {
    this.api.patch(`team/members/${member.id}`, { role }).subscribe(() => {
      this.toast.success(this.i18n.t('common.saved'));
      this.members.load(true);
    });
  }

  remove(member: Member): void {
    if (confirm(this.i18n.t('team.removeConfirm'))) {
      this.api.delete(`team/members/${member.id}`).subscribe(() => {
        this.members.load(true);
        this.auth.refreshSubscription();
      });
    }
  }

  otherMembers(): Member[] {
    return this.members.members().filter((m) => m.id !== this.auth.user()?.id);
  }

  transfer(): void {
    const member = this.otherMembers().find((m) => m.id === this.newOwner);
    if (!member || !confirm(this.i18n.t('security.transferConfirm', { name: member.name }))) return;
    this.api.post('team/owner', { user_id: member.id }).subscribe(() => {
      this.toast.success(this.i18n.t('security.transferred'));
      this.members.load(true);
      this.auth.loadMe().subscribe();
      this.newOwner = null;
    });
  }

  revoke(invitation: Invitation): void {
    this.api.delete(`team/invitations/${invitation.id}`).subscribe(() => {
      this.loadInvitations();
      this.auth.refreshSubscription();
    });
  }
}
