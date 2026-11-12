import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Paginated, PlanKey } from '../../core/models';
import { UI } from '../../shared/ui';

interface AdminWorkspace {
  id: number;
  name: string;
  owner: { id: number; name: string; email: string } | null;
  members_count: number;
  plan: PlanKey;
  effective_plan: PlanKey;
  trial_ends_at: string | null;
  subscription_status: string | null;
  suspended_at: string | null;
  created_at: string;
}

/** Workspaces with trial / plan filters, manual plan activation, trial extension and suspension. */
@Component({
  selector: 'app-admin-workspaces',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="toolbar">
        <div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div>
        <div class="segmented" style="flex-wrap:wrap">
          @for (f of filters; track f) { <button [class.active]="status === f" (click)="setStatus(f)">{{ 'platform.filters.' + (f || 'all') | t }}</button> }
        </div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>{{ 'nav.workspace' | t }}</th><th>{{ 'roles.owner' | t }}</th><th>{{ 'admin.members' | t }}</th><th>{{ 'platform.plan' | t }}</th><th>{{ 'plan.trial' | t }}</th><th>{{ 'common.status' | t }}</th><th></th></tr></thead>
        <tbody>
          @for (w of page()?.data ?? []; track w.id) {
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
          } @empty { <tr><td colspan="7"><app-empty-state illustration="search" [compact]="true" [title]="'empty.noResultsTitle' | t" /></td></tr> }
        </tbody>
      </table></div>
      <app-pagination [meta]="page()?.meta ?? null" (page)="load($event)" (perPage)="load(1)" />
    </div>
  `,
})
export class AdminWorkspacesComponent {
  private readonly api = inject(ApiService);
  protected readonly filters = ['', 'trial', 'expiring', 'paid', 'free', 'suspended'];
  protected readonly page = signal<Paginated<AdminWorkspace> | null>(null);
  protected readonly search$ = new Subject<void>();
  protected search = '';
  protected status = '';

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.load(1));
  }

  ngOnInit(): void {
    this.load(1);
  }

  setStatus(status: string): void {
    this.status = status;
    this.load(1);
  }

  load(page: number): void {
    this.api.get<Paginated<AdminWorkspace>>('admin/workspaces', { page, search: this.search, status: this.status }).subscribe((res) => this.page.set(res));
  }

  setPlan(workspace: AdminWorkspace, plan: PlanKey): void {
    this.update(workspace, plan === 'free' ? { plan: 'free', subscription_status: null } : { plan, subscription_status: 'active' });
  }

  update(workspace: AdminWorkspace, changes: Record<string, unknown>): void {
    this.api.patch<{ data: AdminWorkspace }>(`admin/workspaces/${workspace.id}`, changes).subscribe((res) =>
      this.page.update((page) => (page ? { ...page, data: page.data.map((w) => (w.id === res.data.id ? res.data : w)) } : page)),
    );
  }
}
