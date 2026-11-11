import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuditLog, Paginated, PlanKey } from '../../core/models';
import { UI } from '../../shared/ui';

interface AdminStats {
  users: number;
  workspaces: number;
  workspaces_on_trial: number;
  workspaces_paid: number;
  workspaces_suspended: number;
  plans: Record<string, number>;
  clients: number;
  leads: number;
  submissions_30_days: number;
  signups_30_days: number;
}

interface AdminWorkspace {
  id: number;
  name: string;
  slug: string;
  owner: { id: number; name: string; email: string } | null;
  members_count: number;
  plan: PlanKey;
  effective_plan: PlanKey;
  trial_ends_at: string | null;
  subscription_status: string | null;
  suspended_at: string | null;
  created_at: string;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_super_admin: boolean;
  workspaces_count: number;
  last_login_at: string | null;
  created_at: string;
}

@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'admin.title' | t }}</h1><p>{{ 'admin.notice' | t }}</p></div>
      </div>
      <div class="tabs">
        @for (t of tabs; track t) { <button [class.active]="tab() === t" (click)="setTab(t)">{{ 'admin.' + t | t }}</button> }
      </div>

      @switch (tab()) {
        @case ('stats') {
          @if (stats(); as s) {
            <div class="grid grid-4">
              <div class="card stat"><span class="stat-label">{{ 'admin.users' | t }}</span><span class="stat-value">{{ s.users | num }}</span><span class="subtle">{{ 'admin.signups' | t }}: {{ s.signups_30_days }}</span></div>
              <div class="card stat"><span class="stat-label">{{ 'admin.workspaces' | t }}</span><span class="stat-value">{{ s.workspaces | num }}</span><span class="subtle">{{ 'admin.onTrial' | t }}: {{ s.workspaces_on_trial }}</span></div>
              <div class="card stat"><span class="stat-label">{{ 'admin.paid' | t }}</span><span class="stat-value">{{ s.workspaces_paid | num }}</span><span class="subtle">{{ 'admin.suspended' | t }}: {{ s.workspaces_suspended }}</span></div>
              <div class="card stat"><span class="stat-label">{{ 'admin.submissions' | t }}</span><span class="stat-value">{{ s.submissions_30_days | num }}</span><span class="subtle">{{ 'nav.clients' | t }}: {{ s.clients }} · {{ 'nav.leads' | t }}: {{ s.leads }}</span></div>
            </div>
          }
        }
        @case ('workspaces') {
          <div class="card">
            <div class="toolbar"><div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>{{ 'nav.workspace' | t }}</th><th>{{ 'roles.owner' | t }}</th><th>{{ 'admin.members' | t }}</th><th>{{ 'admin.setPlan' | t }}</th><th>{{ 'plan.trial' | t }}</th><th>{{ 'common.status' | t }}</th><th></th></tr></thead>
              <tbody>
                @for (w of workspaces()?.data ?? []; track w.id) {
                  <tr>
                    <td><div class="cell-title">{{ w.name }}</div><div class="cell-sub">#{{ w.id }} · {{ w.created_at | dt: 'date' }}</div></td>
                    <td><div>{{ w.owner?.name }}</div><div class="cell-sub">{{ w.owner?.email }}</div></td>
                    <td>{{ w.members_count }}</td>
                    <td>
                      <select class="select sm" style="width:auto" [ngModel]="w.subscription_status === 'active' ? w.plan : 'free'" (ngModelChange)="setPlan(w, $event)">
                        <option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
                      </select>
                      <div class="cell-sub">→ {{ w.effective_plan }}</div>
                    </td>
                    <td class="small">{{ w.trial_ends_at ? (w.trial_ends_at | dt: 'date') : '–' }}</td>
                    <td>@if (w.suspended_at) { <span class="badge danger">{{ 'admin.suspended' | t }}</span> } @else { <span class="badge success">OK</span> }</td>
                    <td class="right nowrap">
                      <button class="btn sm" (click)="update(w, { extend_trial_days: 14 })">{{ 'admin.extendTrial' | t }}</button>
                      <button class="btn sm" [class.danger]="!w.suspended_at" (click)="update(w, { suspended: !w.suspended_at })">{{ (w.suspended_at ? 'admin.unsuspend' : 'admin.suspend') | t }}</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table></div>
            <app-pagination [meta]="workspaces()?.meta ?? null" (page)="loadWorkspaces($event)" (perPage)="loadWorkspaces(1)" />
          </div>
        }
        @case ('users') {
          <div class="card">
            <div class="toolbar"><div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>{{ 'common.name' | t }}</th><th>{{ 'admin.workspaces' | t }}</th><th>{{ 'admin.lastLogin' | t }}</th><th>{{ 'common.created' | t }}</th></tr></thead>
              <tbody>
                @for (u of users()?.data ?? []; track u.id) {
                  <tr>
                    <td><div class="cell-title">{{ u.name }} @if (u.is_super_admin) { <span class="badge gold">SA</span> }</div><div class="cell-sub">{{ u.email }}</div></td>
                    <td>{{ u.workspaces_count }}</td><td class="subtle">{{ u.last_login_at ? (u.last_login_at | dt) : '–' }}</td><td class="subtle">{{ u.created_at | dt: 'date' }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
            <app-pagination [meta]="users()?.meta ?? null" (page)="loadUsers($event)" (perPage)="loadUsers(1)" />
          </div>
        }
        @case ('audit') {
          <div class="card">
            <div class="toolbar"><label class="check small"><input type="checkbox" [(ngModel)]="adminOnly" (ngModelChange)="loadAudit(1)" /> {{ 'admin.adminOnly' | t }}</label></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>{{ 'common.date' | t }}</th><th>{{ 'nav.workspace' | t }}</th><th>{{ 'common.name' | t }}</th><th>{{ 'common.actions' | t }}</th><th>IP</th></tr></thead>
              <tbody>
                @for (log of audit()?.data ?? []; track log.id) {
                  <tr>
                    <td class="subtle nowrap">{{ log.created_at | dt }}</td><td>{{ log.workspace?.name ?? '–' }}</td><td>{{ log.user?.name ?? '–' }}</td>
                    <td><code>{{ log.action }}</code> @if (log.is_admin_action) { <span class="badge gold">SA</span> }</td><td class="subtle">{{ log.ip_address }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
            <app-pagination [meta]="audit()?.meta ?? null" (page)="loadAudit($event)" (perPage)="loadAudit(1)" />
          </div>
        }
      }
    </div>
  `,
})
export class AdminPage {
  private readonly api = inject(ApiService);
  protected readonly tabs = ['stats', 'workspaces', 'users', 'audit'] as const;
  protected readonly tab = signal<(typeof this.tabs)[number]>('stats');
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly workspaces = signal<Paginated<AdminWorkspace> | null>(null);
  protected readonly users = signal<Paginated<AdminUser> | null>(null);
  protected readonly audit = signal<Paginated<AuditLog> | null>(null);
  protected readonly search$ = new Subject<void>();
  protected search = '';
  protected adminOnly = false;

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => (this.tab() === 'users' ? this.loadUsers(1) : this.loadWorkspaces(1)));
  }

  ngOnInit(): void {
    this.api.get<AdminStats>('admin/stats').subscribe((res) => this.stats.set(res));
  }

  setTab(tab: (typeof this.tabs)[number]): void {
    this.tab.set(tab);
    this.search = '';
    if (tab === 'workspaces') this.loadWorkspaces(1);
    if (tab === 'users') this.loadUsers(1);
    if (tab === 'audit') this.loadAudit(1);
  }

  loadWorkspaces(page: number): void {
    this.api.get<Paginated<AdminWorkspace>>('admin/workspaces', { page, search: this.search }).subscribe((res) => this.workspaces.set(res));
  }

  loadUsers(page: number): void {
    this.api.get<Paginated<AdminUser>>('admin/users', { page, search: this.search }).subscribe((res) => this.users.set(res));
  }

  loadAudit(page: number): void {
    this.api.get<Paginated<AuditLog>>('admin/audit-logs', { page, admin_only: this.adminOnly ? 1 : '' }).subscribe((res) => this.audit.set(res));
  }

  setPlan(workspace: AdminWorkspace, plan: PlanKey): void {
    this.update(workspace, plan === 'free' ? { plan: 'free', subscription_status: null } : { plan, subscription_status: 'active' });
  }

  update(workspace: AdminWorkspace, changes: Record<string, unknown>): void {
    this.api.patch<{ data: AdminWorkspace }>(`admin/workspaces/${workspace.id}`, changes).subscribe((res) =>
      this.workspaces.update((page) => (page ? { ...page, data: page.data.map((w) => (w.id === res.data.id ? res.data : w)) } : page)),
    );
  }
}
