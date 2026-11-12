import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Paginated, Quote, QuoteStats } from '../../core/models';
import { UI } from '../../shared/ui';
import { QUOTE_STATUS_CLASS } from './quote-status';

type QuotePage = Paginated<Quote> & { stats: QuoteStats };

/** Quote tracking: pipeline numbers on top, status tabs and the list with view tracking. */
@Component({
  selector: 'app-quotes-page',
  imports: [FormsModule, RouterLink, LowerCasePipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .views { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 12.5px; }
    .views.seen { color: var(--gold, #b7791f); font-weight: 600; }
    .due { color: var(--danger); font-weight: 600; }
    .tabs { margin: 0 0 -1px; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'quotes.title' | t }}</h1><p>{{ 'quotes.subtitle' | t }}</p></div>
        @if (auth.canWrite()) { <a class="btn primary" routerLink="/quotes/new"><app-icon name="plus" [size]="16" /> {{ 'quotes.new' | t }}</a> }
      </div>

      @if (page()?.stats; as s) {
        <div class="grid grid-4 mb">
          <div class="card kpi">
            <span class="stat-label">{{ 'quotes.awaitingValue' | t }}</span><span class="kpi-icon"><app-icon name="send" /></span>
            <span class="stat-value">{{ s.awaiting_value | money }}</span>
            <span class="subtle">{{ (s.counts.sent + s.counts.viewed) | num }} {{ 'quotes.title' | t | lowercase }}</span>
          </div>
          <div class="card kpi">
            <span class="stat-label">{{ 'quotes.statuses.viewed' | t }}</span><span class="kpi-icon"><app-icon name="eye" /></span>
            <span class="stat-value">{{ s.counts.viewed | num }}</span>
            <span class="subtle" [class.due]="s.follow_ups_due > 0">{{ s.follow_ups_due | num }} {{ 'quotes.followUpsDue' | t }}</span>
          </div>
          <div class="card kpi">
            <span class="stat-label">{{ 'quotes.acceptedValue' | t }}</span><span class="kpi-icon"><app-icon name="check" /></span>
            <span class="stat-value">{{ s.accepted_value | money }}</span>
            <span class="subtle">{{ s.counts.accepted | num }} {{ 'quotes.statuses.accepted' | t | lowercase }}</span>
          </div>
          <div class="card kpi">
            <span class="stat-label">{{ 'quotes.acceptanceRate' | t }}</span><span class="kpi-icon"><app-icon name="chart" /></span>
            <span class="stat-value">{{ s.acceptance_rate === null ? '–' : s.acceptance_rate + '%' }}</span>
            <span class="subtle">{{ s.counts.declined | num }} {{ 'quotes.statuses.declined' | t | lowercase }} · {{ s.counts.expired | num }} {{ 'quotes.statuses.expired' | t | lowercase }}</span>
          </div>
        </div>
      }

      <div class="card">
        <div class="toolbar">
          <div class="segmented">
            @for (s of tabs; track s) {
              <button [class.active]="status === s" (click)="setStatus(s)">{{ (s === '' ? 'quotes.all' : s === 'awaiting' ? 'quotes.awaiting' : 'quotes.statuses.' + s) | t }}</button>
            }
          </div>
          <span class="spacer"></span>
          <div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'quotes.titleLabel' | t }}</th>
                <th>{{ 'quotes.recipient' | t }}</th>
                <th>{{ 'common.status' | t }}</th>
                <th>{{ 'quotes.tracking' | t }}</th>
                <th class="right">{{ 'quotes.gross_total' | t }}</th>
                <th>{{ 'quotes.validUntil' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (q of page()?.data ?? []; track q.id) {
                <tr class="clickable" (click)="router.navigate(['/quotes', q.id])">
                  <td><div class="cell-title">{{ q.title }}</div><div class="cell-sub">{{ q.number }}{{ q.client ? ' · ' + q.client.name : q.lead ? ' · ' + q.lead.name : '' }}</div></td>
                  <td><div>{{ q.recipient_name ?? '–' }}</div><div class="cell-sub">{{ q.recipient_email }}</div></td>
                  <td><span class="badge" [class]="'badge ' + statusClass[q.status]">{{ 'quotes.statuses.' + q.status | t }}</span></td>
                  <td class="small">
                    @if (q.sent_at) {
                      <span class="views" [class.seen]="q.view_count > 0"><app-icon name="eye" [size]="13" /> {{ q.view_count }}</span>
                      <span class="subtle"> · {{ (q.last_viewed_at ?? q.sent_at) | dt: 'relative' }}</span>
                      @if (isDue(q)) { <div class="due"><app-icon name="bell" [size]="12" /> {{ 'quotes.followUp' | t }}</div> }
                    } @else { <span class="subtle">{{ 'quotes.draftHint' | t }}</span> }
                  </td>
                  <td class="right nowrap"><strong>{{ q.gross_total | money: q.currency }}</strong></td>
                  <td class="subtle nowrap">{{ q.valid_until | dt: 'date' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6">
                  @if (search || status) {
                    <app-empty-state illustration="search" [title]="'empty.noResultsTitle' | t" [text]="'empty.noResultsText' | t" />
                  } @else {
                    <app-empty-state illustration="forms" [title]="'quotes.empty' | t" [text]="'quotes.emptyHint' | t">
                      @if (auth.canWrite()) { <a class="btn primary" routerLink="/quotes/new">{{ 'quotes.new' | t }}</a> }
                    </app-empty-state>
                  }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [meta]="page()?.meta ?? null" (page)="load($event)" (perPage)="perPage = $event; load(1)" />
      </div>
    </div>
  `,
})
export class QuotesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly tabs = ['', 'awaiting', 'draft', 'accepted', 'declined', 'expired'];
  protected readonly statusClass = QUOTE_STATUS_CLASS;
  protected readonly page = signal<QuotePage | null>(null);
  protected readonly search$ = new Subject<void>();
  protected search = '';
  protected status = '';
  protected perPage = 25;

  ngOnInit(): void {
    this.status = this.route.snapshot.queryParamMap.get('status') ?? '';
    this.search$.pipe(debounceTime(300)).subscribe(() => this.load(1));
    this.load(1);
  }

  setStatus(status: string): void {
    this.status = status;
    this.load(1);
  }

  load(page: number): void {
    this.api.get<QuotePage>('quotes', { page, per_page: this.perPage, status: this.status, search: this.search }).subscribe((res) => this.page.set(res));
  }

  isDue(quote: Quote): boolean {
    return (quote.status === 'sent' || quote.status === 'viewed') && !!quote.follow_up_at && new Date(quote.follow_up_at) <= new Date();
  }
}
