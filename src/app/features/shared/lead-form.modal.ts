import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { Lead } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI, splitTags } from '../../shared/ui';

@Component({
  selector: 'app-lead-form-modal',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="(lead() ? 'leads.edit' : 'leads.new') | t" (closed)="closed.emit()">
      <form id="lead-form" class="form-grid" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'common.name' | t }} *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required [class.invalid]="errors()['name']" />
          @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
        </div>
        <div class="field">
          <label>{{ 'common.email' | t }}</label>
          <input class="input" type="email" name="email" [(ngModel)]="form.email" [class.invalid]="errors()['email']" />
          @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
        </div>
        <div class="field"><label>{{ 'common.phone' | t }}</label><input class="input" type="tel" name="phone" [(ngModel)]="form.phone" /></div>
        <div class="field"><label>{{ 'common.company' | t }}</label><input class="input" name="company" [(ngModel)]="form.company" /></div>
        <div class="field">
          <label>{{ 'common.status' | t }}</label>
          <select class="select" name="status" [(ngModel)]="form.status">
            @for (s of statuses; track s) { <option [value]="s">{{ 'leads.status.' + s | t }}</option> }
          </select>
        </div>
        <div class="field">
          <label>{{ 'common.owner' | t }}</label>
          <select class="select" name="owner_id" [(ngModel)]="form.owner_id">
            <option [ngValue]="null">{{ 'common.unassigned' | t }}</option>
            @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
          </select>
        </div>
        <div class="field"><label>{{ 'common.tags' | t }}</label><input class="input" name="tags" [(ngModel)]="tags" [placeholder]="'common.tagsHint' | t" /></div>
        <div class="field full"><label>{{ 'common.message' | t }}</label><textarea class="textarea" name="message" [(ngModel)]="form.message"></textarea></div>
      </form>
      <div footer class="modal-footer">
        <button class="btn" type="button" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
        <button class="btn primary" type="submit" form="lead-form" [disabled]="busy()">{{ 'common.save' | t }}</button>
      </div>
    </app-modal>
  `,
})
export class LeadFormModal {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly members = inject(MembersService);

  readonly lead = input<Lead | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Lead>();

  protected readonly statuses = ['new', 'contacted', 'qualified', 'unqualified'];
  protected form: Partial<Lead> = {};
  protected tags = '';
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.members.load();
    const lead = this.lead();
    this.form = lead ? { ...lead } : { status: 'new', owner_id: this.auth.user()?.id ?? null };
    this.tags = (lead?.tags ?? []).join(', ');
  }

  save(): void {
    this.busy.set(true);
    const payload = {
      name: this.form.name, email: this.form.email || null, phone: this.form.phone, company: this.form.company, message: this.form.message,
      owner_id: this.form.owner_id, tags: splitTags(this.tags), ...(this.form.status !== 'converted' ? { status: this.form.status } : {}),
    };
    const lead = this.lead();
    const request = lead ? this.api.patch<{ data: Lead }>(`leads/${lead.id}`, payload) : this.api.post<{ data: Lead }>('leads', payload);
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
}
