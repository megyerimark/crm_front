import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { Client, Deal, Paginated, Stage } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-deal-form-modal',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="(deal() ? 'pipeline.editDeal' : 'pipeline.newDeal') | t" (closed)="closed.emit()">
      <form id="deal-form" class="form-grid" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'pipeline.dealTitle' | t }} *</label>
          <input class="input" name="title" [(ngModel)]="form.title" required [class.invalid]="errors()['title']" />
          @if (errors()['title']) { <span class="error-text">{{ errors()['title'] }}</span> }
        </div>
        <div class="field">
          <label>{{ 'pipeline.stage' | t }}</label>
          <select class="select" name="stage_id" [(ngModel)]="form.stage_id">
            @for (s of stages(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>{{ 'pipeline.client' | t }}</label>
          <select class="select" name="client_id" [(ngModel)]="form.client_id">
            <option [ngValue]="null">–</option>
            @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}{{ c.company ? ' · ' + c.company : '' }}</option> }
          </select>
        </div>
        <div class="field"><label>{{ 'pipeline.value' | t }}</label><input class="input" type="number" min="0" name="value" [(ngModel)]="form.value" /></div>
        <div class="field">
          <label>{{ 'pipeline.currency' | t }}</label>
          <select class="select" name="currency" [(ngModel)]="form.currency"><option>HUF</option><option>EUR</option><option>USD</option><option>CHF</option></select>
        </div>
        <div class="field"><label>{{ 'pipeline.expectedClose' | t }}</label><input class="input" type="date" name="close" [(ngModel)]="form.expected_close_date" /></div>
        <div class="field">
          <label>{{ 'common.owner' | t }}</label>
          <select class="select" name="owner_id" [(ngModel)]="form.owner_id">
            <option [ngValue]="null">{{ 'common.unassigned' | t }}</option>
            @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
          </select>
        </div>
      </form>
      @if (deal()?.stage_changes?.length) {
        <h3 class="mt mb">{{ 'pipeline.history' | t }}</h3>
        <div class="stack-sm small">
          @for (c of deal()!.stage_changes!; track $index) {
            <div class="row"><app-icon name="clock" [size]="14" /> <span class="subtle nowrap">{{ c.created_at | dt }}</span> <span>{{ c.from ?? '–' }} → <strong>{{ c.to }}</strong></span> <span class="subtle">{{ c.user }}</span></div>
          }
        </div>
      }
      <div footer class="modal-footer">
        @if (deal()) { <button class="btn danger" type="button" (click)="remove()">{{ 'common.delete' | t }}</button><span class="spacer"></span> }
        <button class="btn" type="button" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
        <button class="btn primary" type="submit" form="deal-form" [disabled]="busy()">{{ 'common.save' | t }}</button>
      </div>
    </app-modal>
  `,
})
export class DealFormModal {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly members = inject(MembersService);

  readonly deal = input<Deal | null>(null);
  readonly stages = input<Stage[]>([]);
  readonly stageId = input<number | null>(null);
  readonly clientId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Deal | null>();

  protected form: Partial<Deal> = {};
  protected readonly clients = signal<Client[]>([]);
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.members.load();
    const deal = this.deal();
    this.form = deal
      ? { ...deal }
      : { stage_id: this.stageId() ?? this.stages()[0]?.id, client_id: this.clientId(), value: 0, currency: this.auth.currency(), owner_id: this.auth.user()?.id ?? null };
    this.api.get<Paginated<Client>>('clients', { per_page: 100, sort: 'name', direction: 'asc' }).subscribe((res) => this.clients.set(res.data));
    if (deal) {
      this.api.get<{ data: Deal }>(`deals/${deal.id}`).subscribe((res) => (this.form = { ...this.form, stage_changes: res.data.stage_changes }));
    }
  }

  save(): void {
    this.busy.set(true);
    const payload = {
      title: this.form.title, stage_id: this.form.stage_id, client_id: this.form.client_id, value: this.form.value || 0, currency: this.form.currency,
      expected_close_date: this.form.expected_close_date || null, owner_id: this.form.owner_id,
    };
    const deal = this.deal();
    const request = deal ? this.api.patch<{ data: Deal }>(`deals/${deal.id}`, payload) : this.api.post<{ data: Deal }>('deals', payload);
    request.subscribe({
      next: (res) => {
        this.toast.success(this.i18n.t('common.saved'));
        this.saved.emit(res.data);
      },
      error: (err) => {
        this.errors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }

  remove(): void {
    const deal = this.deal();
    if (deal && confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`deals/${deal.id}`).subscribe(() => this.saved.emit(null));
    }
  }
}
