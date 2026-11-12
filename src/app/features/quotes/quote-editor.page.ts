import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { Client, Deal, Lead, Paginated, Quote, QuoteItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

interface QuoteForm {
  title: string;
  client_id: number | null;
  lead_id: number | null;
  deal_id: number | null;
  recipient_name: string;
  recipient_email: string;
  valid_until: string;
  introduction: string;
  terms: string;
}

const VAT_RATES = [27, 18, 5, 0];

/** Create a quote or edit a draft: customer, line items with live totals, intro and terms. */
@Component({
  selector: 'app-quote-editor-page',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .items { width: 100%; border-collapse: collapse; }
    .items th { text-align: left; font-size: 12px; font-weight: 600; color: var(--text-3); padding: 0 6px 8px; }
    .items td { padding: 4px 6px; vertical-align: top; }
    .items .num { width: 90px; } .items .unit { width: 90px; } .items .price { width: 140px; } .items .vat { width: 86px; } .items .sum { width: 130px; text-align: right; padding-top: 12px; font-weight: 600; white-space: nowrap; }
    .items .del { width: 36px; }
    .totals { display: grid; gap: 8px; }
    .totals .row { justify-content: space-between; }
    .totals .grand { font-size: 20px; font-weight: 700; color: var(--text); padding-top: 8px; border-top: 1px solid var(--border); }
    .sticky { position: sticky; top: 84px; }
    @media (max-width: 720px) {
      .items thead { display: none; }
      .items tr { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--border); }
      .items td { padding: 0; width: auto !important; }
      .items td.desc { grid-column: 1 / -1; }
      .items .sum { text-align: left; padding-top: 8px; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <a class="subtle small" routerLink="/quotes"><app-icon name="chevronLeft" [size]="14" /> {{ 'quotes.title' | t }}</a>
          <h1>{{ (id() ? 'quotes.edit' : 'quotes.new') | t }}</h1>
          @if (number()) { <p>{{ number() }} · {{ 'quotes.draftHint' | t }}</p> }
        </div>
      </div>

      <form class="layout" (ngSubmit)="save()" novalidate>
        <div class="stack">
          <div class="card">
            <div class="card-body form-grid">
              <div class="field span-2">
                <label for="q_title">{{ 'quotes.titleLabel' | t }} *</label>
                <input class="input" id="q_title" name="title" [(ngModel)]="form.title" [placeholder]="'quotes.titlePlaceholder' | t" [class.invalid]="errors()['title']" />
                @if (errors()['title']) { <span class="error-text">{{ errors()['title'] }}</span> }
              </div>
              <div class="field">
                <label for="q_client">{{ 'quotes.client' | t }}</label>
                <select class="select" id="q_client" name="client_id" [(ngModel)]="form.client_id" (ngModelChange)="pickContact()">
                  <option [ngValue]="null">{{ 'quotes.none' | t }}</option>
                  @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}{{ c.company ? ' · ' + c.company : '' }}</option> }
                </select>
              </div>
              <div class="field">
                <label for="q_lead">{{ 'quotes.lead' | t }}</label>
                <select class="select" id="q_lead" name="lead_id" [(ngModel)]="form.lead_id" (ngModelChange)="pickContact()">
                  <option [ngValue]="null">{{ 'quotes.none' | t }}</option>
                  @for (l of leads(); track l.id) { <option [ngValue]="l.id">{{ l.name }}{{ l.company ? ' · ' + l.company : '' }}</option> }
                </select>
              </div>
              <div class="field">
                <label for="q_rname">{{ 'quotes.recipientName' | t }}</label>
                <input class="input" id="q_rname" name="recipient_name" [(ngModel)]="form.recipient_name" autocomplete="off" />
              </div>
              <div class="field">
                <label for="q_remail">{{ 'quotes.recipientEmail' | t }}</label>
                <input class="input" id="q_remail" type="email" name="recipient_email" [(ngModel)]="form.recipient_email" autocomplete="off" [class.invalid]="errors()['recipient_email']" />
                @if (errors()['recipient_email']) { <span class="error-text">{{ errors()['recipient_email'] }}</span> }
              </div>
              <div class="field">
                <label for="q_deal">{{ 'quotes.deal' | t }}</label>
                <select class="select" id="q_deal" name="deal_id" [(ngModel)]="form.deal_id">
                  <option [ngValue]="null">{{ 'quotes.none' | t }}</option>
                  @for (d of deals(); track d.id) { <option [ngValue]="d.id">{{ d.title }}</option> }
                </select>
              </div>
              <div class="field">
                <label for="q_valid">{{ 'quotes.validUntil' | t }}</label>
                <input class="input" id="q_valid" type="date" name="valid_until" [(ngModel)]="form.valid_until" />
              </div>
              <div class="field span-2">
                <label for="q_intro">{{ 'quotes.introduction' | t }}</label>
                <textarea class="textarea" id="q_intro" name="introduction" rows="3" [(ngModel)]="form.introduction" [placeholder]="'quotes.introPlaceholder' | t"></textarea>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>{{ 'quotes.items' | t }}</h3></div>
            <div class="card-body">
              <table class="items">
                <thead>
                  <tr>
                    <th>{{ 'quotes.description' | t }}</th><th class="num">{{ 'quotes.quantity' | t }}</th><th class="unit">{{ 'quotes.unit' | t }}</th>
                    <th class="price">{{ 'quotes.unitPrice' | t }}</th><th class="vat">{{ 'quotes.vat' | t }}</th><th class="sum">{{ 'quotes.net' | t }}</th><th class="del"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items(); track $index; let i = $index) {
                    <tr>
                      <td class="desc"><input class="input" [name]="'d' + i" [(ngModel)]="item.description" (ngModelChange)="touch()" [placeholder]="'quotes.description' | t" [attr.aria-label]="'quotes.description' | t" /></td>
                      <td class="num"><input class="input" type="number" min="0" step="0.01" [name]="'q' + i" [(ngModel)]="item.quantity" (ngModelChange)="touch()" [attr.aria-label]="'quotes.quantity' | t" /></td>
                      <td class="unit"><input class="input" [name]="'u' + i" [(ngModel)]="item.unit" [attr.aria-label]="'quotes.unit' | t" /></td>
                      <td class="price"><input class="input" type="number" min="0" step="1" [name]="'p' + i" [(ngModel)]="item.unit_price" (ngModelChange)="touch()" [attr.aria-label]="'quotes.unitPrice' | t" /></td>
                      <td class="vat">
                        <select class="select" [name]="'v' + i" [(ngModel)]="item.vat_rate" (ngModelChange)="touch()" [attr.aria-label]="'quotes.vat' | t">
                          @for (r of vatRates; track r) { <option [ngValue]="r">{{ r }}%</option> }
                        </select>
                      </td>
                      <td class="sum">{{ (item.quantity || 0) * (item.unit_price || 0) | money: currency }}</td>
                      <td class="del"><button class="btn ghost icon sm" type="button" (click)="removeItem(i)" [attr.aria-label]="'common.delete' | t"><app-icon name="trash" [size]="15" /></button></td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (errors()['items']) { <span class="error-text">{{ errors()['items'] }}</span> }
              <button class="btn ghost sm mt" type="button" (click)="addItem()"><app-icon name="plus" [size]="15" /> {{ 'quotes.addItem' | t }}</button>
            </div>
          </div>

          <div class="card">
            <div class="card-body field">
              <label for="q_terms">{{ 'quotes.terms' | t }}</label>
              <textarea class="textarea" id="q_terms" name="terms" rows="3" [(ngModel)]="form.terms" [placeholder]="'quotes.termsPlaceholder' | t"></textarea>
            </div>
          </div>
        </div>

        <div class="card sticky">
          <div class="card-body totals">
            <div class="row"><span class="muted">{{ 'quotes.net_total' | t }}</span><span>{{ totals().net | money: currency }}</span></div>
            <div class="row"><span class="muted">{{ 'quotes.vat_total' | t }}</span><span>{{ totals().vat | money: currency }}</span></div>
            <div class="row grand"><span>{{ 'quotes.gross_total' | t }}</span><span>{{ totals().gross | money: currency }}</span></div>
            @if (generalError()) { <div class="banner danger">{{ generalError() }}</div> }
            <button class="btn primary block mt" type="submit" [disabled]="busy()">{{ 'quotes.saveDraft' | t }}</button>
            <a class="btn ghost block" [routerLink]="id() ? ['/quotes', id()] : ['/quotes']">{{ 'common.cancel' | t }}</a>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class QuoteEditorPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected readonly vatRates = VAT_RATES;
  protected readonly id = signal<number | null>(null);
  protected readonly number = signal<string | null>(null);
  protected readonly clients = signal<Client[]>([]);
  protected readonly leads = signal<Lead[]>([]);
  protected readonly deals = signal<Deal[]>([]);
  protected readonly items = signal<QuoteItem[]>([this.blankItem()]);
  protected readonly version = signal(0);
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly generalError = signal<string | null>(null);
  protected currency = this.auth.currency();
  protected form: QuoteForm = {
    title: '', client_id: null, lead_id: null, deal_id: null, recipient_name: '', recipient_email: '',
    valid_until: this.inDays(14), introduction: '', terms: '',
  };

  protected readonly totals = computed(() => {
    this.version();
    let net = 0;
    let vat = 0;
    for (const item of this.items()) {
      const line = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      net += line;
      vat += Math.round(line * (Number(item.vat_rate) || 0)) / 100;
    }
    return { net, vat, gross: net + vat };
  });

  ngOnInit(): void {
    this.api.get<Paginated<Client>>('clients', { per_page: 100, sort: 'name', direction: 'asc' }).subscribe((res) => this.clients.set(res.data));
    this.api.get<Paginated<Lead>>('leads', { per_page: 100 }).subscribe((res) => this.leads.set(res.data));
    this.api.get<{ data: Deal[] }>('deals').subscribe((res) => this.deals.set(res.data.filter((d) => !d.closed_at)));

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.id.set(id);
      this.api.get<{ data: Quote }>(`quotes/${id}`).subscribe((res) => this.fill(res.data));
      return;
    }

    const query = this.route.snapshot.queryParamMap;
    this.form.client_id = Number(query.get('client_id')) || null;
    this.form.lead_id = Number(query.get('lead_id')) || null;
    this.form.deal_id = Number(query.get('deal_id')) || null;
    this.form.title = query.get('title') ?? '';
  }

  pickContact(): void {
    const contact = this.clients().find((c) => c.id === this.form.client_id) ?? this.leads().find((l) => l.id === this.form.lead_id);
    if (contact) {
      this.form.recipient_name = contact.name;
      this.form.recipient_email = contact.email ?? '';
    }
  }

  addItem(): void {
    this.items.update((items) => [...items, this.blankItem()]);
  }

  removeItem(index: number): void {
    this.items.update((items) => items.filter((_, i) => i !== index));
  }

  touch(): void {
    this.version.update((v) => v + 1);
  }

  save(): void {
    this.busy.set(true);
    this.errors.set({});
    this.generalError.set(null);
    const body = {
      ...this.form,
      recipient_name: this.form.recipient_name || null,
      recipient_email: this.form.recipient_email || null,
      valid_until: this.form.valid_until || null,
      items: this.items().filter((i) => i.description.trim()).map(({ description, quantity, unit, unit_price, vat_rate }) => ({ description, quantity: Number(quantity) || 0, unit: unit || null, unit_price: Number(unit_price) || 0, vat_rate })),
    };
    const id = this.id();
    const request = id ? this.api.patch<{ data: Quote }>(`quotes/${id}`, body) : this.api.post<{ data: Quote }>('quotes', body);

    request.subscribe({
      next: (res) => {
        this.busy.set(false);
        this.toast.success(this.i18n.t('quotes.saved'));
        void this.router.navigate(['/quotes', res.data.id]);
      },
      error: (err) => {
        this.busy.set(false);
        const fields = fieldErrors(err);
        this.errors.set(fields);
        if (!Object.keys(fields).length) {
          this.generalError.set(err?.error?.message ?? this.i18n.t('errors.server'));
        }
      },
    });
  }

  private fill(quote: Quote): void {
    if (quote.status !== 'draft') {
      void this.router.navigate(['/quotes', quote.id]);
      return;
    }
    this.number.set(quote.number);
    this.currency = quote.currency;
    this.form = {
      title: quote.title, client_id: quote.client_id, lead_id: quote.lead_id, deal_id: quote.deal_id,
      recipient_name: quote.recipient_name ?? '', recipient_email: quote.recipient_email ?? '', valid_until: quote.valid_until ?? '',
      introduction: quote.introduction ?? '', terms: quote.terms ?? '',
    };
    this.items.set(quote.items?.length ? quote.items.map((i) => ({ ...i })) : [this.blankItem()]);
  }

  private blankItem(): QuoteItem {
    return { description: '', quantity: 1, unit: '', unit_price: 0, vat_rate: 27 };
  }

  private inDays(days: number): string {
    const date = new Date(Date.now() + days * 86400000);
    return date.toISOString().slice(0, 10);
  }
}
