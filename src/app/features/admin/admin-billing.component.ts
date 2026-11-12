import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Paginated } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

interface SubscriptionRow {
  workspace: { id: number; name: string };
  owner: { name: string; email: string } | null;
  plan: string;
  interval: string | null;
  status: string | null;
  source: 'stripe' | 'manual';
  stripe_status: string | null;
  stripe_id: string | null;
  ends_at: string | null;
  on_grace_period: boolean;
  payment_method: string | null;
}

interface InvoiceRow {
  id: number;
  number: string | null;
  stripe_number: string | null;
  status: string;
  workspace: { id: number; name: string } | null;
  buyer: string | null;
  plan: string | null;
  interval: string | null;
  gross_amount: number;
  currency: string;
  attempts: number;
  error: string | null;
  paid_at: string | null;
}

/** Stripe subscriptions (mode="subscriptions") or Számlázz.hu invoices (mode="invoices") across all tenants. */
@Component({
  selector: 'app-admin-billing',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'subscriptions') {
      <div class="card">
        <div class="toolbar">
          <div class="segmented">
            @for (s of ['', 'active', 'past_due', 'canceled']; track s) { <button [class.active]="status === s" (click)="status = s; load(1)">{{ s ? ('billing.statuses.' + s | t) : ('common.all' | t) }}</button> }
          </div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ 'nav.workspace' | t }}</th><th>{{ 'platform.plan' | t }}</th><th>{{ 'common.status' | t }}</th><th>{{ 'platform.source' | t }}</th><th>{{ 'billing.card' | t }}</th><th>{{ 'team.expires' | t }}</th></tr></thead>
          <tbody>
            @for (s of subs()?.data ?? []; track s.workspace.id) {
              <tr>
                <td><div class="cell-title">{{ s.workspace.name }}</div><div class="cell-sub">{{ s.owner?.email }}</div></td>
                <td>{{ 'plan.' + s.plan | t }} <span class="subtle">· {{ s.interval ? ((s.interval === 'yearly' ? 'landing.yearly' : 'landing.monthly') | t) : '–' }}</span></td>
                <td>
                  <span class="badge" [class.success]="s.status === 'active'" [class.danger]="s.status === 'past_due'">{{ s.status ? ('billing.statuses.' + s.status | t) : '–' }}</span>
                  @if (s.on_grace_period) { <span class="badge warning">{{ 'billing.cancel' | t }}</span> }
                </td>
                <td><span class="badge" [class.info]="s.source === 'stripe'">{{ 'platform.' + s.source | t }}</span> <span class="cell-sub">{{ s.stripe_id }}</span></td>
                <td class="small">{{ s.payment_method ?? '–' }}</td>
                <td class="subtle">{{ s.ends_at ? (s.ends_at | dt: 'date') : '–' }}</td>
              </tr>
            } @empty { <tr><td colspan="6"><app-empty-state illustration="search" [compact]="true" [title]="'empty.noResultsTitle' | t" /></td></tr> }
          </tbody>
        </table></div>
        <app-pagination [meta]="subs()?.meta ?? null" (page)="load($event)" (perPage)="load(1)" />
      </div>
    } @else {
      @if (totals(); as t) {
        <div class="grid grid-4 mb">
          <div class="card kpi"><span class="stat-label">{{ 'billing.invoiceStatus.issued' | t }}</span><span class="kpi-icon"><app-icon name="check" /></span><span class="stat-value">{{ t.issued }}</span></div>
          <div class="card kpi"><span class="stat-label">{{ 'billing.invoiceStatus.pending' | t }}</span><span class="kpi-icon"><app-icon name="clock" /></span><span class="stat-value">{{ t.pending }}</span></div>
          <div class="card kpi"><span class="stat-label">{{ 'platform.error' | t }}</span><span class="kpi-icon" [class.warn]="t.failed > 0"><app-icon name="x" /></span><span class="stat-value" [class.danger]="t.failed > 0">{{ t.failed }}</span></div>
          <div class="card kpi"><span class="stat-label">{{ 'platform.revenue30' | t }}</span><span class="kpi-icon"><app-icon name="chart" /></span><span class="stat-value">{{ t.revenue_30d | money: 'HUF' }}</span></div>
        </div>
      }
      <div class="card">
        <div class="toolbar">
          <div class="segmented">
            @for (s of ['', 'issued', 'pending', 'failed']; track s) { <button [class.active]="status === s" (click)="status = s; load(1)">{{ s ? ('billing.invoiceStatus.' + s | t) : ('common.all' | t) }}</button> }
          </div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ 'billing.invoice' | t }}</th><th>{{ 'nav.workspace' | t }}</th><th>{{ 'platform.plan' | t }}</th><th class="right">{{ 'billing.amount' | t }}</th><th>{{ 'common.status' | t }}</th><th></th></tr></thead>
          <tbody>
            @for (i of invoices()?.data ?? []; track i.id) {
              <tr>
                <td><div class="cell-title">{{ i.number ?? '–' }}</div><div class="cell-sub">Stripe: {{ i.stripe_number ?? '–' }} · {{ i.paid_at | dt: 'date' }}</div></td>
                <td>{{ i.workspace?.name ?? i.buyer }}</td>
                <td class="small">{{ i.plan ? ('plan.' + i.plan | t) : '–' }}</td>
                <td class="right"><strong>{{ i.gross_amount | money: i.currency }}</strong></td>
                <td>
                  <span class="badge" [class.success]="i.status === 'issued'" [class.warning]="i.status === 'pending'" [class.danger]="i.status === 'failed'">{{ 'billing.invoiceStatus.' + i.status | t }}</span>
                  @if (i.error) { <div class="cell-sub" style="color:var(--danger);max-width:280px">{{ i.error }}</div> }
                </td>
                <td class="right">@if (!i.number) { <button class="btn sm" (click)="retry(i)">{{ 'platform.retry' | t }}</button> }</td>
              </tr>
            } @empty { <tr><td colspan="6"><app-empty-state illustration="search" [compact]="true" [title]="'empty.noResultsTitle' | t" /></td></tr> }
          </tbody>
        </table></div>
        <app-pagination [meta]="invoices()?.meta ?? null" (page)="load($event)" (perPage)="load(1)" />
      </div>
    }
  `,
})
export class AdminBillingComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly mode = input<'subscriptions' | 'invoices'>('subscriptions');
  protected readonly subs = signal<Paginated<SubscriptionRow> | null>(null);
  protected readonly invoices = signal<Paginated<InvoiceRow> | null>(null);
  protected readonly totals = signal<{ issued: number; pending: number; failed: number; revenue_30d: number } | null>(null);
  protected status = '';

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    if (this.mode() === 'subscriptions') {
      this.api.get<Paginated<SubscriptionRow>>('admin/subscriptions', { page, status: this.status }).subscribe((res) => this.subs.set(res));
    } else {
      this.api.get<Paginated<InvoiceRow> & { totals: { issued: number; pending: number; failed: number; revenue_30d: number } }>('admin/invoices', { page, status: this.status }).subscribe((res) => {
        this.invoices.set(res);
        this.totals.set(res.totals);
      });
    }
  }

  retry(invoice: InvoiceRow): void {
    this.api.post(`admin/invoices/${invoice.id}/retry`).subscribe(() => {
      this.toast.success('OK');
      this.load(1);
    });
  }
}
