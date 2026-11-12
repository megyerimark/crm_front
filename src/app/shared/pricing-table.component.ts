import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { BillingInterval, PlanDefinition, PlanKey } from '../core/models';
import { TranslatePipe } from '../core/i18n/t.pipe';
import { IconComponent } from './icon.component';

const LIMIT_KEYS = ['users', 'clients', 'active_leads', 'forms', 'submissions_per_month', 'quotes_per_month', 'pipelines', 'active_tasks', 'automations', 'custom_fields'];
const HIGHLIGHT_FEATURES: Record<PlanKey, string[]> = {
  free: ['advanced_search', 'utm_tracking', 'email_reminders'],
  pro: ['advanced_search', 'import_update_duplicates', 'custom_form_fields', 'remove_branding', 'utm_tracking', 'advanced_reports', 'excel_export', 'email_reminders', 'quote_follow_ups'],
  business: ['auto_assignment', 'team', 'team_reports'],
};

/** Plan cards with monthly / yearly prices; used on the landing page and on the subscription settings page. */
@Component({
  selector: 'app-pricing-table',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; align-items: stretch; }
    @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .plan { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 26px 24px; }
    .plan.popular { border: 2px solid var(--primary); box-shadow: 0 18px 44px rgba(15,107,92,.22); background: linear-gradient(180deg, var(--primary-soft) 0, var(--surface) 140px); }
    @media (min-width: 901px) { .plan.popular { transform: translateY(-10px); } }
    .plan.current { border-color: var(--success); }
    .ribbon { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); }
    .price { font-size: 34px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
    .price small { font-size: 14px; font-weight: 500; color: var(--text-3); letter-spacing: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; }
    li { display: flex; gap: 8px; align-items: flex-start; }
    li app-icon { color: var(--success); margin-top: 2px; }
    li.off { color: var(--text-3); }
    li.off app-icon { color: var(--text-3); }
    .tagline { color: var(--text-2); min-height: 42px; }
    .actions { margin-top: auto; padding-top: 8px; }
  `],
  template: `
    <div class="grid">
      @for (plan of plans(); track plan.key) {
        <div class="card plan" [class.popular]="plan.key === 'pro'" [class.current]="plan.key === currentPlan()">
          @if (plan.key === currentPlan()) {
            <span class="badge success ribbon">{{ 'billing.current' | t }}</span>
          } @else if (plan.key === 'pro') {
            <span class="badge solid ribbon">★ {{ 'landing.popular' | t }}</span>
          }
          <h2>{{ plan.name }}</h2>
          <p class="tagline small">{{ 'landing.planTagline.' + plan.key | t }}</p>
          <div>
            <div class="price">{{ money(plan.prices[interval()], plan.currency) }}<small>{{ (interval() === 'yearly' && plan.prices.yearly ? 'landing.perYear' : 'plan.perMonth') | t }}</small></div>
            @if (interval() === 'yearly' && plan.prices.yearly) {
              <div class="subtle">{{ 'landing.billedYearly' | t: { amount: money(plan.prices.yearly / 12, plan.currency) } }}</div>
            } @else {
              <div class="subtle">&nbsp;</div>
            }
          </div>
          <ul>
            @for (key of limitKeys; track key) {
              @if (plan.limits[key] !== 0) {
                <li><app-icon name="check" [size]="15" /><span>{{ 'plan.limits.' + key | t }}: <strong>{{ plan.limits[key] === null ? ('common.unlimited' | t) + '*' : num(plan.limits[key]!) }}</strong></span></li>
              }
            }
          </ul>
          <ul>
            @for (key of highlights(plan.key); track key) {
              <li [class.off]="!plan.features[key]"><app-icon [name]="plan.features[key] ? 'check' : 'x'" [size]="15" /><span>{{ 'plan.feature.' + key | t }}</span></li>
            }
          </ul>
          <div class="actions">
            @if (actionLabel(plan.key); as label) {
              <button class="btn block" [class.accent]="plan.key === 'pro'" [class.primary]="plan.key === 'business'" [disabled]="busy() === plan.key" (click)="choose.emit(plan.key)">{{ label }}</button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class PricingTableComponent {
  private readonly i18n = inject(I18nService);
  readonly plans = input<PlanDefinition[]>([]);
  readonly interval = input<BillingInterval>('monthly');
  readonly currentPlan = input<PlanKey | null>(null);
  readonly busy = input<string | null>(null);
  /** Label per plan; return '' to hide the button. */
  readonly labelFor = input<(plan: PlanKey) => string>(() => this.i18n.t('landing.choose'));
  readonly choose = output<PlanKey>();

  protected readonly limitKeys = LIMIT_KEYS;

  highlights(plan: PlanKey): string[] {
    return plan === 'business' ? [...HIGHLIGHT_FEATURES.pro, ...HIGHLIGHT_FEATURES.business] : HIGHLIGHT_FEATURES.pro;
  }

  actionLabel(plan: PlanKey): string {
    return this.labelFor()(plan);
  }

  money(value: number, currency: string): string {
    return this.i18n.money(Math.round(value), currency);
  }

  num(value: number): string {
    return this.i18n.number(value);
  }
}
