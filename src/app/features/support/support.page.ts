import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { Paginated, SupportTicket } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

export const TICKET_STATUS_CLASS: Record<string, string> = { open: 'warning', answered: 'success', pending: 'info', closed: '' };
export const TICKET_PRIORITY_CLASS: Record<string, string> = { low: '', normal: 'info', high: 'gold', urgent: 'danger' };

/** Customer side of the Support Center: own requests, conversation and new request form. */
@Component({
  selector: 'app-support-page',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .item { padding: 14px 18px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .item:hover, .item.active { background: var(--surface-2); }
    .item.active { box-shadow: inset 3px 0 0 var(--primary); }
    .thread { display: flex; flex-direction: column; gap: 14px; }
    .msg { max-width: 82%; padding: 12px 14px; border-radius: 14px; background: var(--surface-3); white-space: pre-wrap; }
    .msg.mine { align-self: flex-end; background: var(--primary-soft); }
    .msg.staff { border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border)); background: var(--surface); }
    .msg .meta { font-size: 12px; color: var(--text-3); margin-bottom: 4px; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'support.title' | t }}</h1><p>{{ 'support.subtitle' | t }}</p></div>
        @if (auth.canWrite()) { <button class="btn primary" (click)="startNew()"><app-icon name="plus" [size]="16" /> {{ 'support.new' | t }}</button> }
      </div>

      <div class="layout">
        <div class="card">
          @for (t of tickets(); track t.id) {
            <div class="item" [class.active]="selected()?.id === t.id" (click)="open(t.id)">
              <div class="row between"><strong class="truncate">#{{ t.id }} {{ t.subject }}</strong></div>
              <div class="row wrap mt-sm">
                <span class="badge" [class]="'badge ' + statusClass[t.status]">{{ 'support.statuses.' + t.status | t }}</span>
                <span class="subtle">{{ 'support.categories.' + t.category | t }} · {{ t.updated_at | dt: 'relative' }}</span>
              </div>
            </div>
          } @empty {
            <app-empty-state illustration="activity" [compact]="true" [title]="'support.empty' | t" />
          }
        </div>

        <div class="card">
          @if (creating()) {
            <div class="card-header"><h3>{{ 'support.new' | t }}</h3></div>
            <form class="card-body stack" (ngSubmit)="create()">
              <div class="field"><label>{{ 'support.subject' | t }}</label><input class="input" name="subject" [(ngModel)]="form.subject" maxlength="200" required /></div>
              <div class="field">
                <label>{{ 'support.category' | t }}</label>
                <select class="select" name="category" [(ngModel)]="form.category">
                  @for (c of categories; track c) { <option [value]="c">{{ 'support.categories.' + c | t }}</option> }
                </select>
              </div>
              <div class="field"><label>{{ 'support.message' | t }}</label><textarea class="textarea" name="message" rows="8" [(ngModel)]="form.message" required></textarea></div>
              @for (e of errors(); track e) { <span class="error-text">{{ e }}</span> }
              <div class="row end"><button class="btn primary" type="submit" [disabled]="busy()">{{ 'support.send' | t }}</button></div>
            </form>
          } @else if (selected(); as t) {
            <div class="card-header">
              <div><h3>#{{ t.id }} {{ t.subject }}</h3><span class="subtle">{{ 'support.categories.' + t.category | t }} · {{ t.created_at | dt }}</span></div>
              <div class="row">
                <span class="badge" [class]="'badge ' + priorityClass[t.priority]">{{ 'support.priorities.' + t.priority | t }}</span>
                <span class="badge" [class]="'badge ' + statusClass[t.status]">{{ 'support.statuses.' + t.status | t }}</span>
              </div>
            </div>
            <div class="card-body thread">
              @for (m of t.messages ?? []; track m.id) {
                <div class="msg" [class.staff]="m.is_staff" [class.mine]="!m.is_staff">
                  <div class="meta">{{ m.is_staff ? ('support.staff' | t) : m.author }} · {{ m.created_at | dt }}</div>{{ m.body }}
                </div>
              }
            </div>
            @if (t.status !== 'closed' && auth.canWrite()) {
              <form class="card-body stack" style="border-top:1px solid var(--border)" (ngSubmit)="reply(t)">
                <textarea class="textarea" name="reply" [(ngModel)]="replyText" [placeholder]="'support.replyPlaceholder' | t"></textarea>
                <div class="row end">
                  <button class="btn ghost" type="button" (click)="close(t)">{{ 'support.close' | t }}</button>
                  <button class="btn primary" type="submit" [disabled]="!replyText.trim() || busy()">{{ 'support.reply' | t }}</button>
                </div>
              </form>
            } @else if (t.status === 'closed') {
              <div class="card-body subtle" style="border-top:1px solid var(--border)">{{ 'support.closed' | t }}</div>
            }
          } @else {
            <app-empty-state illustration="activity" [title]="'support.subtitle' | t">
              @if (auth.canWrite()) { <button class="btn primary" (click)="startNew()">{{ 'support.new' | t }}</button> }
            </app-empty-state>
          }
        </div>
      </div>
    </div>
  `,
})
export class SupportPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  protected readonly categories = ['question', 'bug', 'billing', 'feature', 'account'];
  protected readonly statusClass = TICKET_STATUS_CLASS;
  protected readonly priorityClass = TICKET_PRIORITY_CLASS;
  protected readonly tickets = signal<SupportTicket[]>([]);
  protected readonly selected = signal<SupportTicket | null>(null);
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected form = { subject: '', category: 'question', message: '' };
  protected replyText = '';

  ngOnInit(): void {
    this.load();
    const id = Number(this.route.snapshot.queryParamMap.get('ticket'));
    if (id) this.open(id);
  }

  load(): void {
    this.api.get<Paginated<SupportTicket>>('support/tickets', { per_page: 50 }).subscribe((res) => this.tickets.set(res.data));
  }

  startNew(): void {
    this.creating.set(true);
    this.selected.set(null);
    this.errors.set([]);
  }

  open(id: number): void {
    this.creating.set(false);
    this.api.get<{ data: SupportTicket }>(`support/tickets/${id}`).subscribe((res) => this.selected.set(res.data));
  }

  create(): void {
    this.busy.set(true);
    this.api.post<{ data: SupportTicket }>('support/tickets', this.form).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.form = { subject: '', category: 'question', message: '' };
        this.creating.set(false);
        this.selected.set(res.data);
        this.toast.success(this.i18n.t('support.sent') + ' ' + this.i18n.t('support.priorityNote', { priority: this.i18n.t('support.priorities.' + res.data.priority).toLowerCase() }));
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.errors.set(Object.values(fieldErrors(err)));
      },
    });
  }

  reply(ticket: SupportTicket): void {
    this.busy.set(true);
    this.api.post<{ data: SupportTicket }>(`support/tickets/${ticket.id}/messages`, { body: this.replyText }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.replyText = '';
        this.selected.set(res.data);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  close(ticket: SupportTicket): void {
    this.api.post<{ data: SupportTicket }>(`support/tickets/${ticket.id}/close`).subscribe((res) => {
      this.selected.set(res.data);
      this.load();
    });
  }
}
