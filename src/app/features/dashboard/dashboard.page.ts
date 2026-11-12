import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Activity, Subscription, Task } from '../../core/models';
import { BarChartComponent, BarPoint } from '../../shared/bar-chart.component';
import { UI } from '../../shared/ui';
import { ClientFormModal } from '../shared/client-form.modal';
import { LeadFormModal } from '../shared/lead-form.modal';
import { TaskFormModal } from '../shared/task-form.modal';

interface DashboardData {
  stats: { clients_total: number; clients_active: number; leads_new: number; leads_last_30_days: number; tasks_open: number; tasks_overdue: number; deals_open_value: number };
  upcoming_tasks: Task[];
  pipeline: { id: number; name: string; stages: { id: number; name: string; type: string; deals: number; value: number }[] } | null;
  acquisition: BarPoint[];
  lead_sources: { channel: string; total: number }[];
  recent_activities: Activity[];
  subscription: Subscription;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, BarChartComponent, ClientFormModal, LeadFormModal, TaskFormModal, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ 'dashboard.greeting' | t: { name: firstName() } }}</h1>
          <p>{{ 'dashboard.subtitle' | t }}</p>
        </div>
        @if (auth.canWrite()) {
          <div class="row wrap">
            <button class="btn" (click)="modal.set('lead')"><app-icon name="inbox" [size]="16" /> {{ 'dashboard.quickNewLead' | t }}</button>
            <button class="btn" (click)="modal.set('task')"><app-icon name="checkSquare" [size]="16" /> {{ 'dashboard.quickNewTask' | t }}</button>
            <button class="btn primary" (click)="modal.set('client')"><app-icon name="plus" [size]="16" /> {{ 'dashboard.quickNewClient' | t }}</button>
          </div>
        }
      </div>

      @if (data(); as d) {
        <div class="grid grid-4">
          <a class="card stat" routerLink="/clients"><span class="stat-label">{{ 'dashboard.clientsTotal' | t }}</span><span class="stat-value">{{ d.stats.clients_total | num }}</span><span class="subtle">{{ 'dashboard.clientsActive' | t }}: {{ d.stats.clients_active | num }}</span></a>
          <a class="card stat" routerLink="/leads" [queryParams]="{ status: 'new' }"><span class="stat-label">{{ 'dashboard.leadsNew' | t }}</span><span class="stat-value">{{ d.stats.leads_new | num }}</span><span class="subtle">{{ 'dashboard.leads30' | t }}: {{ d.stats.leads_last_30_days | num }}</span></a>
          <a class="card stat" routerLink="/tasks"><span class="stat-label">{{ 'dashboard.tasksOpen' | t }}</span><span class="stat-value">{{ d.stats.tasks_open | num }}</span><span class="subtle" [style.color]="d.stats.tasks_overdue ? 'var(--danger)' : null">{{ 'dashboard.tasksOverdue' | t }}: {{ d.stats.tasks_overdue | num }}</span></a>
          <a class="card stat" routerLink="/pipeline"><span class="stat-label">{{ 'dashboard.pipelineValue' | t }}</span><span class="stat-value">{{ d.stats.deals_open_value | money }}</span><span class="subtle">{{ d.pipeline?.name }}</span></a>
        </div>

        @if (d.stats.clients_total === 0 && d.stats.leads_last_30_days === 0) {
          <div class="card mt">
            <div class="card-header"><h2>{{ 'dashboard.getStarted' | t }}</h2></div>
            <div class="card-body grid grid-3">
              <a class="card flat stat" routerLink="/imports"><app-icon name="upload" /><strong>1.</strong> {{ 'dashboard.stepImport' | t }}</a>
              <a class="card flat stat" routerLink="/forms"><app-icon name="form" /><strong>2.</strong> {{ 'dashboard.stepForm' | t }}</a>
              <a class="card flat stat" routerLink="/forms"><app-icon name="link" /><strong>3.</strong> {{ 'dashboard.stepShare' | t }}</a>
            </div>
          </div>
        }

        <div class="grid grid-3 mt">
          <div class="card span-2">
            <div class="card-header"><h2>{{ 'dashboard.acquisition' | t }}</h2><a routerLink="/reports" class="small">{{ 'common.viewAll' | t }}</a></div>
            <div class="card-body"><app-bar-chart [data]="d.acquisition" [labels]="[('reports.clients' | t), ('reports.leads' | t)]" /></div>
          </div>
          <div class="card">
            <div class="card-header"><h2>{{ 'dashboard.sources' | t }}</h2></div>
            <div class="card-body stack">
              @for (s of d.lead_sources; track s.channel) {
                <div class="hbar">
                  <span class="truncate">{{ sourceLabel(s.channel) }}</span>
                  <div class="progress"><div [style.width.%]="(s.total / maxSource()) * 100"></div></div>
                  <span class="right">{{ s.total }}</span>
                </div>
              } @empty { <div class="empty small">{{ 'common.empty' | t }}</div> }
            </div>
          </div>
        </div>

        <div class="grid grid-2 mt">
          <div class="card">
            <div class="card-header"><h2>{{ 'dashboard.upcoming' | t }}</h2><a routerLink="/tasks" class="small">{{ 'common.viewAll' | t }}</a></div>
            <div>
              @for (task of d.upcoming_tasks; track task.id) {
                <div class="row" style="padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer" (click)="editTask.set(task)">
                  <span class="dot" [class]="'dot ' + task.priority"></span>
                  <div class="spacer truncate">
                    <div class="cell-title truncate">{{ task.title }}</div>
                    <div class="cell-sub">{{ task.client?.name ?? task.lead?.name ?? '' }}</div>
                  </div>
                  <span class="badge" [class.danger]="task.is_overdue">{{ task.due_at | dt }}</span>
                </div>
              } @empty { <div class="empty">{{ 'dashboard.noUpcoming' | t }}</div> }
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h2>{{ 'dashboard.pipeline' | t }}</h2><a routerLink="/pipeline" class="small">{{ 'common.open' | t }}</a></div>
            <div class="card-body stack">
              @for (s of d.pipeline?.stages ?? []; track s.id) {
                <div class="hbar" style="grid-template-columns: 140px 1fr 110px">
                  <span class="truncate">{{ s.name }}</span>
                  <div class="progress" [class.warn]="s.type === 'lost'"><div [style.width.%]="(s.deals / maxStage()) * 100"></div></div>
                  <span class="right small">{{ s.deals }} · {{ s.value | money }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-header"><h2>{{ 'dashboard.recent' | t }}</h2></div>
          <div class="card-body timeline">
            @for (a of d.recent_activities; track a.id) {
              <div class="timeline-item">
                <div class="spacer">
                  <strong>{{ a.title || ('activity.types.' + a.type | t) }}</strong>
                  @if (a.subject) {
                    · <a [routerLink]="subjectLink(a)">{{ a.subject.name }}</a>
                  }
                  @if (a.body) { <div class="muted truncate">{{ a.body }}</div> }
                </div>
                <span class="subtle nowrap">{{ a.occurred_at | dt: 'relative' }}</span>
              </div>
            } @empty { <div class="empty small">{{ 'activity.empty' | t }}</div> }
          </div>
        </div>
      } @else {
        <div class="grid grid-4">@for (i of [1, 2, 3, 4]; track i) { <div class="card stat"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="height:26px;width:40%"></div></div> }</div>
      }
    </div>

    @switch (modal()) {
      @case ('client') { <app-client-form-modal (closed)="modal.set(null)" (saved)="openClient($event.id)" /> }
      @case ('lead') { <app-lead-form-modal (closed)="modal.set(null)" (saved)="openLead($event.id)" /> }
      @case ('task') { <app-task-form-modal (closed)="modal.set(null)" (saved)="modal.set(null); load()" /> }
    }
    @if (editTask(); as task) { <app-task-form-modal [task]="task" (closed)="editTask.set(null)" (saved)="editTask.set(null); load()" /> }
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly modal = signal<'client' | 'lead' | 'task' | null>(null);
  protected readonly editTask = signal<Task | null>(null);

  protected readonly firstName = computed(() => {
    const parts = (this.auth.user()?.name ?? '').split(' ');
    return this.auth.user()?.locale === 'hu' ? parts[parts.length - 1] : parts[0];
  });
  protected readonly maxSource = computed(() => Math.max(1, ...(this.data()?.lead_sources ?? []).map((s) => s.total)));
  protected readonly maxStage = computed(() => Math.max(1, ...(this.data()?.pipeline?.stages ?? []).map((s) => s.deals)));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<DashboardData>('dashboard').subscribe((res) => {
      this.data.set(res);
      this.auth.subscription.set(res.subscription);
    });
  }

  sourceLabel(channel: string): string {
    return ['manual', 'form', 'link', 'import'].includes(channel) ? this.translate(`leads.sources.${channel}`) : channel;
  }

  subjectLink(activity: Activity): (string | number)[] {
    if (activity.subject_type === 'deal') {
      return ['/pipeline'];
    }
    return [activity.subject_type === 'client' ? '/clients' : '/leads', activity.subject_id];
  }

  openClient(id: number): void {
    void this.router.navigate(['/clients', id]);
  }

  openLead(id: number): void {
    void this.router.navigate(['/leads', id]);
  }

  private translate(key: string): string {
    return this.i18n.t(key);
  }

}
