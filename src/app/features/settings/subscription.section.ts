import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { errorMessage, fieldErrors } from '../../core/interceptors';
import { BillingDetails, BillingInterval, BillingInvoice, BillingOverview, PlanCatalogue, PlanKey, Subscription } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { PricingTableComponent } from '../../shared/pricing-table.component';
import { UI, saveBlob } from '../../shared/ui';

const COUNTRIES: [string, string][] = [
  ['HU', 'Magyarország'], ['AT', 'Österreich'], ['DE', 'Deutschland'], ['SK', 'Slovensko'], ['RO', 'România'], ['HR', 'Hrvatska'],
  ['SI', 'Slovenija'], ['RS', 'Srbija'], ['CZ', 'Česko'], ['PL', 'Polska'], ['CH', 'Schweiz'], ['GB', 'United Kingdom'],
];
const PLAN_RANK: Record<PlanKey, number> = { free: 0, pro: 1, business: 2 };

/**
 * Plan overview, Stripe checkout / portal, plan and interval changes, cancellation,
 * billing details for the Hungarian e-invoice and the invoice list.
 */
@Component({
  selector: 'app-subscription-section',
  imports: [FormsModule, PricingTableComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice(); as n) { <div class="banner mb" [class.info]="n.kind === 'info'" [class.warning]="n.kind === 'warning'">{{ n.text }}</div> }

    @if (auth.subscription(); as s) {
      @if (intendedPlan(); as ip) {
        <div class="banner gold mb"><app-icon name="star" [size]="16" /> {{ 'billing.intended' | t: { plan: ('plan.' + ip | t) } }}</div>
      }

      <div class="grid grid-2 mb">
        <div class="card">
          <div class="card-header"><h3>{{ 'plan.current' | t }}</h3>
            @if (overview()?.status?.stripe_status; as st) { <span class="badge" [class.success]="st === 'active' || st === 'trialing'" [class.danger]="st === 'past_due'">{{ 'billing.statuses.' + st | t }}</span> }
          </div>
          <div class="card-body stack">
            <div class="row" style="align-items:baseline">
              <span style="font-size:28px;font-weight:700">{{ 'plan.' + s.effective_plan | t }}</span>
              @if (s.billing_interval && s.subscription_status === 'active') { <span class="muted">· {{ (s.billing_interval === 'yearly' ? 'landing.yearly' : 'landing.monthly') | t }}</span> }
            </div>
            @if (s.on_trial && s.subscription_status !== 'active') { <div class="badge gold" style="align-self:flex-start">{{ 'billing.trialUntil' | t: { date: (s.trial_ends_at | dt: 'date') } }}</div> }
            @if (overview(); as o) {
              @if (o.status.subscription_trial_ends_at && o.status.stripe_status === 'trialing') { <p class="muted">{{ 'billing.trialUntil' | t: { date: (o.status.subscription_trial_ends_at | dt: 'date') } }} · {{ 'billing.keepTrial' | t }}</p> }
              @if (o.status.on_grace_period && o.status.ends_at) { <div class="banner warning">{{ 'billing.cancelsOn' | t: { date: (o.status.ends_at | dt: 'date') } }}</div> }
              @if (o.status.past_due) { <div class="banner danger">{{ 'billing.pastDue' | t }}</div> }
              @if (o.status.payment_method; as pm) { <span class="muted"><app-icon name="lock" [size]="14" /> {{ 'billing.card' | t }}: {{ pm.type }} •••• {{ pm.last_four }}</span> }
              <div class="row wrap">
                @if (o.status.configured) {
                  @if (o.status.has_subscription || o.status.payment_method) { <button class="btn" (click)="portal()" [disabled]="busy() !== null">{{ 'billing.manage' | t }}</button> }
                  @if (o.status.has_subscription && !o.status.on_grace_period) { <button class="btn danger" (click)="cancel()" [disabled]="busy() !== null">{{ 'billing.cancel' | t }}</button> }
                  @if (o.status.on_grace_period) { <button class="btn primary" (click)="resume()" [disabled]="busy() !== null">{{ 'billing.resume' | t }}</button> }
                } @else {
                  <div class="banner info">{{ 'billing.notConfigured' | t }}</div>
                }
              </div>
            } @else if (!auth.isAdmin()) {
              <p class="subtle">{{ 'errors.forbidden' | t }}</p>
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>{{ 'plan.usage' | t }}</h3></div>
          <div class="card-body stack">
            @for (key of usageKeys(); track key) {
              <div class="stack-sm">
                <div class="row between small"><span>{{ 'plan.limits.' + key | t }}</span><strong>{{ s.usage[key].used }} / {{ s.usage[key].limit ?? ('common.unlimited' | t) }}</strong></div>
                <div class="progress" [class.warn]="ratio(s.usage[key].used, s.usage[key].limit) >= 0.8" [class.full]="ratio(s.usage[key].used, s.usage[key].limit) >= 1">
                  <div [style.width.%]="ratio(s.usage[key].used, s.usage[key].limit) * 100"></div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="row between wrap mb">
        <h2>{{ 'landing.pricingTitle' | t }}</h2>
        <div class="row">
          <div class="segmented">
            <button [class.active]="interval() === 'monthly'" (click)="interval.set('monthly')">{{ 'landing.monthly' | t }}</button>
            <button [class.active]="interval() === 'yearly'" (click)="interval.set('yearly')">{{ 'landing.yearly' | t }}</button>
          </div>
          <span class="badge success">{{ 'landing.yearlySave' | t }}</span>
        </div>
      </div>
      @if (catalogue(); as c) {
        <app-pricing-table [plans]="c.data" [interval]="interval()" [currentPlan]="currentPlanCard()" [busy]="busy()" [labelFor]="labelFor" (choose)="choose($event)" />
        <p class="subtle mt"><app-icon name="lock" [size]="13" /> {{ 'billing.securePayment' | t }} · {{ (c.prices_include_vat ? 'landing.vatIncluded' : 'landing.vatExcluded') | t }} · * Fair use.</p>
      }

      @if (overLimits().length) {
        <div class="banner warning mt">{{ 'billing.downgradeTitle' | t }}: @for (o of overLimits(); track o.key) { {{ 'plan.limits.' + o.key | t }} ({{ o.used }} / {{ o.limit }}){{ $last ? '' : ',' }} }</div>
      }

      @if (overview(); as o) {
        <div class="grid grid-2 mt" id="billing-details">
          <div class="card">
            <div class="card-header"><h3>{{ 'billing.details' | t }}</h3><span class="subtle">{{ 'billing.detailsHint' | t }}</span></div>
            <form class="card-body form-grid" (ngSubmit)="saveDetails()">
              @if (detailsMissing()) { <div class="banner warning full">{{ 'billing.detailsRequired' | t }}</div> }
              <div class="field full"><label>{{ 'billing.name' | t }} *</label><input class="input" name="bn" [(ngModel)]="details.billing_name" [class.invalid]="errors()['billing_name']" /></div>
              <div class="field full"><label>{{ 'billing.email' | t }} *</label><input class="input" type="email" name="be" [(ngModel)]="details.billing_email" [class.invalid]="errors()['billing_email']" /></div>
              <div class="field">
                <label>{{ 'billing.country' | t }} *</label>
                <select class="select" name="bc" [(ngModel)]="details.billing_country">@for (c of countries; track c[0]) { <option [value]="c[0]">{{ c[1] }}</option> }</select>
              </div>
              <div class="field"><label>{{ 'billing.postcode' | t }} *</label><input class="input" name="bp" [(ngModel)]="details.billing_postcode" [class.invalid]="errors()['billing_postcode']" /></div>
              <div class="field"><label>{{ 'billing.city' | t }} *</label><input class="input" name="bci" [(ngModel)]="details.billing_city" [class.invalid]="errors()['billing_city']" /></div>
              <div class="field"><label>{{ 'billing.address' | t }} *</label><input class="input" name="ba" [(ngModel)]="details.billing_address" [class.invalid]="errors()['billing_address']" /></div>
              <div class="field">
                <label>{{ 'billing.taxNumber' | t }}</label><input class="input" name="bt" [(ngModel)]="details.billing_tax_number" placeholder="12345678-1-23" [class.invalid]="errors()['billing_tax_number']" />
                <span class="hint">{{ 'billing.taxNumberHint' | t }}</span>
                @if (errors()['billing_tax_number']) { <span class="error-text">{{ errors()['billing_tax_number'] }}</span> }
              </div>
              <div class="field">
                <label>{{ 'billing.euVat' | t }}</label><input class="input" name="bev" [(ngModel)]="details.billing_eu_vat_number" [class.invalid]="errors()['billing_eu_vat_number']" />
                <span class="hint">{{ 'billing.euVatHint' | t }}</span>
              </div>
              @if (firstError(); as e) { <span class="error-text full">{{ e }}</span> }
              <div class="full row end"><button class="btn primary" type="submit">{{ 'common.save' | t }}</button></div>
            </form>
          </div>

          <div class="card">
            <div class="card-header"><h3>{{ 'billing.invoices' | t }}</h3></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>{{ 'billing.invoice' | t }}</th><th>{{ 'billing.period' | t }}</th><th class="right">{{ 'billing.amount' | t }}</th><th></th></tr></thead>
              <tbody>
                @for (inv of o.invoices; track inv.id) {
                  <tr>
                    <td><div class="cell-title">{{ inv.number ?? '–' }}</div><span class="badge" [class.success]="inv.status === 'issued'" [class.warning]="inv.status === 'pending'" [class.danger]="inv.status === 'failed'">{{ 'billing.invoiceStatus.' + inv.status | t }}</span></td>
                    <td class="small">{{ inv.period_start | dt: 'date' }} – {{ inv.period_end | dt: 'date' }}<div class="cell-sub">{{ 'plan.' + inv.plan | t }} · {{ (inv.interval === 'yearly' ? 'landing.yearly' : 'landing.monthly') | t }}</div></td>
                    <td class="right"><strong>{{ inv.gross_amount | money: inv.currency }}</strong><div class="cell-sub">{{ inv.net_amount | money: inv.currency }} + {{ inv.vat_amount | money: inv.currency }}</div></td>
                    <td class="right">@if (inv.has_pdf) { <button class="btn sm" (click)="download(inv)"><app-icon name="download" [size]="14" /> {{ 'billing.download' | t }}</button> }</td>
                  </tr>
                } @empty { <tr><td colspan="4"><div class="empty small">{{ 'common.empty' | t }}</div></td></tr> }
              </tbody>
            </table></div>
          </div>
        </div>
      }
    }
  `,
})
export class SubscriptionSection implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected readonly countries = COUNTRIES;
  protected readonly limitKeys = ['users', 'clients', 'active_leads', 'forms', 'submissions_per_month', 'quotes_per_month', 'pipelines', 'active_tasks', 'automations', 'custom_fields'];
  protected readonly catalogue = signal<PlanCatalogue | null>(null);
  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly interval = signal<BillingInterval>('monthly');
  protected readonly busy = signal<PlanKey | 'action' | null>(null);
  protected readonly notice = signal<{ kind: 'info' | 'warning'; text: string } | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly detailsMissing = signal(false);
  protected readonly overLimits = signal<{ key: string; used: number; limit: number }[]>([]);
  protected details: BillingDetails = {} as BillingDetails;
  private poll: ReturnType<typeof setInterval> | null = null;

  protected readonly intendedPlan = computed(() => {
    const s = this.auth.subscription();
    const wanted = (this.route.snapshot.queryParamMap.get('plan') as PlanKey | null) ?? s?.intended_plan ?? null;
    return wanted && wanted !== 'free' && s?.subscription_status !== 'active' ? wanted : null;
  });

  /** The plan card marked "current": only a paid plan with an active subscription, or Free without one. */
  protected readonly currentPlanCard = computed<PlanKey | null>(() => {
    const s = this.auth.subscription();
    if (!s) return null;
    if (s.subscription_status === 'active') return s.billing_interval === this.interval() ? s.plan : null;
    return s.on_trial ? null : 'free';
  });

  protected readonly labelFor = (plan: PlanKey): string => {
    const s = this.auth.subscription();
    if (!this.auth.isAdmin() || !s) return '';
    const subscribed = s.subscription_status === 'active';
    if (plan === 'free') return '';
    if (subscribed) {
      return plan === s.plan && this.interval() === s.billing_interval ? '' : this.i18n.t('billing.switchTo');
    }
    return this.i18n.t('billing.subscribe');
  };

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const ws = this.auth.workspace();
    this.interval.set((query.get('interval') as BillingInterval) || ws?.billing_interval || 'yearly');
    this.auth.refreshSubscription();
    this.api.get<PlanCatalogue>('plans').subscribe((res) => this.catalogue.set(res));
    if (this.auth.isAdmin()) {
      this.loadOverview();
    }
    if (query.get('checkout') === 'success') {
      this.notice.set({ kind: 'info', text: this.i18n.t('billing.checkoutSuccess') });
      this.waitForActivation();
    } else if (query.get('checkout') === 'cancelled') {
      this.notice.set({ kind: 'warning', text: this.i18n.t('billing.checkoutCancelled') });
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  usageKeys(): string[] {
    return this.limitKeys.filter((key) => this.auth.subscription()?.usage[key]);
  }

  ratio(used: number, limit: number | null): number {
    if (limit === null) return 0.04;
    if (limit === 0) return 1;
    return Math.min(1, used / limit);
  }

  firstError(): string {
    return Object.values(this.errors())[0] ?? '';
  }

  loadOverview(): void {
    this.api.get<BillingOverview>('billing').subscribe((res) => {
      this.overview.set(res);
      this.details = { ...res.details, billing_country: res.details.billing_country || this.auth.workspace()?.country || 'HU' };
      if (!this.details.billing_name) this.details.billing_name = this.auth.workspace()?.name ?? '';
      if (!this.details.billing_email) this.details.billing_email = this.auth.user()?.email ?? '';
    });
  }

  choose(plan: PlanKey): void {
    const overview = this.overview();
    if (!overview) return;
    if (!overview.status.configured) {
      this.toast.show(this.i18n.t('billing.notConfigured'), 'info');
      return;
    }
    if (overview.status.has_subscription) {
      this.swap(plan);
      return;
    }
    if (!overview.status.billing_details_complete) {
      this.detailsMissing.set(true);
      document.getElementById('billing-details')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    this.busy.set(plan);
    this.api.post<{ url: string }>('billing/checkout', { plan, interval: this.interval() }).subscribe({
      next: (res) => {
        this.toast.show(this.i18n.t('billing.redirecting'), 'info');
        window.location.href = res.url;
      },
      error: (err) => {
        this.busy.set(null);
        const errors = fieldErrors(err);
        if (errors['billing']) this.detailsMissing.set(true);
        if (Object.keys(errors).length) this.toast.error(Object.values(errors)[0]);
      },
    });
  }

  swap(plan: PlanKey): void {
    const current = this.auth.subscription();
    const label = { plan: this.i18n.t('plan.' + plan), interval: this.i18n.t(this.interval() === 'yearly' ? 'landing.yearly' : 'landing.monthly') };
    const run = () => {
      if (!confirm(this.i18n.t('billing.swapConfirm', label))) return;
      this.busy.set(plan);
      this.api.post<{ subscription: Subscription }>('billing/swap', { plan, interval: this.interval() }).subscribe({
        next: (res) => {
          this.busy.set(null);
          this.auth.subscription.set(res.subscription);
          this.overLimits.set([]);
          this.toast.success(this.i18n.t('billing.swapped'));
          this.loadOverview();
          this.auth.loadMe().subscribe();
        },
        error: (err) => {
          this.busy.set(null);
          this.toast.error(errorMessage(err, this.i18n.t('errors.server')));
        },
      });
    };
    if (current && PLAN_RANK[plan] < PLAN_RANK[current.plan]) {
      this.api.get<{ over_limits: Record<string, { used: number; limit: number }> }>('workspace/downgrade-preview', { plan }).subscribe((res) => {
        this.overLimits.set(Object.entries(res.over_limits).map(([key, v]) => ({ key, ...v })));
        run();
      });
    } else {
      run();
    }
  }

  portal(): void {
    this.busy.set('action');
    this.api.post<{ url: string }>('billing/portal').subscribe({
      next: (res) => (window.location.href = res.url),
      error: () => this.busy.set(null),
    });
  }

  cancel(): void {
    if (!confirm(this.i18n.t('billing.cancelConfirm'))) return;
    this.action('billing/cancel');
  }

  resume(): void {
    this.action('billing/resume');
  }

  saveDetails(): void {
    this.errors.set({});
    this.api.put<{ details: BillingDetails }>('billing/details', this.details).subscribe({
      next: () => {
        this.detailsMissing.set(false);
        this.toast.success(this.i18n.t('billing.detailsSaved'));
        this.loadOverview();
      },
      error: (err) => this.errors.set(fieldErrors(err)),
    });
  }

  download(invoice: BillingInvoice): void {
    this.api.download(`billing/invoices/${invoice.id}/pdf`).subscribe((blob) => saveBlob(blob, `${invoice.number}.pdf`));
  }

  private action(path: string): void {
    this.busy.set('action');
    this.api.post<{ subscription: Subscription }>(path).subscribe({
      next: (res) => {
        this.busy.set(null);
        this.auth.subscription.set(res.subscription);
        this.loadOverview();
      },
      error: () => this.busy.set(null),
    });
  }

  /** Stripe confirms the subscription by webhook a few seconds after the redirect. */
  private waitForActivation(): void {
    let attempts = 0;
    this.poll = setInterval(() => {
      attempts++;
      this.api.get<BillingOverview>('billing').subscribe((res) => {
        this.overview.set(res);
        if (res.status.has_subscription || attempts >= 15) {
          this.stopPolling();
          this.auth.refreshSubscription();
          this.auth.loadMe().subscribe();
          void this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      });
    }, 2000);
  }

  private stopPolling(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }
}
