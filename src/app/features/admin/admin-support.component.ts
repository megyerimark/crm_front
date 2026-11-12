import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Paginated, SupportTicket } from '../../core/models';
import { UI } from '../../shared/ui';
import { TICKET_PRIORITY_CLASS, TICKET_STATUS_CLASS } from '../support/support.page';

/** Staff queue: open tickets first, then by priority (Business > Pro > Free), oldest waiting first. */
@Component({
  selector: 'app-admin-support',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .layout { display: grid; grid-template-columns: 420px 1fr; gap: 20px; align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .item { padding: 14px 18px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .item:hover, .item.active { background: var(--surface-2); }
    .item.active { box-shadow: inset 3px 0 0 var(--primary); }
    .thread { display: flex; flex-direction: column; gap: 14px; }
    .msg { max-width: 85%; padding: 12px 14px; border-radius: 14px; background: var(--surface-3); white-space: pre-wrap; }
    .msg.staff { align-self: flex-end; background: var(--primary-soft); }
    .msg .meta { font-size: 12px; color: var(--text-3); margin-bottom: 4px; }
  `],
  template: `
    <div class="layout">
      <div class="card">
        <div class="toolbar">
          <div class="segmented" style="flex-wrap:wrap">
            @for (s of ['', 'open', 'pending', 'answered', 'closed']; track s) {
              <button [class.active]="status === s" (click)="status = s; load()">{{ s ? ('support.statuses.' + s | t) : ('common.all' | t) }} @if (s && counts()[s]) { ({{ counts()[s] }}) }</button>
            }
          </div>
        </div>
        @for (t of page()?.data ?? []; track t.id) {
          <div class="item" [class.active]="selected()?.id === t.id" (click)="open(t.id)">
            <div class="row between"><strong class="truncate">#{{ t.id }} {{ t.subject }}</strong><span class="badge" [class]="'badge ' + priorityClass[t.priority]">{{ 'support.priorities.' + t.priority | t }}</span></div>
            <div class="row wrap mt-sm">
              <span class="badge" [class]="'badge ' + statusClass[t.status]">{{ 'support.statuses.' + t.status | t }}</span>
              <span class="subtle truncate">{{ t.workspace?.name }} · {{ t.plan ? ('plan.' + t.plan | t) : '' }} · {{ t.updated_at | dt: 'relative' }}</span>
            </div>
          </div>
        } @empty { <app-empty-state illustration="activity" [compact]="true" [title]="'empty.noResultsTitle' | t" /> }
      </div>

      <div class="card">
        @if (selected(); as t) {
          <div class="card-header">
            <div><h3>#{{ t.id }} {{ t.subject }}</h3><span class="subtle">{{ t.user?.name }} &lt;{{ t.user?.email }}&gt; · {{ t.workspace?.name }} · {{ 'support.categories.' + t.category | t }}</span></div>
            <div class="row">
              <select class="select sm" style="width:auto" [ngModel]="t.priority" (ngModelChange)="update(t, { priority: $event })" [attr.aria-label]="'platform.setPriority' | t">
                @for (p of priorities; track p) { <option [value]="p">{{ 'support.priorities.' + p | t }}</option> }
              </select>
              <select class="select sm" style="width:auto" [ngModel]="t.status" (ngModelChange)="update(t, { status: $event })" [attr.aria-label]="'platform.setStatus' | t">
                @for (s of statuses; track s) { <option [value]="s">{{ 'support.statuses.' + s | t }}</option> }
              </select>
            </div>
          </div>
          <div class="card-body thread">
            @for (m of t.messages ?? []; track m.id) {
              <div class="msg" [class.staff]="m.is_staff"><div class="meta">{{ m.author }} · {{ m.created_at | dt }}</div>{{ m.body }}</div>
            }
          </div>
          <form class="card-body stack" style="border-top:1px solid var(--border)" (ngSubmit)="reply(t, 'answered')">
            <textarea class="textarea" name="reply" rows="5" [(ngModel)]="replyText" [placeholder]="'support.replyPlaceholder' | t"></textarea>
            <div class="row end">
              <button class="btn" type="button" [disabled]="!replyText.trim()" (click)="reply(t, 'closed')">{{ 'platform.replyAndClose' | t }}</button>
              <button class="btn primary" type="submit" [disabled]="!replyText.trim()">{{ 'support.reply' | t }}</button>
            </div>
          </form>
        } @else {
          <app-empty-state illustration="activity" [title]="'support.title' | t" />
        }
      </div>
    </div>
  `,
})
export class AdminSupportComponent {
  private readonly api = inject(ApiService);
  readonly initialTicket = input<number | null>(null);
  protected readonly statusClass = TICKET_STATUS_CLASS;
  protected readonly priorityClass = TICKET_PRIORITY_CLASS;
  protected readonly priorities = ['low', 'normal', 'high', 'urgent'];
  protected readonly statuses = ['open', 'pending', 'answered', 'closed'];
  protected readonly page = signal<Paginated<SupportTicket> | null>(null);
  protected readonly counts = signal<Record<string, number>>({});
  protected readonly selected = signal<SupportTicket | null>(null);
  protected status = '';
  protected replyText = '';

  ngOnInit(): void {
    this.load();
    if (this.initialTicket()) this.open(this.initialTicket()!);
  }

  load(): void {
    this.api.get<Paginated<SupportTicket> & { counts: Record<string, number> }>('admin/support/tickets', { status: this.status, per_page: 50 }).subscribe((res) => {
      this.page.set(res);
      this.counts.set(res.counts);
    });
  }

  open(id: number): void {
    this.api.get<{ data: SupportTicket }>(`admin/support/tickets/${id}`).subscribe((res) => this.selected.set(res.data));
  }

  reply(ticket: SupportTicket, status: 'answered' | 'closed'): void {
    this.api.post<{ data: SupportTicket }>(`admin/support/tickets/${ticket.id}/messages`, { body: this.replyText, status }).subscribe((res) => {
      this.replyText = '';
      this.selected.set(res.data);
      this.load();
    });
  }

  update(ticket: SupportTicket, changes: Record<string, string>): void {
    this.api.patch<{ data: SupportTicket }>(`admin/support/tickets/${ticket.id}`, changes).subscribe((res) => {
      this.selected.set(res.data);
      this.load();
    });
  }
}
