import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { PlanKey } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

interface PlanDef {
  name: string;
  prices: { monthly: number; yearly: number };
  stripe_prices: { monthly: string | null; yearly: string | null };
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

interface PlanRow {
  key: PlanKey;
  effective: PlanDef;
  defaults: PlanDef;
  overrides: Partial<PlanDef>;
}

/** Edit limits, features and prices of each plan without a deploy (stored overrides; reset restores config). */
@Component({
  selector: 'app-admin-plans',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner warning mb">{{ 'platform.priceWarning' | t }}</div>
    <div class="grid grid-3">
      @for (p of plans(); track p.key) {
        <div class="card">
          <div class="card-header">
            <h3>{{ p.effective.name }}</h3>
            @if (hasOverrides(p)) { <span class="badge gold">{{ 'platform.overridden' | t }}</span> } @else { <span class="badge">{{ 'platform.defaults' | t }}</span> }
          </div>
          <div class="card-body stack">
            <div class="grid grid-2" style="gap:10px">
              <div class="field"><label>{{ 'platform.monthly' | t }} (HUF)</label><input class="input sm" type="number" min="0" [(ngModel)]="drafts[p.key].prices.monthly" /></div>
              <div class="field"><label>{{ 'platform.yearly' | t }} (HUF)</label><input class="input sm" type="number" min="0" [(ngModel)]="drafts[p.key].prices.yearly" /></div>
              @if (p.key !== 'free') {
                <div class="field"><label>{{ 'platform.stripePriceMonthly' | t }}</label><input class="input sm" [(ngModel)]="drafts[p.key].stripe_prices.monthly" placeholder="price_…" /></div>
                <div class="field"><label>{{ 'platform.stripePriceYearly' | t }}</label><input class="input sm" [(ngModel)]="drafts[p.key].stripe_prices.yearly" placeholder="price_…" /></div>
              }
            </div>
            <span class="label">{{ 'platform.limits' | t }} <span class="hint">({{ 'platform.unlimitedHint' | t }})</span></span>
            @for (key of limitKeys(p); track key) {
              <div class="row between"><span class="small">{{ 'plan.limits.' + key | t }}</span><input class="input sm" type="number" min="0" style="width:110px" [ngModel]="drafts[p.key].limits[key]" (ngModelChange)="drafts[p.key].limits[key] = $event === '' || $event === null ? null : +$event" [placeholder]="'∞'" /></div>
            }
            <span class="label mt-sm">{{ 'platform.features' | t }}</span>
            @for (key of featureKeys(p); track key) {
              <label class="check small"><input type="checkbox" [(ngModel)]="drafts[p.key].features[key]" /> {{ 'plan.feature.' + key | t }}</label>
            }
            @if (errors()[p.key]) { <span class="error-text">{{ errors()[p.key] }}</span> }
            <div class="row end">
              @if (hasOverrides(p)) { <button class="btn ghost sm" (click)="reset(p)">{{ 'platform.resetPlan' | t }}</button> }
              <button class="btn primary sm" (click)="save(p)">{{ 'common.save' | t }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminPlansComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly plans = signal<PlanRow[]>([]);
  protected readonly errors = signal<Record<string, string>>({});
  protected drafts = {} as Record<PlanKey, PlanDef>;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<{ data: PlanRow[] }>('admin/plans').subscribe((res) => {
      this.drafts = Object.fromEntries(res.data.map((p) => [p.key, structuredClone(p.effective)])) as Record<PlanKey, PlanDef>;
      this.plans.set(res.data);
    });
  }

  limitKeys(p: PlanRow): string[] {
    return Object.keys(p.effective.limits);
  }

  featureKeys(p: PlanRow): string[] {
    return Object.keys(p.effective.features);
  }

  hasOverrides(p: PlanRow): boolean {
    return Object.keys(p.overrides ?? {}).length > 0;
  }

  save(p: PlanRow): void {
    const d = this.drafts[p.key];
    const payload: Record<string, unknown> = { prices: d.prices, limits: d.limits, features: d.features };
    if (p.key !== 'free') {
      payload['stripe_prices'] = { monthly: d.stripe_prices.monthly || null, yearly: d.stripe_prices.yearly || null };
    }
    this.errors.set({});
    this.api.put(`admin/plans/${p.key}`, payload).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('platform.saved'));
        this.load();
      },
      error: (err) => this.errors.set({ [p.key]: Object.values(fieldErrors(err))[0] ?? '' }),
    });
  }

  reset(p: PlanRow): void {
    if (confirm(this.i18n.t('platform.resetPlan') + '?')) {
      this.api.delete(`admin/plans/${p.key}`).subscribe(() => this.load());
    }
  }
}
