import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Client, Lead, Task } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI, leadStatusClass } from '../../shared/ui';
import { LeadFormModal } from '../shared/lead-form.modal';
import { TaskFormModal } from '../shared/task-form.modal';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-lead-detail-page',
  imports: [RouterLink, LeadFormModal, TaskFormModal, TimelineComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/leads" class="small row mb"><app-icon name="chevronLeft" [size]="14" /> {{ 'leads.title' | t }}</a>
      @if (lead(); as l) {
        <div class="page-header">
          <div>
            <h1>{{ l.name }}</h1>
            <div class="row wrap mt-sm">
              <span class="badge" [class]="'badge ' + statusClass(l.status)">{{ 'leads.status.' + l.status | t }}</span>
              <span class="badge">{{ 'leads.sources.' + l.source | t }}</span>
              @for (tag of l.tags; track tag) { <span class="tag">{{ tag }}</span> }
            </div>
          </div>
          <div class="row wrap">
            @if (l.client_id) {
              <a class="btn primary" [routerLink]="['/clients', l.client_id]">{{ 'leads.openClient' | t }}</a>
            } @else if (auth.canWrite()) {
              <button class="btn danger" (click)="remove(l)"><app-icon name="trash" [size]="16" /></button>
              <button class="btn" (click)="modal.set('edit')"><app-icon name="edit" [size]="16" /> {{ 'common.edit' | t }}</button>
              <a class="btn" routerLink="/quotes/new" [queryParams]="{ lead_id: l.id }"><app-icon name="quote" [size]="16" /> {{ 'quotes.createFor' | t }}</a>
              <button class="btn primary" (click)="convert(l)" [disabled]="busy()"><app-icon name="star" [size]="16" /> {{ 'leads.convert' | t }}</button>
            }
          </div>
        </div>

        @if (auth.canWrite() && !l.client_id) {
          <div class="row wrap mb">
            @for (s of statuses; track s) {
              <button class="btn sm" [class.primary]="l.status === s" (click)="setStatus(l, s)">{{ 'leads.status.' + s | t }}</button>
            }
          </div>
        }

        <div class="grid grid-3">
          <div class="stack">
            <div class="card">
              <div class="card-header"><h3>{{ 'common.details' | t }}</h3></div>
              <dl class="card-body kv">
                <dt>{{ 'common.email' | t }}</dt><dd>@if (l.email) { <a [href]="'mailto:' + l.email">{{ l.email }}</a> } @else { – }</dd>
                <dt>{{ 'common.phone' | t }}</dt><dd>@if (l.phone) { <a [href]="'tel:' + l.phone">{{ l.phone }}</a> } @else { – }</dd>
                <dt>{{ 'common.company' | t }}</dt><dd>{{ l.company || '–' }}</dd>
                <dt>{{ 'common.owner' | t }}</dt><dd>{{ l.owner?.name ?? '–' }}</dd>
                <dt>{{ 'leads.form' | t }}</dt><dd>{{ l.form?.name ?? '–' }}</dd>
                <dt>{{ 'common.created' | t }}</dt><dd>{{ l.created_at | dt }}</dd>
                @if (l.converted_at) { <dt>{{ 'leads.converted' | t }}</dt><dd>{{ l.converted_at | dt }}</dd> }
              </dl>
              @if (l.message) { <div class="card-body" style="border-top:1px solid var(--border);white-space:pre-wrap">{{ l.message }}</div> }
            </div>

            @if (l.utm.source || l.utm.medium || l.utm.campaign || l.referrer) {
              <div class="card">
                <div class="card-header"><h3>{{ 'leads.utm' | t }}</h3></div>
                <dl class="card-body kv">
                  <dt>utm_source</dt><dd>{{ l.utm.source || '–' }}</dd>
                  <dt>utm_medium</dt><dd>{{ l.utm.medium || '–' }}</dd>
                  <dt>utm_campaign</dt><dd>{{ l.utm.campaign || '–' }}</dd>
                  <dt>utm_content</dt><dd>{{ l.utm.content || '–' }}</dd>
                  <dt>{{ 'leads.referrer' | t }}</dt><dd class="truncate">{{ l.referrer || '–' }}</dd>
                </dl>
              </div>
            }

            <div class="card">
              <div class="card-header">
                <h3>{{ 'nav.tasks' | t }}</h3>
                @if (auth.canWrite()) { <button class="btn sm" (click)="modal.set('task')"><app-icon name="plus" [size]="14" /></button> }
              </div>
              @for (task of tasks(); track task.id) {
                <div class="row" style="padding:10px 20px;border-bottom:1px solid var(--border);cursor:pointer" (click)="editTask.set(task)">
                  <span class="dot" [class]="'dot ' + task.priority"></span>
                  <div class="spacer"><div [style.text-decoration]="task.status === 'done' ? 'line-through' : null">{{ task.title }}</div><div class="cell-sub">{{ task.due_at | dt }}</div></div>
                </div>
              } @empty { <div class="empty small">{{ 'common.empty' | t }}</div> }
            </div>

            @if (l.submissions?.length) {
              <div class="card">
                <div class="card-header"><h3>{{ 'leads.submissions' | t }} ({{ l.submissions!.length }})</h3></div>
                @for (s of l.submissions!; track s.id) {
                  <div class="card-body" style="border-bottom:1px solid var(--border)">
                    <div class="row between small"><strong>{{ s.created_at | dt }}</strong>
                      @if (s.marketing_consent) { <span class="badge success">marketing ✓</span> }
                    </div>
                    <dl class="kv mt-sm small">
                      @for (entry of entries(s.data); track entry[0]) { <dt>{{ entry[0] }}</dt><dd>{{ entry[1] }}</dd> }
                    </dl>
                    @if (s.privacy_version) { <div class="subtle mt-sm">Privacy v{{ s.privacy_version }}</div> }
                  </div>
                }
              </div>
            }
          </div>

          <div class="card span-2">
            <div class="card-header"><h3>{{ 'clients.timeline' | t }}</h3></div>
            <div class="card-body"><app-timeline subjectType="lead" [subjectId]="l.id" /></div>
          </div>
        </div>

        @switch (modal()) {
          @case ('edit') { <app-lead-form-modal [lead]="l" (closed)="modal.set(null)" (saved)="modal.set(null); load()" /> }
          @case ('task') { <app-task-form-modal [context]="{ lead_id: l.id, label: l.name }" (closed)="modal.set(null)" (saved)="modal.set(null); loadTasks()" /> }
        }
        @if (editTask(); as task) { <app-task-form-modal [task]="task" (closed)="editTask.set(null)" (saved)="editTask.set(null); loadTasks()" /> }
      }
    </div>
  `,
})
export class LeadDetailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  readonly id = input.required<string>();

  protected readonly statuses = ['new', 'contacted', 'qualified', 'unqualified'];
  protected readonly lead = signal<Lead | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly modal = signal<'edit' | 'task' | null>(null);
  protected readonly editTask = signal<Task | null>(null);
  protected readonly busy = signal(false);

  statusClass = leadStatusClass;

  ngOnInit(): void {
    this.load();
    this.loadTasks();
  }

  load(): void {
    this.api.get<{ data: Lead }>(`leads/${this.id()}`).subscribe({
      next: (res) => this.lead.set(res.data),
      error: () => void this.router.navigateByUrl('/leads'),
    });
  }

  loadTasks(): void {
    this.api.get<{ data: Task[] }>('tasks', { lead_id: this.id(), per_page: 50 }).subscribe((res) => this.tasks.set(res.data));
  }

  entries(data: Record<string, unknown>): [string, string][] {
    return Object.entries(data).map(([key, value]) => [key, value === true ? '✓' : value === false ? '✗' : String(value ?? '')]);
  }

  setStatus(lead: Lead, status: string): void {
    this.api.patch<{ data: Lead }>(`leads/${lead.id}`, { status }).subscribe((res) => this.lead.set({ ...lead, ...res.data }));
  }

  convert(lead: Lead): void {
    if (!confirm(this.i18n.t('leads.convertConfirm'))) {
      return;
    }
    this.busy.set(true);
    this.api.post<{ client: Client }>(`leads/${lead.id}/convert`).subscribe({
      next: (res) => {
        this.toast.success(this.i18n.t('leads.convertDone'));
        void this.router.navigate(['/clients', res.client.id]);
      },
      error: () => this.busy.set(false),
    });
  }

  remove(lead: Lead): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`leads/${lead.id}`).subscribe(() => void this.router.navigateByUrl('/leads'));
    }
  }
}
