import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Client, CustomField, Deal, Pipeline, Task } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI, clientStatusClass } from '../../shared/ui';
import { ClientFormModal } from '../shared/client-form.modal';
import { DealFormModal } from '../shared/deal-form.modal';
import { TaskFormModal } from '../shared/task-form.modal';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-client-detail-page',
  imports: [RouterLink, ClientFormModal, TaskFormModal, DealFormModal, TimelineComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/clients" class="small row mb"><app-icon name="chevronLeft" [size]="14" /> {{ 'clients.title' | t }}</a>
      @if (client(); as c) {
        <div class="page-header">
          <div class="row">
            <span class="avatar lg">{{ c.name | initials }}</span>
            <div>
              <h1>{{ c.name }}</h1>
              <div class="row wrap mt-sm">
                <span class="badge" [class]="'badge ' + statusClass(c.status)">{{ 'clients.' + c.status | t }}</span>
                <span class="badge">{{ (c.type === 'company' ? 'clients.companyType' : 'clients.person') | t }}</span>
                @if (c.lead_id) { <a class="badge solid" [routerLink]="['/leads', c.lead_id]"> {{ 'clients.fromLead' | t }}</a> }
                @for (tag of c.tags; track tag) { <span class="tag">{{ tag }}</span> }
              </div>
            </div>
          </div>
          @if (auth.canWrite()) {
            <div class="row">
              <button class="btn danger" (click)="remove(c)"><app-icon name="trash" [size]="16" /></button>
              <button class="btn" (click)="modal.set('edit')"><app-icon name="edit" [size]="16" /> {{ 'common.edit' | t }}</button>
              <a class="btn" routerLink="/quotes/new" [queryParams]="{ client_id: c.id }"><app-icon name="quote" [size]="16" /> {{ 'quotes.createFor' | t }}</a>
            </div>
          }
        </div>

        <div class="grid grid-3">
          <div class="stack">
            <div class="card">
              <div class="card-header"><h3>{{ 'common.details' | t }}</h3></div>
              <dl class="card-body kv">
                <dt>{{ 'common.company' | t }}</dt><dd>{{ c.company || '–' }}</dd>
                <dt>{{ 'common.email' | t }}</dt><dd>@if (c.email) { <a [href]="'mailto:' + c.email">{{ c.email }}</a> } @else { – }</dd>
                <dt>{{ 'common.phone' | t }}</dt><dd>@if (c.phone) { <a [href]="'tel:' + c.phone">{{ c.phone }}</a> } @else { – }</dd>
                <dt>{{ 'common.address' | t }}</dt><dd>{{ c.address || '–' }}</dd>
                <dt>{{ 'common.category' | t }}</dt><dd>{{ c.category || '–' }}</dd>
                <dt>{{ 'common.owner' | t }}</dt><dd>{{ c.owner?.name ?? '–' }}</dd>
                <dt>{{ 'common.source' | t }}</dt><dd>{{ 'leads.sources.' + c.source | t }}</dd>
                <dt>{{ 'common.created' | t }}</dt><dd>{{ c.created_at | dt }}</dd>
                @for (f of customFields(); track f.id) {
                  <dt>{{ f.label }}</dt><dd>{{ display(c.custom_fields[f.key]) }}</dd>
                }
              </dl>
              @if (c.notes) { <div class="card-body" style="border-top:1px solid var(--border);white-space:pre-wrap">{{ c.notes }}</div> }
            </div>

            <div class="card">
              <div class="card-header">
                <h3>{{ 'clients.openTasks' | t }}</h3>
                @if (auth.canWrite()) { <button class="btn sm" (click)="modal.set('task')"><app-icon name="plus" [size]="14" /></button> }
              </div>
              @for (task of tasks(); track task.id) {
                <div class="row" style="padding:10px 20px;border-bottom:1px solid var(--border)">
                  <input type="checkbox" [checked]="task.status === 'done'" (change)="toggleTask(task)" [disabled]="!auth.canWrite()" />
                  <div class="spacer" style="cursor:pointer" (click)="editTask.set(task)">
                    <div [style.text-decoration]="task.status === 'done' ? 'line-through' : null">{{ task.title }}</div>
                    <div class="cell-sub" [style.color]="task.is_overdue ? 'var(--danger)' : null">{{ task.due_at ? (task.due_at | dt) : ('tasks.noDue' | t) }}</div>
                  </div>
                </div>
              } @empty { <div class="empty small">{{ 'common.empty' | t }}</div> }
            </div>

            <div class="card">
              <div class="card-header">
                <h3>{{ 'clients.deals' | t }}</h3>
                @if (auth.canWrite()) { <button class="btn sm" (click)="modal.set('deal')"><app-icon name="plus" [size]="14" /></button> }
              </div>
              @for (deal of deals(); track deal.id) {
                <div class="row" style="padding:10px 20px;border-bottom:1px solid var(--border);cursor:pointer" (click)="editDeal.set(deal)">
                  <div class="spacer"><div class="cell-title">{{ deal.title }}</div><div class="cell-sub">{{ deal.stage?.name }}</div></div>
                  <strong>{{ deal.value | money: deal.currency }}</strong>
                </div>
              } @empty { <div class="empty small">{{ 'common.empty' | t }}</div> }
            </div>
          </div>

          <div class="card span-2">
            <div class="card-header"><h3>{{ 'clients.timeline' | t }}</h3></div>
            <div class="card-body"><app-timeline subjectType="client" [subjectId]="c.id" /></div>
          </div>
        </div>

        @switch (modal()) {
          @case ('edit') { <app-client-form-modal [client]="c" (closed)="modal.set(null)" (saved)="modal.set(null); client.set($event)" /> }
          @case ('task') { <app-task-form-modal [context]="{ client_id: c.id, label: c.name }" (closed)="modal.set(null)" (saved)="modal.set(null); loadTasks()" /> }
          @case ('deal') { <app-deal-form-modal [stages]="stages()" [clientId]="c.id" (closed)="modal.set(null)" (saved)="modal.set(null); loadDeals()" /> }
        }
        @if (editTask(); as task) { <app-task-form-modal [task]="task" (closed)="editTask.set(null)" (saved)="editTask.set(null); loadTasks()" /> }
        @if (editDeal(); as deal) { <app-deal-form-modal [deal]="deal" [stages]="stagesFor(deal)" (closed)="editDeal.set(null)" (saved)="editDeal.set(null); loadDeals()" /> }
      }
    </div>
  `,
})
export class ClientDetailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  readonly id = input.required<string>();

  protected readonly client = signal<Client | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly deals = signal<Deal[]>([]);
  protected readonly pipelines = signal<Pipeline[]>([]);
  protected readonly stages = signal<Pipeline['stages']>([]);
  protected readonly customFields = signal<CustomField[]>([]);
  protected readonly modal = signal<'edit' | 'task' | 'deal' | null>(null);
  protected readonly editTask = signal<Task | null>(null);
  protected readonly editDeal = signal<Deal | null>(null);

  statusClass = clientStatusClass;

  ngOnInit(): void {
    this.api.get<{ data: Client }>(`clients/${this.id()}`).subscribe({
      next: (res) => this.client.set(res.data),
      error: () => void this.router.navigateByUrl('/clients'),
    });
    this.loadTasks();
    this.loadDeals();
    this.api.get<{ data: Pipeline[] }>('pipelines').subscribe((res) => {
      this.pipelines.set(res.data);
      this.stages.set((res.data.find((p) => p.is_default) ?? res.data[0])?.stages ?? []);
    });
    this.api.get<{ data: CustomField[] }>('custom-fields').subscribe((res) => this.customFields.set(res.data));
  }

  loadTasks(): void {
    this.api.get<{ data: Task[] }>('tasks', { client_id: this.id(), per_page: 50 }).subscribe((res) => this.tasks.set(res.data));
  }

  loadDeals(): void {
    this.api.get<{ data: Deal[] }>('deals', { client_id: this.id() }).subscribe((res) => this.deals.set(res.data));
  }

  stagesFor(deal: Deal): Pipeline['stages'] {
    return this.pipelines().find((p) => p.id === deal.pipeline_id)?.stages ?? this.stages();
  }

  toggleTask(task: Task): void {
    this.api.patch(`tasks/${task.id}`, { status: task.status === 'done' ? 'open' : 'done' }).subscribe(() => this.loadTasks());
  }

  display(value: unknown): string {
    if (value === true) return this.i18n.t('common.yes');
    if (value === false) return this.i18n.t('common.no');
    return value === null || value === undefined || value === '' ? '–' : String(value);
  }

  remove(client: Client): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`clients/${client.id}`).subscribe(() => {
        this.toast.success(this.i18n.t('common.deleted'));
        void this.router.navigateByUrl('/clients');
      });
    }
  }
}
