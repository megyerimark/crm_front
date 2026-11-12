import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { errorMessage, fieldErrors } from '../../core/interceptors';
import { Locale, PublicQuote } from '../../core/models';
import { LogoComponent } from '../../shared/logo.component';
import { UI } from '../../shared/ui';

/**
 * The page the customer opens from the quote e-mail. The token in the URL is the only credential:
 * the API records the view and accepts or declines only quotes that still await an answer.
 */
@Component({
  selector: 'app-public-quote-page',
  imports: [FormsModule, LogoComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--bg); padding: 32px 16px 48px; }
    .wrap { max-width: 860px; margin: 0 auto; }
    .doc { padding: 40px; }
    .head { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-bottom: 24px; border-bottom: 2px solid var(--primary); }
    .head h1 { font-size: 28px; letter-spacing: -0.02em; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11.5px; font-weight: 700; color: var(--primary); }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px 0; }
    .items { width: 100%; border-collapse: collapse; font-size: 14px; }
    .items th { text-align: left; font-size: 12px; color: var(--text-3); font-weight: 600; padding: 10px 8px; border-bottom: 1px solid var(--border); }
    .items td { padding: 12px 8px; border-bottom: 1px solid var(--border); }
    .items .r { text-align: right; white-space: nowrap; }
    .sum { display: grid; gap: 8px; max-width: 340px; margin: 20px 0 0 auto; }
    .sum .row { justify-content: space-between; }
    .sum .grand { font-size: 22px; font-weight: 800; padding-top: 10px; border-top: 2px solid var(--text); }
    .pre { white-space: pre-wrap; }
    .answer { position: sticky; bottom: 16px; margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end; align-items: center; flex-wrap: wrap; padding: 14px 18px; }
    .answer .total { margin-right: auto; font-weight: 700; font-size: 17px; }
    .foot { text-align: center; margin-top: 24px; font-size: 12px; color: var(--text-3); }
    .cta { background: var(--accent, #f59e0b); border-color: transparent; color: #1f1300; }
    @media (max-width: 640px) {
      .doc { padding: 22px 18px; }
      .parties { grid-template-columns: 1fr; }
      .items .hide-sm { display: none; }
      .answer { gap: 8px; padding: 12px; }
      .answer .total { width: 100%; }
      .answer .btn { flex: 1; justify-content: center; }
      .answer .print-label { display: none; }
      .answer .btn.ghost { flex: 0 0 auto; }
    }
    @media print {
      :host { padding: 0; background: #fff; }
      .answer, .noprint, .foot { display: none !important; }
      .doc { box-shadow: none; border: 0; }
    }
  `],
  template: `
    <div class="wrap">
      @if (unavailable()) {
        <div class="card"><div class="empty">{{ 'publicQuote.unavailable' | t }}</div></div>
      } @else if (quote(); as q) {
        @if (q.status === 'accepted') { <div class="banner success mb noprint"><app-icon name="check" [size]="16" /> {{ 'publicQuote.acceptedBanner' | t: { name: q.accepted_by_name ?? '', date: (q.accepted_at | dt) } }}</div> }
        @if (q.status === 'declined') { <div class="banner mb noprint info">{{ 'publicQuote.declinedBanner' | t }}</div> }
        @if (q.is_expired && q.status !== 'accepted' && q.status !== 'declined') { <div class="banner warning mb noprint">{{ 'publicQuote.expiredBanner' | t }}</div> }

        <article class="card doc">
          <div class="head">
            <div>
              <div class="eyebrow">{{ 'publicQuote.quote' | t }} · {{ q.number }}</div>
              <h1 class="mt-sm">{{ q.title }}</h1>
            </div>
            <div class="right">
              <strong style="font-size:18px">{{ q.company.name }}</strong>
              @if (q.company.address) { <div class="subtle small">{{ q.company.address }}</div> }
              @if (q.company.tax_number) { <div class="subtle small">{{ 'publicQuote.taxNumber' | t }}: {{ q.company.tax_number }}</div> }
            </div>
          </div>

          <div class="parties">
            <div><div class="stat-label">{{ 'publicQuote.for' | t }}</div><strong>{{ q.recipient_name ?? '–' }}</strong></div>
            <div class="right"><div class="stat-label">{{ 'publicQuote.validUntil' | t }}</div><strong>{{ q.valid_until | dt: 'date' }}</strong></div>
          </div>

          @if (q.introduction) { <p class="pre mb">{{ q.introduction }}</p> }

          <table class="items">
            <thead><tr><th>{{ 'quotes.description' | t }}</th><th class="r">{{ 'quotes.quantity' | t }}</th><th class="r hide-sm">{{ 'quotes.unitPrice' | t }}</th><th class="r hide-sm">{{ 'quotes.vat' | t }}</th><th class="r">{{ 'quotes.net' | t }}</th></tr></thead>
            <tbody>
              @for (item of q.items; track $index) {
                <tr>
                  <td>{{ item.description }}</td>
                  <td class="r">{{ item.quantity | num }} {{ item.unit }}</td>
                  <td class="r hide-sm">{{ item.unit_price | money: q.currency }}</td>
                  <td class="r hide-sm">{{ item.vat_rate }}%</td>
                  <td class="r"><strong>{{ item.net_amount | money: q.currency }}</strong></td>
                </tr>
              }
            </tbody>
          </table>
          <div class="sum">
            <div class="row"><span class="muted">{{ 'quotes.net_total' | t }}</span><span>{{ q.net_total | money: q.currency }}</span></div>
            <div class="row"><span class="muted">{{ 'quotes.vat_total' | t }}</span><span>{{ q.vat_total | money: q.currency }}</span></div>
            <div class="row grand"><span>{{ 'quotes.gross_total' | t }}</span><span>{{ q.gross_total | money: q.currency }}</span></div>
          </div>

          @if (q.terms) { <div class="mt"><div class="stat-label">{{ 'quotes.terms' | t }}</div><p class="pre small muted">{{ q.terms }}</p></div> }

          @if (q.contact) {
            <div class="mt row wrap noprint">
              <span class="muted">{{ 'publicQuote.questions' | t }}</span>
              <a [href]="'mailto:' + q.contact.email"><app-icon name="mail" [size]="14" /> {{ q.contact.name }} · {{ q.contact.email }}</a>
            </div>
          }
        </article>

        <div class="card answer">
          <span class="total">{{ q.gross_total | money: q.currency }}</span>
          <button class="btn ghost" type="button" (click)="print()"><app-icon name="printer" [size]="16" /> <span class="print-label">{{ 'publicQuote.print' | t }}</span></button>
          @if (answerable(q)) {
            <button class="btn" type="button" (click)="mode.set('decline')">{{ 'publicQuote.decline' | t }}</button>
            <button class="btn primary cta" type="button" (click)="mode.set('accept')"><app-icon name="check" [size]="16" /> {{ 'publicQuote.accept' | t }}</button>
          }
        </div>
        <div class="foot">{{ 'publicQuote.poweredBy' | t }}</div>

        @if (mode() === 'accept') {
          <app-modal [title]="'publicQuote.acceptTitle' | t" (closed)="mode.set(null)">
            <form class="stack" (ngSubmit)="accept()" novalidate>
              <div class="field">
                <label for="a_name">{{ 'publicQuote.yourName' | t }} *</label>
                <input class="input" id="a_name" name="name" autocomplete="name" [(ngModel)]="name" [class.invalid]="errors()['name']" />
                @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
              </div>
              <label class="check small"><input type="checkbox" name="agree" [(ngModel)]="agree" /> <span>{{ 'publicQuote.agree' | t }}</span></label>
              @if (errors()['agree']) { <span class="error-text">{{ errors()['agree'] }}</span> }
              @if (generalError()) { <div class="banner danger">{{ generalError() }}</div> }
              <div class="row end">
                <button class="btn ghost" type="button" (click)="mode.set(null)">{{ 'common.cancel' | t }}</button>
                <button class="btn primary" type="submit" [disabled]="busy() || !agree || !name.trim()">{{ 'publicQuote.confirmAccept' | t }}</button>
              </div>
            </form>
          </app-modal>
        }
        @if (mode() === 'decline') {
          <app-modal [title]="'publicQuote.declineTitle' | t" (closed)="mode.set(null)">
            <form class="stack" (ngSubmit)="decline()">
              <div class="field"><label for="d_reason">{{ 'publicQuote.declineReason' | t }}</label><textarea class="textarea" id="d_reason" name="reason" rows="3" [(ngModel)]="reason"></textarea></div>
              @if (generalError()) { <div class="banner danger">{{ generalError() }}</div> }
              <div class="row end">
                <button class="btn ghost" type="button" (click)="mode.set(null)">{{ 'common.cancel' | t }}</button>
                <button class="btn" type="submit" [disabled]="busy()">{{ 'publicQuote.confirmDecline' | t }}</button>
              </div>
            </form>
          </app-modal>
        }
      } @else {
        <div class="card doc"><app-logo [size]="28" /><div class="skeleton mt" style="height:24px;width:50%"></div><div class="skeleton mt" style="height:220px"></div></div>
      }
    </div>
  `,
})
export class PublicQuotePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  protected readonly quote = signal<PublicQuote | null>(null);
  protected readonly unavailable = signal(false);
  protected readonly mode = signal<'accept' | 'decline' | null>(null);
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly generalError = signal<string | null>(null);
  protected name = '';
  protected agree = false;
  protected reason = '';
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const preview = this.route.snapshot.queryParamMap.get('preview') === '1';
    this.api.get<{ data: PublicQuote }>(`public/quotes/${this.token}`, preview ? { preview: 1 } : {}).subscribe({
      next: (res) => {
        this.i18n.use(res.data.company.locale as Locale);
        this.name = res.data.recipient_name ?? '';
        this.quote.set(res.data);
      },
      error: () => this.unavailable.set(true),
    });
  }

  answerable(q: PublicQuote): boolean {
    return (q.status === 'sent' || q.status === 'viewed') && !q.is_expired;
  }

  accept(): void {
    this.submit('accept', { name: this.name, agree: this.agree });
  }

  decline(): void {
    this.submit('decline', { reason: this.reason || null });
  }

  print(): void {
    window.print();
  }

  private submit(action: 'accept' | 'decline', body: Record<string, unknown>): void {
    this.busy.set(true);
    this.errors.set({});
    this.generalError.set(null);
    this.api.post<{ data: PublicQuote }>(`public/quotes/${this.token}/${action}`, body).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.mode.set(null);
        this.quote.set(res.data);
      },
      error: (err) => {
        this.busy.set(false);
        const fields = fieldErrors(err);
        this.errors.set(fields);
        if (fields['status'] || !Object.keys(fields).length) {
          this.generalError.set(fields['status'] ?? errorMessage(err, this.i18n.t('errors.server')));
        }
      },
    });
  }
}
