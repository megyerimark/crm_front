import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { Task } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI, fromLocalInput, toLocalInput } from '../../shared/ui';

export interface TaskContext {
  client_id?: number | null;
  lead_id?: number | null;
  deal_id?: number | null;
  due_at?: string | null;
  label?: string;
}

@Component({
  selector: 'app-task-form-modal',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="(task() ? 'tasks.edit' : 'tasks.new') | t" (closed)="closed.emit()">
      <form id="task-form" class="form-grid" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'common.title' | t }} *</label>
          <input class="input" name="title" [(ngModel)]="form.title" required [class.invalid]="errors()['title']" />
          @if (errors()['title']) { <span class="error-text">{{ errors()['title'] }}</span> }
        </div>
        <div class="field"><label>{{ 'tasks.due' | t }}</label><input class="input" type="datetime-local" name="due" [(ngModel)]="due" /></div>
        <div class="field">
          <label>{{ 'tasks.priority' | t }}</label>
          <select class="select" name="priority" [(ngModel)]="form.priority">
            @for (p of priorities; track p) { <option [value]="p">{{ 'tasks.priorities.' + p | t }}</option> }
          </select>
        </div>
        <div class="field">
          <label>{{ 'tasks.assignee' | t }}</label>
          <select class="select" name="assignee_id" [(ngModel)]="form.assignee_id">
            <option [ngValue]="null">{{ 'common.unassigned' | t }}</option>
            @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>{{ 'common.status' | t }}</label>
          <select class="select" name="status" [(ngModel)]="form.status">
            @for (s of statuses; track s) { <option [value]="s">{{ 'tasks.statuses.' + s | t }}</option> }
          </select>
        </div>
        @if (relatedLabel()) {
          <div class="field full"><label>{{ 'tasks.related' | t }}</label><div class="muted">{{ relatedLabel() }}</div></div>
        }
        <div class="field full"><label>{{ 'common.description' | t }}</label><textarea class="textarea" name="description" [(ngModel)]="form.description"></textarea></div>
      </form>
      <div footer class="modal-footer">
        @if (task()) { <button class="btn danger" type="button" (click)="remove()">{{ 'common.delete' | t }}</button><span class="spacer"></span> }
        <button class="btn" type="button" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
        <button class="btn primary" type="submit" form="task-form" [disabled]="busy()">{{ 'common.save' | t }}</button>
      </div>
    </app-modal>
  `,
})
export class TaskFormModal {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly members = inject(MembersService);

  readonly task = input<Task | null>(null);
  readonly context = input<TaskContext>({});
  readonly closed = output<void>();
  readonly saved = output<Task | null>();

  protected readonly priorities = ['low', 'normal', 'high', 'urgent'];
  protected readonly statuses = ['open', 'in_progress', 'done'];
  protected form: Partial<Task> = {};
  protected due = '';
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.members.load();
    const task = this.task();
    const ctx = this.context();
    this.form = task ? { ...task } : { priority: 'normal', status: 'open', assignee_id: this.auth.user()?.id ?? null, client_id: ctx.client_id ?? null, lead_id: ctx.lead_id ?? null, deal_id: ctx.deal_id ?? null };
    this.due = toLocalInput(task?.due_at ?? ctx.due_at ?? null);
  }

  relatedLabel(): string {
    const task = this.task();
    return task?.client?.name ?? task?.lead?.name ?? task?.deal?.title ?? this.context().label ?? '';
  }

  save(): void {
    this.busy.set(true);
    const payload = {
      title: this.form.title, description: this.form.description, priority: this.form.priority, status: this.form.status,
      assignee_id: this.form.assignee_id, due_at: fromLocalInput(this.due), client_id: this.form.client_id, lead_id: this.form.lead_id, deal_id: this.form.deal_id,
    };
    const task = this.task();
    const request = task ? this.api.patch<{ data: Task }>(`tasks/${task.id}`, payload) : this.api.post<{ data: Task }>('tasks', payload);
    request.subscribe({
      next: (res) => {
        this.toast.success(this.i18n.t('common.saved'));
        this.saved.emit(res.data);
      },
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }

  remove(): void {
    const task = this.task();
    if (task && confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`tasks/${task.id}`).subscribe(() => this.saved.emit(null));
    }
  }
}
