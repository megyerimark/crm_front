import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { UI } from '../../shared/ui';

interface Analytics {
  days: number;
  series: { day: string; signups: number; active: number }[];
  users: { total: number; signups: number; dau: number; wau: number; mau: number; unverified: number; two_factor: number };
  workspaces: { total: number; on_trial: number; paid: number; paid_by_plan: Partial<Record<string, number>>; suspended: number };
  revenue: { mrr: number; arr: number; currency: string; churned_30d: number };
  conversion: { cohort: number; converted: number; rate: number };
  support: { open: number; open_by_priority: Partial<Record<string, number>> };
}

/** Platform analytics: KPIs, daily sign-ups / active users, plan mix and support load. */
@Component({
  selector: 'app-admin-overview',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .chart { display: flex; align-items: flex-end; gap: 3px; height: 170px; }
    .col { flex: 1; display: flex; gap: 1px; align-items: flex-end; height: 100%; min-width: 0; }
    .col i { flex: 1; border-radius: 3px 3px 1px 1px; background: var(--chart-1); min-height: 2px; animation: grow .6s var(--ease) both; transform-origin: bottom; }
    .col i.b { background: var(--chart-2); }
    .axis { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-3); margin-top: 6px; }
  `],
  template: `
    <div class="row between mb">
      <div class="segmented">
        @for (d of [7, 30, 90, 365]; track d) { <button [class.active]="days() === d" (click)="load(d)">{{ 'platform.days' | t: { days: d } }}</button> }
      </div>
    </div>
    @if (data(); as a) {
      <div class="grid grid-4">
        <div class="card kpi"><span class="stat-label">{{ 'platform.mrr' | t }}</span><span class="kpi-icon"><app-icon name="chart" /></span><span class="stat-value">{{ a.revenue.mrr | money: a.revenue.currency }}</span><span class="subtle">{{ 'platform.arr' | t }}: {{ a.revenue.arr | money: a.revenue.currency }}</span></div>
        <div class="card kpi"><span class="stat-label">{{ 'platform.signups' | t }}</span><span class="kpi-icon"><app-icon name="users" /></span><span class="stat-value">{{ a.users.signups | num }}</span><span class="subtle">{{ 'admin.users' | t }}: {{ a.users.total | num }}</span></div>
        <div class="card kpi"><span class="stat-label">{{ 'platform.conversion' | t }}</span><span class="kpi-icon"><app-icon name="zap" /></span><span class="stat-value">{{ a.conversion.rate }}%</span><span class="subtle">{{ a.conversion.converted }} / {{ a.conversion.cohort }}</span></div>
        <div class="card kpi"><span class="stat-label">{{ 'platform.openTickets' | t }}</span><span class="kpi-icon" [class.warn]="(a.support.open_by_priority['high'] ?? 0) + (a.support.open_by_priority['urgent'] ?? 0) > 0"><app-icon name="message" /></span><span class="stat-value">{{ a.support.open }}</span><span class="subtle">Business: {{ a.support.open_by_priority['high'] ?? 0 }} · Pro: {{ a.support.open_by_priority['normal'] ?? 0 }} · Free: {{ a.support.open_by_priority['low'] ?? 0 }}</span></div>
      </div>

      <div class="grid grid-3 mt">
        <div class="card span-2">
          <div class="card-header"><h3>{{ 'platform.signups' | t }} · {{ 'platform.active' | t }}</h3>
            <div class="legend"><span><i></i>{{ 'platform.active' | t }}</span><span><i class="alt"></i>{{ 'platform.signups' | t }}</span></div>
          </div>
          <div class="card-body">
            <div class="chart" role="img" [attr.aria-label]="'platform.active' | t">
              @for (p of a.series; track p.day) {
                <div class="col" [title]="p.day + ': ' + p.active + ' / ' + p.signups">
                  <i [style.height.%]="(p.active / max()) * 100"></i><i class="b" [style.height.%]="(p.signups / max()) * 100"></i>
                </div>
              }
            </div>
            <div class="axis"><span>{{ a.series[0]?.day }}</span><span>{{ a.series[a.series.length - 1]?.day }}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'platform.active' | t }}</h3></div>
          <dl class="card-body kv">
            <dt>{{ 'platform.dau' | t }}</dt><dd><strong>{{ a.users.dau }}</strong></dd>
            <dt>{{ 'platform.wau' | t }}</dt><dd><strong>{{ a.users.wau }}</strong></dd>
            <dt>{{ 'platform.mau' | t }}</dt><dd><strong>{{ a.users.mau }}</strong></dd>
            <dt>{{ 'platform.unverified' | t }}</dt><dd>{{ a.users.unverified }}</dd>
            <dt>{{ 'platform.with2fa' | t }}</dt><dd>{{ a.users.two_factor }}</dd>
          </dl>
        </div>
      </div>

      <div class="grid grid-3 mt">
        <div class="card">
          <div class="card-header"><h3>{{ 'admin.workspaces' | t }}</h3></div>
          <dl class="card-body kv">
            <dt>{{ 'common.all' | t }}</dt><dd>{{ a.workspaces.total }}</dd>
            <dt>{{ 'platform.filters.trial' | t }}</dt><dd>{{ a.workspaces.on_trial }}</dd>
            <dt>{{ 'platform.filters.paid' | t }}</dt><dd>{{ a.workspaces.paid }}</dd>
            <dt>{{ 'platform.filters.suspended' | t }}</dt><dd>{{ a.workspaces.suspended }}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'platform.paidByPlan' | t }}</h3></div>
          <div class="card-body stack">
            @for (p of ['pro', 'business']; track p) {
              <div class="hbar" style="grid-template-columns: 90px 1fr 40px"><span>{{ 'plan.' + p | t }}</span><div class="progress"><div [style.width.%]="share(a.workspaces.paid_by_plan[p] ?? 0, a.workspaces.paid)"></div></div><span class="right">{{ a.workspaces.paid_by_plan[p] ?? 0 }}</span></div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'platform.churn' | t }}</h3></div>
          <div class="card-body"><span class="stat-value" [class.danger]="a.revenue.churned_30d > 0">{{ a.revenue.churned_30d }}</span></div>
        </div>
      </div>
    }
  `,
})
export class AdminOverviewComponent {
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly data = signal<Analytics | null>(null);
  protected readonly days = signal(30);
  protected readonly max = computed(() => Math.max(1, ...(this.data()?.series ?? []).flatMap((p) => [p.active, p.signups])));

  ngOnInit(): void {
    this.load(30);
  }

  load(days: number): void {
    this.days.set(days);
    this.api.get<Analytics>('admin/analytics', { days }).subscribe((res) => this.data.set(res));
  }

  share(value: number, total: number): number {
    return total ? (value / total) * 100 : 0;
  }
}
