import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PlanDefinition, PlanKey } from '../../core/models';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-subscription-section',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.subscription(); as s) {
      <div class="card mb">
        <div class="card-header">
          <h3>{{ 'plan.current' | t }}: {{ 'plan.' + s.effective_plan | t }}
            @if (s.on_trial && s.subscription_status !== 'active') { <span class="badge gold">{{ 'plan.trial' | t }} · {{ s.trial_ends_at | dt: 'date' }}</span> }
          </h3>
        </div>
        <div class="card-body grid grid-3">
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

      <div class="grid grid-3">
        @for (plan of plans(); track plan.key) {
          <div class="card plan-card" [class.current]="plan.key === s.effective_plan">
            <div class="row between"><h2>{{ plan.name }}</h2>@if (plan.key === s.effective_plan) { <span class="badge primary">{{ 'plan.current' | t }}</span> }</div>
            <div class="price">{{ plan.price | money: plan.currency }}<span class="subtle">{{ 'plan.perMonth' | t }}</span></div>
            <ul>
              @for (key of limitKeys; track key) {
                <li [class.off]="plan.limits[key] === 0">{{ 'plan.limits.' + key | t }}: <strong>{{ plan.limits[key] === null ? ('common.unlimited' | t) + '*' : plan.limits[key] }}</strong></li>
              }
            </ul>
            <hr style="margin:4px 0" />
            <ul>
              @for (key of featureKeys(plan); track key) {
                <li [class.off]="!plan.features[key]">{{ plan.features[key] ? '✓' : '–' }} {{ 'plan.feature.' + key | t }}</li>
              }
            </ul>
            @if (plan.key !== s.effective_plan && auth.isAdmin()) {
              <button class="btn" [class.gold]="plan.key !== 'free'" (click)="preview(plan.key)">{{ 'plan.choose' | t }}</button>
            }
          </div>
        }
      </div>

      @if (selected()) {
        <div class="card mt">
          <div class="card-body stack">
            @if (overLimits().length) {
              <div class="banner warning">{{ 'plan.overLimits' | t }}</div>
              <ul>@for (o of overLimits(); track o.key) { <li>{{ 'plan.limits.' + o.key | t }}: {{ o.used }} / {{ o.limit }}</li> }</ul>
            }
            <div class="banner info">{{ 'plan.contact' | t }}</div>
          </div>
        </div>
      }
      <p class="subtle mt">* Fair use.</p>
    }
  `,
})
export class SubscriptionSection {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly plans = signal<PlanDefinition[]>([]);
  protected readonly selected = signal<PlanKey | null>(null);
  protected readonly overLimits = signal<{ key: string; used: number; limit: number }[]>([]);
  protected readonly limitKeys = ['users', 'clients', 'active_leads', 'forms', 'submissions_per_month', 'pipelines', 'active_tasks', 'automations', 'custom_fields'];

  ngOnInit(): void {
    this.auth.refreshSubscription();
    this.api.get<{ data: PlanDefinition[] }>('plans').subscribe((res) => this.plans.set(res.data));
  }

  usageKeys(): string[] {
    return this.limitKeys.filter((key) => this.auth.subscription()?.usage[key]);
  }

  featureKeys(plan: PlanDefinition): string[] {
    return Object.keys(plan.features);
  }

  ratio(used: number, limit: number | null): number {
    if (limit === null) return 0.04;
    if (limit === 0) return 1;
    return Math.min(1, used / limit);
  }

  preview(plan: PlanKey): void {
    this.selected.set(plan);
    this.api.get<{ over_limits: Record<string, { used: number; limit: number }> }>('workspace/downgrade-preview', { plan }).subscribe((res) =>
      this.overLimits.set(Object.entries(res.over_limits).map(([key, v]) => ({ key, ...v }))),
    );
  }
}
