import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { AutomationRule } from '../../core/models';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-automations-section',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (limit() === 0) {
      <div class="locked"><app-icon name="zap" /><p class="mt-sm">{{ 'common.locked' | t }} (Pro)</p><a class="btn gold mt" routerLink="/settings/subscription">{{ 'common.upgrade' | t }}</a></div>
    } @else {
      <div class="row between mb">
        <span class="muted">{{ rules().length }} / {{ limit() ?? '∞' }}</span>
        @if (auth.canWrite()) { <button class="btn primary" (click)="startNew()"><app-icon name="plus" [size]="16" /> {{ 'settings.automation.new' | t }}</button> }
      </div>
      <div class="card">
        @for (r of rules(); track r.id) {
          <div class="row" style="padding:14px 20px;border-bottom:1px solid var(--border)">
            <app-icon name="zap" />
            <div class="spacer">
              <div class="cell-title">{{ r.name }}</div>
              <div class="cell-sub">{{ 'settings.automation.triggers.' + r.trigger | t }} → {{ 'settings.automation.actions.' + r.action | t }}{{ r.action_config.title ? ': ' + r.action_config.title : '' }}</div>
            </div>
            <span class="subtle">{{ 'settings.automation.runs' | t }}: {{ r.runs_count }}</span>
            @if (auth.canWrite()) {
              <label class="check small"><input type="checkbox" [checked]="r.is_active" (change)="toggle(r)" /> {{ 'settings.automation.active' | t }}</label>
              <button class="btn sm" (click)="edit(r)"><app-icon name="edit" [size]="14" /></button>
              <button class="btn sm danger" (click)="remove(r)"><app-icon name="trash" [size]="14" /></button>
            }
          </div>
        } @empty { <div class="empty">{{ 'common.empty' | t }}</div> }
      </div>
    }

    @if (draft(); as d) {
      <app-modal [title]="'settings.automation.new' | t" (closed)="draft.set(null)">
        <div class="stack">
          <div class="field"><label>{{ 'common.name' | t }}</label><input class="input" [(ngModel)]="d.name" /></div>
          <div class="field">
            <label>{{ 'settings.automation.trigger' | t }}</label>
            <select class="select" [(ngModel)]="d.trigger">@for (t of triggers; track t) { <option [value]="t">{{ 'settings.automation.triggers.' + t | t }}</option> }</select>
          </div>
          <div class="field">
            <label>{{ 'settings.automation.action' | t }}</label>
            <select class="select" [(ngModel)]="d.action">
              <option value="create_task">{{ 'settings.automation.actions.create_task' | t }}</option>
              <option value="assign_owner" [disabled]="!auth.feature('auto_assignment')">{{ 'settings.automation.actions.assign_owner' | t }}{{ auth.feature('auto_assignment') ? '' : ' 🔒 Business' }}</option>
            </select>
          </div>
          @if (d.action === 'create_task') {
            <div class="field"><label>{{ 'settings.automation.taskTitle' | t }}</label><input class="input" [(ngModel)]="d.action_config.title" /></div>
            <div class="grid grid-2">
              <div class="field"><label>{{ 'settings.automation.dueIn' | t }}</label><input class="input" type="number" min="0" [(ngModel)]="d.action_config.due_in_days" /></div>
              <div class="field">
                <label>{{ 'tasks.priority' | t }}</label>
                <select class="select" [(ngModel)]="d.action_config.priority">@for (p of ['low', 'normal', 'high', 'urgent']; track p) { <option [value]="p">{{ 'tasks.priorities.' + p | t }}</option> }</select>
              </div>
            </div>
            <div class="field">
              <label>{{ 'tasks.assignee' | t }}</label>
              <select class="select" [(ngModel)]="d.action_config.assignee_id">
                <option [ngValue]="null">{{ 'common.owner' | t }}</option>
                @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
              </select>
            </div>
          }
          @if (error()) { <div class="banner danger">{{ error() }}</div> }
        </div>
        <div footer class="modal-footer">
          <button class="btn" (click)="draft.set(null)">{{ 'common.cancel' | t }}</button>
          <button class="btn primary" (click)="save(d)">{{ 'common.save' | t }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class AutomationsSection {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);

  protected readonly triggers = ['lead_created', 'client_created', 'deal_won', 'deal_lost'];
  protected readonly rules = signal<AutomationRule[]>([]);
  protected readonly draft = signal<Partial<AutomationRule> & { action_config: AutomationRule['action_config'] } | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.members.load();
    this.load();
  }

  limit(): number | null | undefined {
    return this.auth.subscription()?.limits['automations'];
  }

  load(): void {
    this.api.get<{ data: AutomationRule[] }>('automations').subscribe((res) => this.rules.set(res.data));
  }

  startNew(): void {
    this.error.set('');
    this.draft.set({ name: this.i18n.t('settings.automation.triggers.lead_created'), trigger: 'lead_created', action: 'create_task', action_config: { title: '📞 {name}', due_in_days: 1, priority: 'high', assignee_id: null } });
  }

  edit(rule: AutomationRule): void {
    this.error.set('');
    this.draft.set({ ...rule, action_config: { ...rule.action_config } });
  }

  save(draft: Partial<AutomationRule>): void {
    const payload = { name: draft.name, trigger: draft.trigger, action: draft.action, action_config: draft.action_config };
    const request = draft.id ? this.api.patch(`automations/${draft.id}`, payload) : this.api.post('automations', payload);
    request.subscribe({
      next: () => {
        this.draft.set(null);
        this.load();
        this.auth.refreshSubscription();
      },
      error: (err) => this.error.set(Object.values(fieldErrors(err))[0] ?? err?.error?.message ?? ''),
    });
  }

  toggle(rule: AutomationRule): void {
    this.api.patch(`automations/${rule.id}`, { is_active: !rule.is_active }).subscribe(() => this.load());
  }

  remove(rule: AutomationRule): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`automations/${rule.id}`).subscribe(() => {
        this.load();
        this.auth.refreshSubscription();
      });
    }
  }
}
