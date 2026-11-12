import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuditLog, Paginated } from '../../core/models';
import { UI } from '../../shared/ui';
import { AdminBillingComponent } from './admin-billing.component';
import { AdminOverviewComponent } from './admin-overview.component';
import { AdminPlansComponent } from './admin-plans.component';
import { AdminSupportComponent } from './admin-support.component';
import { AdminSystemComponent } from './admin-system.component';
import { AdminWorkspacesComponent } from './admin-workspaces.component';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_super_admin: boolean;
  workspaces_count: number;
  email_verified_at: string | null;
  two_factor_enabled: boolean;
  last_seen_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

const TABS = ['overview', 'workspaces', 'subscriptions', 'invoices', 'support', 'plans', 'users', 'audit', 'system'] as const;
type Tab = (typeof TABS)[number];

/** VállalkozóOS Super Admin: the platform console (separate from the workspace Admin role). */
@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, RouterLink, AdminOverviewComponent, AdminWorkspacesComponent, AdminBillingComponent, AdminSupportComponent, AdminPlansComponent, AdminSystemComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" style="max-width:1500px">
      <div class="page-header">
        <div><h1>{{ 'admin.title' | t }}</h1><p>{{ 'admin.notice' | t }}</p></div>
      </div>

      @if (needs2fa()) {
        <div class="card"><app-empty-state illustration="search" [title]="'platform.twoFactorRequired' | t"><a class="btn primary" routerLink="/settings/profile">{{ 'platform.enable2fa' | t }}</a></app-empty-state></div>
      } @else if (ready()) {
        <div class="tabs">
          @for (t of tabs; track t) { <button [class.active]="tab() === t" (click)="setTab(t)">{{ 'platform.tabs.' + t | t }}</button> }
        </div>

        @switch (tab()) {
          @case ('overview') { <app-admin-overview /> }
          @case ('workspaces') { <app-admin-workspaces /> }
          @case ('subscriptions') { <app-admin-billing mode="subscriptions" /> }
          @case ('invoices') { <app-admin-billing mode="invoices" /> }
          @case ('support') { <app-admin-support [initialTicket]="ticket" /> }
          @case ('plans') { <app-admin-plans /> }
          @case ('users') {
            <div class="card">
              <div class="toolbar"><div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div></div>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>{{ 'common.name' | t }}</th><th>{{ 'admin.workspaces' | t }}</th><th>{{ 'platform.verified' | t }}</th><th>2FA</th><th>{{ 'platform.lastSeen' | t }}</th><th>{{ 'common.created' | t }}</th></tr></thead>
                <tbody>
                  @for (u of users()?.data ?? []; track u.id) {
                    <tr>
                      <td><div class="cell-title">{{ u.name }} @if (u.is_super_admin) { <span class="badge solid">SA</span> }</div><div class="cell-sub">{{ u.email }}</div></td>
                      <td>{{ u.workspaces_count }}</td>
                      <td>@if (u.email_verified_at) { <span class="badge success">✓</span> } @else { <span class="badge warning">–</span> }</td>
                      <td>@if (u.two_factor_enabled) { <span class="badge success">✓</span> } @else { <span class="badge">–</span> }</td>
                      <td class="subtle">{{ u.last_seen_at ? (u.last_seen_at | dt: 'relative') : '–' }}</td>
                      <td class="subtle">{{ u.created_at | dt: 'date' }}</td>
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
                      <td><code>{{ log.action }}</code> @if (log.is_admin_action) { <span class="badge solid">SA</span> }</td><td class="subtle">{{ log.ip_address }}</td>
                    </tr>
                  }
                </tbody>
              </table></div>
              <app-pagination [meta]="audit()?.meta ?? null" (page)="loadAudit($event)" (perPage)="loadAudit(1)" />
            </div>
          }
          @case ('system') { <app-admin-system /> }
        }
      }
    </div>
  `,
})
export class AdminPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('overview');
  protected readonly ready = signal(false);
  protected readonly needs2fa = signal(false);
  protected readonly users = signal<Paginated<AdminUser> | null>(null);
  protected readonly audit = signal<Paginated<AuditLog> | null>(null);
  protected readonly search$ = new Subject<void>();
  protected search = '';
  protected adminOnly = false;
  protected ticket: number | null = Number(this.route.snapshot.queryParamMap.get('ticket')) || null;

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.loadUsers(1));
  }

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    this.api.get('admin/stats').subscribe({
      next: () => {
        this.ready.set(true);
        this.setTab(tab && TABS.includes(tab) ? tab : 'overview');
      },
      error: (err: HttpErrorResponse) => this.needs2fa.set(err.error?.code === 'two_factor_required'),
    });
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab, ticket: tab === 'support' ? this.ticket : null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (tab === 'users') this.loadUsers(1);
    if (tab === 'audit') this.loadAudit(1);
  }

  loadUsers(page: number): void {
    this.api.get<Paginated<AdminUser>>('admin/users', { page, search: this.search }).subscribe((res) => this.users.set(res));
  }

  loadAudit(page: number): void {
    this.api.get<Paginated<AuditLog>>('admin/audit-logs', { page, admin_only: this.adminOnly ? 1 : '' }).subscribe((res) => this.audit.set(res));
  }
}
