import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { BarChartComponent, BarPoint } from '../../shared/bar-chart.component';
import { UI } from '../../shared/ui';

interface Report {
  range: { from: string; to: string };
  monthly: BarPoint[];
  conversion: { leads: number; converted: number; rate: number };
  deals: Record<'open' | 'won' | 'lost', { count: number; value: number }>;
  tasks: { total: number; done: number; rate: number };
  forms?: { id: number; name: string; submissions: number; spam: number; leads: number; converted: number }[];
  sources?: { channel: string; medium: string | null; campaign: string | null; leads: number; converted: number; rate: number }[];
  team?: { id: number; name: string; role: string; tasks_done: number; tasks_open: number; tasks_overdue: number; leads_converted: number; deals_won: number; deals_won_value: number }[];
  locked: string[];
}

@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, RouterLink, BarChartComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ 'reports.title' | t }}</h1>
        <div class="row wrap">
          <label class="row small">{{ 'common.from' | t }} <input class="input sm" type="date" style="width:auto" [(ngModel)]="from" /></label>
          <label class="row small">{{ 'common.to' | t }} <input class="input sm" type="date" style="width:auto" [(ngModel)]="to" /></label>
          <button class="btn sm primary" (click)="load()">{{ 'common.apply' | t }}</button>
        </div>
      </div>
      @if (report(); as r) {
        <div class="grid grid-4">
          <div class="card stat"><span class="stat-label">{{ 'reports.conversion' | t }}</span><span class="stat-value">{{ r.conversion.rate }}%</span><span class="subtle">{{ r.conversion.converted }} / {{ r.conversion.leads }}</span></div>
          <div class="card stat"><span class="stat-label">{{ 'reports.won' | t }}</span><span class="stat-value">{{ r.deals.won.count }}</span><span class="subtle">{{ r.deals.won.value | money }}</span></div>
          <div class="card stat"><span class="stat-label">{{ 'reports.lost' | t }}</span><span class="stat-value">{{ r.deals.lost.count }}</span><span class="subtle">{{ r.deals.lost.value | money }}</span></div>
          <div class="card stat"><span class="stat-label">{{ 'reports.tasks' | t }}</span><span class="stat-value">{{ r.tasks.rate }}%</span><span class="subtle">{{ r.tasks.done }} / {{ r.tasks.total }}</span></div>
        </div>
        <div class="card mt">
          <div class="card-header"><h2>{{ 'reports.monthly' | t }}</h2></div>
          <div class="card-body"><app-bar-chart [data]="r.monthly" [labels]="[('reports.clients' | t), ('reports.leads' | t)]" /></div>
        </div>

        @if (r.forms) {
          <div class="grid grid-2 mt">
            <div class="card">
              <div class="card-header"><h2>{{ 'reports.forms' | t }}</h2></div>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>{{ 'leads.form' | t }}</th><th class="right">{{ 'reports.submissions' | t }}</th><th class="right">{{ 'reports.spam' | t }}</th><th class="right">{{ 'reports.leads' | t }}</th><th class="right">{{ 'reports.converted' | t }}</th></tr></thead>
                <tbody>@for (f of r.forms; track f.id) { <tr><td>{{ f.name }}</td><td class="right">{{ f.submissions }}</td><td class="right subtle">{{ f.spam }}</td><td class="right">{{ f.leads }}</td><td class="right">{{ f.converted }}</td></tr> } @empty { <tr><td colspan="5"><div class="empty small">{{ 'common.empty' | t }}</div></td></tr> }</tbody>
              </table></div>
            </div>
            <div class="card">
              <div class="card-header"><h2>{{ 'reports.sources' | t }}</h2></div>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>{{ 'reports.channel' | t }}</th><th>{{ 'reports.medium' | t }}</th><th>{{ 'reports.campaign' | t }}</th><th class="right">{{ 'reports.leads' | t }}</th><th class="right">{{ 'reports.rate' | t }}</th></tr></thead>
                <tbody>@for (s of r.sources ?? []; track $index) { <tr><td>{{ s.channel }}</td><td class="subtle">{{ s.medium ?? '–' }}</td><td class="subtle">{{ s.campaign ?? '–' }}</td><td class="right">{{ s.leads }}</td><td class="right">{{ s.rate }}%</td></tr> } @empty { <tr><td colspan="5"><div class="empty small">{{ 'common.empty' | t }}</div></td></tr> }</tbody>
              </table></div>
            </div>
          </div>
        } @else {
          <div class="locked mt"><app-icon name="lock" /><p class="mt-sm">{{ 'plan.feature.advanced_reports' | t }} – {{ 'reports.lockedText' | t: { plan: 'Pro' } }}</p><a class="btn gold mt" routerLink="/settings/subscription">{{ 'common.upgrade' | t }}</a></div>
        }

        @if (r.team) {
          <div class="card mt">
            <div class="card-header"><h2>{{ 'reports.team' | t }}</h2></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>{{ 'common.name' | t }}</th><th class="right">{{ 'reports.tasksDone' | t }}</th><th class="right">{{ 'reports.tasksOpen' | t }}</th><th class="right">{{ 'reports.tasksOverdue' | t }}</th><th class="right">{{ 'reports.converted' | t }}</th><th class="right">{{ 'reports.dealsWon' | t }}</th></tr></thead>
              <tbody>@for (m of r.team; track m.id) {
                <tr><td><div class="cell-title">{{ m.name }}</div><div class="cell-sub">{{ 'roles.' + m.role | t }}</div></td><td class="right">{{ m.tasks_done }}</td><td class="right">{{ m.tasks_open }}</td><td class="right" [style.color]="m.tasks_overdue ? 'var(--danger)' : null">{{ m.tasks_overdue }}</td><td class="right">{{ m.leads_converted }}</td><td class="right">{{ m.deals_won }} · {{ m.deals_won_value | money }}</td></tr>
              }</tbody>
            </table></div>
          </div>
        } @else {
          <div class="locked mt"><app-icon name="lock" /><p class="mt-sm">{{ 'plan.feature.team_reports' | t }} – {{ 'reports.lockedText' | t: { plan: 'Business' } }}</p></div>
        }
      }
    </div>
  `,
})
export class ReportsPage {
  private readonly api = inject(ApiService);
  protected readonly report = signal<Report | null>(null);
  protected from = '';
  protected to = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Report>('reports', { from: this.from, to: this.to }).subscribe((res) => {
      this.report.set(res);
      this.from = res.range.from;
      this.to = res.range.to;
    });
  }
}
