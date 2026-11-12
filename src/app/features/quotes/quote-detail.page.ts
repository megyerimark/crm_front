import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { errorMessage, fieldErrors } from '../../core/interceptors';
import { Quote } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { fromLocalInput, toLocalInput, UI } from '../../shared/ui';
import { QUOTE_EVENT_ICON, QUOTE_STATUS_CLASS } from './quote-status';

/** One quote: the document as the customer sees it, tracking numbers, timeline and the follow-up controls. */
@Component({
  selector: 'app-quote-detail-page',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .doc-items { width: 100%; border-collapse: collapse; font-size: 14px; }
    .doc-items th { text-align: left; font-size: 12px; color: var(--text-3); font-weight: 600; padding: 8px; border-bottom: 1px solid var(--border); }
    .doc-items td { padding: 10px 8px; border-bottom: 1px solid var(--border); }
    .doc-items .r { text-align: right; white-space: nowrap; }
    .sum { display: grid; gap: 6px; max-width: 320px; margin-left: auto; margin-top: 16px; }
    .sum .row { justify-content: space-between; }
    .sum .grand { font-size: 18px; font-weight: 700; border-top: 1px solid var(--border); padding-top: 8px; }
    .pre { white-space: pre-wrap; }
    .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 14px; }
    .metric:last-child { border-bottom: 0; }
    .ev { display: grid; grid-template-columns: 30px 1fr; gap: 10px; padding: 8px 0; }
    .ev .ic { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-3); color: var(--text-2); }
    .ev .ic.viewed { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #b45309; }
    .ev .ic.accepted, .ev .ic.marked_accepted { background: var(--success-soft); color: var(--success); }
    .ev .ic.declined, .ev .ic.marked_declined { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
    .ev .ic.sent, .ev .ic.resent { background: var(--primary-soft); color: var(--primary); }
    .actions { flex-wrap: wrap; }
  `],
  template: `
    @if (quote(); as q) {
      <div class="page">
        <div class="page-header">
          <div>
            <a class="subtle small" routerLink="/quotes"><app-icon name="chevronLeft" [size]="14" /> {{ 'quotes.title' | t }}</a>
            <h1>{{ q.title }}</h1>
            <div class="row wrap mt-sm">
              <span class="badge" [class]="'badge ' + statusClass[q.status]">{{ 'quotes.statuses.' + q.status | t }}</span>
              <span class="subtle">{{ q.number }}</span>
              @if (q.client) { <a class="subtle" [routerLink]="['/clients', q.client.id]">· {{ q.client.name }}</a> }
              @if (q.lead) { <a class="subtle" [routerLink]="['/leads', q.lead.id]">· {{ q.lead.name }}</a> }
              @if (q.deal) { <a class="subtle" routerLink="/pipeline">· {{ q.deal.title }}</a> }
            </div>
          </div>
          @if (auth.canWrite()) {
            <div class="row actions">
              @if (q.status === 'draft') {
                <a class="btn" [routerLink]="['/quotes', q.id, 'edit']"><app-icon name="edit" [size]="16" /> {{ 'common.edit' | t }}</a>
              }
              @if (q.public_url) {
                <button class="btn" type="button" (click)="copyLink(q)"><app-icon name="link" [size]="16" /> {{ 'quotes.copyLink' | t }}</button>
                <a class="btn" [href]="q.public_url + '?preview=1'" target="_blank" rel="noopener"><app-icon name="eye" [size]="16" /> {{ 'quotes.preview' | t }}</a>
              }
              <button class="btn" type="button" (click)="duplicate(q)"><app-icon name="copy" [size]="16" /> {{ 'quotes.duplicate' | t }}</button>
              @if (canSend(q)) {
                <button class="btn primary" type="button" (click)="openSend(q)"><app-icon name="send" [size]="16" /> {{ (q.sent_at ? 'quotes.resend' : 'quotes.send') | t }}</button>
              }
            </div>
          }
        </div>

        @if (q.status === 'draft') { <div class="banner info mb">{{ 'quotes.draftHint' | t }}</div> }
        @if (q.status === 'accepted') { <div class="banner success mb"><app-icon name="check" [size]="16" /> {{ 'quotes.events.' + (q.events?.[0]?.type === 'marked_accepted' ? 'marked_accepted' : 'accepted') | t }}: <strong>{{ q.accepted_by_name }}</strong> · {{ q.accepted_at | dt }}</div> }
        @if (q.status === 'declined') { <div class="banner danger mb">{{ 'quotes.statuses.declined' | t }} · {{ q.declined_at | dt }}@if (q.decline_reason) { — „{{ q.decline_reason }}” }</div> }

        <div class="layout">
          <div class="card">
            <div class="card-body stack">
              <div class="row between wrap">
                <div><div class="stat-label">{{ 'quotes.recipient' | t }}</div><strong>{{ q.recipient_name ?? '–' }}</strong><div class="subtle">{{ q.recipient_email }}</div></div>
                <div class="right"><div class="stat-label">{{ 'quotes.validUntil' | t }}</div><strong>{{ q.valid_until | dt: 'date' }}</strong></div>
              </div>
              @if (q.introduction) { <p class="pre muted">{{ q.introduction }}</p> }
              <div class="table-wrap">
                <table class="doc-items">
                  <thead><tr><th>{{ 'quotes.description' | t }}</th><th class="r">{{ 'quotes.quantity' | t }}</th><th class="r">{{ 'quotes.unitPrice' | t }}</th><th class="r">{{ 'quotes.vat' | t }}</th><th class="r">{{ 'quotes.net' | t }}</th></tr></thead>
                  <tbody>
                    @for (item of q.items ?? []; track item.id) {
                      <tr>
                        <td>{{ item.description }}</td>
                        <td class="r">{{ item.quantity | num }} {{ item.unit }}</td>
                        <td class="r">{{ item.unit_price | money: q.currency }}</td>
                        <td class="r">{{ item.vat_rate }}%</td>
                        <td class="r"><strong>{{ item.net_amount | money: q.currency }}</strong></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="subtle">–</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="sum">
                <div class="row"><span class="muted">{{ 'quotes.net_total' | t }}</span><span>{{ q.net_total | money: q.currency }}</span></div>
                <div class="row"><span class="muted">{{ 'quotes.vat_total' | t }}</span><span>{{ q.vat_total | money: q.currency }}</span></div>
                <div class="row grand"><span>{{ 'quotes.gross_total' | t }}</span><span>{{ q.gross_total | money: q.currency }}</span></div>
              </div>
              @if (q.terms) { <div><div class="stat-label">{{ 'quotes.terms' | t }}</div><p class="pre small muted">{{ q.terms }}</p></div> }
            </div>
          </div>

          <div class="stack">
            <div class="card">
              <div class="card-header"><h3>{{ 'quotes.tracking' | t }}</h3></div>
              <div class="card-body">
                <div class="metric"><span class="muted">{{ 'quotes.sentAt' | t }}</span><span>{{ q.sent_at ? (q.sent_at | dt) : '–' }}</span></div>
                <div class="metric"><span class="muted">{{ 'quotes.views' | t }}</span><strong>{{ q.view_count }}</strong></div>
                <div class="metric"><span class="muted">{{ 'quotes.firstViewed' | t }}</span><span>{{ q.first_viewed_at ? (q.first_viewed_at | dt) : (q.sent_at ? ('quotes.notViewed' | t) : '–') }}</span></div>
                <div class="metric"><span class="muted">{{ 'quotes.lastViewed' | t }}</span><span>{{ q.last_viewed_at ? (q.last_viewed_at | dt: 'relative') : '–' }}</span></div>
              </div>
            </div>

            @if (q.status === 'sent' || q.status === 'viewed') {
              <div class="card">
                <div class="card-header"><h3>{{ 'quotes.followUp' | t }}</h3></div>
                <div class="card-body stack">
                  @if (!auth.feature('quote_follow_ups')) { <div class="banner gold small"><app-icon name="lock" [size]="13" /> {{ 'quotes.followUpPro' | t }}</div> }
                  <div class="field">
                    <label for="q_follow">{{ 'quotes.followUpAt' | t }}</label>
                    <input class="input" id="q_follow" type="datetime-local" name="follow_up_at" [(ngModel)]="followUpAt" [disabled]="!auth.canWrite()" />
                    <span class="hint">{{ q.follow_up_at ? '' : ('quotes.followUpNone' | t) }}{{ q.follow_up_count ? ('quotes.followUpCount' | t: { count: q.follow_up_count }) : '' }}</span>
                  </div>
                  @if (auth.canWrite()) {
                    <button class="btn sm" type="button" (click)="saveFollowUp(q)">{{ 'common.save' | t }}</button>
                    <div class="row wrap">
                      <button class="btn sm" type="button" (click)="openMark('accepted')"><app-icon name="check" [size]="14" /> {{ 'quotes.markAccepted' | t }}</button>
                      <button class="btn ghost sm" type="button" (click)="openMark('declined')"><app-icon name="x" [size]="14" /> {{ 'quotes.markDeclined' | t }}</button>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="card">
              <div class="card-header"><h3>{{ 'quotes.timeline' | t }}</h3></div>
              <div class="card-body">
                @for (e of q.events ?? []; track e.id) {
                  <div class="ev">
                    <span class="ic" [class]="'ic ' + e.type"><app-icon [name]="eventIcon[e.type] ?? 'activity'" [size]="14" /></span>
                    <div>
                      <strong class="small">{{ 'quotes.events.' + e.type | t }}</strong>
                      <div class="subtle small">{{ e.created_at | dt }}{{ e.user ? ' · ' + e.user : '' }}{{ e.meta?.['email'] ? ' · ' + e.meta?.['email'] : '' }}</div>
                      @if (e.meta?.['reason']) { <div class="small muted">„{{ e.meta?.['reason'] }}”</div> }
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (auth.canWrite()) {
              <button class="btn ghost danger sm" type="button" (click)="remove(q)"><app-icon name="trash" [size]="14" /> {{ 'quotes.delete' | t }}</button>
            }
          </div>
        </div>
      </div>

      @if (sending()) {
        <app-modal [title]="'quotes.sendTitle' | t" (closed)="sending.set(false)">
          <form class="stack" (ngSubmit)="send(q)" novalidate>
            <div class="field">
              <label for="s_email">{{ 'quotes.recipientEmail' | t }} *</label>
              <input class="input" id="s_email" type="email" name="email" [(ngModel)]="sendForm.email" [class.invalid]="sendErrors()['email']" />
              @if (sendErrors()['email']) { <span class="error-text">{{ sendErrors()['email'] }}</span> }
            </div>
            <div class="field"><label for="s_name">{{ 'quotes.recipientName' | t }}</label><input class="input" id="s_name" name="name" [(ngModel)]="sendForm.name" /></div>
            <div class="field"><label for="s_msg">{{ 'quotes.message' | t }}</label><textarea class="textarea" id="s_msg" name="message" rows="4" [(ngModel)]="sendForm.message" [placeholder]="'quotes.messagePlaceholder' | t"></textarea></div>
            @for (key of ['items', 'valid_until', 'status']; track key) { @if (sendErrors()[key]) { <div class="banner danger">{{ sendErrors()[key] }}</div> } }
            <div class="row end">
              <button class="btn ghost" type="button" (click)="sending.set(false)">{{ 'common.cancel' | t }}</button>
              <button class="btn primary" type="submit" [disabled]="busy()"><app-icon name="send" [size]="15" /> {{ 'quotes.send' | t }}</button>
            </div>
          </form>
        </app-modal>
      }

      @if (marking(); as status) {
        <app-modal [title]="(status === 'accepted' ? 'quotes.markTitleAccepted' : 'quotes.markTitleDeclined') | t" (closed)="marking.set(null)">
          <form class="stack" (ngSubmit)="mark(q, status)">
            <p class="muted small">{{ 'quotes.markHint' | t }}</p>
            @if (status === 'accepted') {
              <div class="field"><label for="m_name">{{ 'quotes.acceptedBy' | t }}</label><input class="input" id="m_name" name="name" [(ngModel)]="markForm.name" /></div>
            } @else {
              <div class="field"><label for="m_reason">{{ 'quotes.reason' | t }}</label><textarea class="textarea" id="m_reason" name="reason" rows="3" [(ngModel)]="markForm.reason"></textarea></div>
            }
            <div class="row end">
              <button class="btn ghost" type="button" (click)="marking.set(null)">{{ 'common.cancel' | t }}</button>
              <button class="btn primary" type="submit" [disabled]="busy()">{{ 'common.save' | t }}</button>
            </div>
          </form>
        </app-modal>
      }
    } @else {
      <div class="page"><div class="card"><div class="card-body"><div class="skeleton" style="width:40%;height:28px"></div><div class="skeleton mt" style="height:200px"></div></div></div></div>
    }
  `,
})
export class QuoteDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected readonly statusClass = QUOTE_STATUS_CLASS;
  protected readonly eventIcon = QUOTE_EVENT_ICON;
  protected readonly quote = signal<Quote | null>(null);
  protected readonly sending = signal(false);
  protected readonly marking = signal<'accepted' | 'declined' | null>(null);
  protected readonly busy = signal(false);
  protected readonly sendErrors = signal<Record<string, string>>({});
  protected sendForm = { email: '', name: '', message: '' };
  protected markForm = { name: '', reason: '' };
  protected followUpAt = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => this.load(Number(params.get('id'))));
  }

  canSend(q: Quote): boolean {
    return q.status === 'draft' || q.status === 'sent' || q.status === 'viewed' || q.status === 'expired';
  }

  openSend(q: Quote): void {
    this.sendForm = { email: q.recipient_email ?? '', name: q.recipient_name ?? '', message: '' };
    this.sendErrors.set({});
    this.sending.set(true);
  }

  send(q: Quote): void {
    this.busy.set(true);
    this.api.post<{ data: Quote }>(`quotes/${q.id}/send`, { email: this.sendForm.email, name: this.sendForm.name || null, message: this.sendForm.message || null }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.sending.set(false);
        this.set(res.data);
        this.toast.success(this.i18n.t('quotes.sentToast', { email: res.data.recipient_email ?? '' }));
      },
      error: (err) => {
        this.busy.set(false);
        this.sendErrors.set(fieldErrors(err));
      },
    });
  }

  openMark(status: 'accepted' | 'declined'): void {
    this.markForm = { name: this.quote()?.recipient_name ?? '', reason: '' };
    this.marking.set(status);
  }

  mark(q: Quote, status: 'accepted' | 'declined'): void {
    this.busy.set(true);
    this.api.post<{ data: Quote }>(`quotes/${q.id}/mark`, { status, name: this.markForm.name || null, reason: this.markForm.reason || null }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.marking.set(null);
        this.set(res.data);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(errorMessage(err, this.i18n.t('errors.server')));
      },
    });
  }

  saveFollowUp(q: Quote): void {
    this.api.patch<{ data: Quote }>(`quotes/${q.id}`, { follow_up_at: fromLocalInput(this.followUpAt) }).subscribe((res) => {
      this.set(res.data);
      this.toast.success(this.i18n.t('quotes.followUpSet'));
    });
  }

  copyLink(q: Quote): void {
    if (q.public_url) {
      void navigator.clipboard?.writeText(q.public_url).then(() => this.toast.success(this.i18n.t('quotes.linkCopied')));
    }
  }

  duplicate(q: Quote): void {
    this.api.post<{ data: Quote }>(`quotes/${q.id}/duplicate`).subscribe((res) => {
      this.toast.success(this.i18n.t('quotes.duplicated'));
      void this.router.navigate(['/quotes', res.data.id, 'edit']);
    });
  }

  remove(q: Quote): void {
    if (confirm(this.i18n.t('quotes.deleteConfirm'))) {
      this.api.delete(`quotes/${q.id}`).subscribe(() => void this.router.navigate(['/quotes']));
    }
  }

  private load(id: number): void {
    this.quote.set(null);
    this.api.get<{ data: Quote }>(`quotes/${id}`).subscribe((res) => this.set(res.data));
  }

  private set(q: Quote): void {
    this.quote.set(q);
    this.followUpAt = toLocalInput(q.follow_up_at);
  }
}
