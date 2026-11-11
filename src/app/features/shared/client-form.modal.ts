import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { Client, CustomField } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { UI, splitTags } from '../../shared/ui';

@Component({
  selector: 'app-client-form-modal',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="(client() ? 'clients.edit' : 'clients.new') | t" (closed)="closed.emit()">
      <form id="client-form" class="form-grid" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'common.name' | t }} *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required [class.invalid]="errors()['name']" />
          @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
        </div>
        <div class="field"><label>{{ 'common.company' | t }}</label><input class="input" name="company" [(ngModel)]="form.company" /></div>
        <div class="field">
          <label>{{ 'common.type' | t }}</label>
          <select class="select" name="type" [(ngModel)]="form.type"><option value="person">{{ 'clients.person' | t }}</option><option value="company">{{ 'clients.companyType' | t }}</option></select>
        </div>
        <div class="field">
          <label>{{ 'common.email' | t }}</label>
          <input class="input" type="email" name="email" [(ngModel)]="form.email" [class.invalid]="errors()['email']" />
          @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
        </div>
        <div class="field"><label>{{ 'common.phone' | t }}</label><input class="input" type="tel" name="phone" [(ngModel)]="form.phone" /></div>
        <div class="field full"><label>{{ 'common.address' | t }}</label><input class="input" name="address" [(ngModel)]="form.address" /></div>
        <div class="field">
          <label>{{ 'common.status' | t }}</label>
          <select class="select" name="status" [(ngModel)]="form.status">
            <option value="active">{{ 'clients.active' | t }}</option><option value="prospect">{{ 'clients.prospect' | t }}</option><option value="inactive">{{ 'clients.inactive' | t }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ 'common.owner' | t }}</label>
          <select class="select" name="owner_id" [(ngModel)]="form.owner_id">
            <option [ngValue]="null">{{ 'common.unassigned' | t }}</option>
            @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
          </select>
        </div>
        <div class="field"><label>{{ 'common.category' | t }}</label><input class="input" name="category" [(ngModel)]="form.category" /></div>
        <div class="field"><label>{{ 'common.tags' | t }}</label><input class="input" name="tags" [(ngModel)]="tags" [placeholder]="'common.tagsHint' | t" /></div>
        @for (field of customFields(); track field.id) {
          <div class="field" [class.full]="field.type === 'text'">
            <label>{{ field.label }}</label>
            @switch (field.type) {
              @case ('select') {
                <select class="select" [name]="'cf_' + field.key" [(ngModel)]="custom[field.key]">
                  <option [ngValue]="null">–</option>
                  @for (o of field.options; track o) { <option [ngValue]="o">{{ o }}</option> }
                </select>
              }
              @case ('checkbox') { <label class="check"><input type="checkbox" [name]="'cf_' + field.key" [(ngModel)]="custom[field.key]" /> {{ field.label }}</label> }
              @case ('number') { <input class="input" type="number" [name]="'cf_' + field.key" [(ngModel)]="custom[field.key]" /> }
              @case ('date') { <input class="input" type="date" [name]="'cf_' + field.key" [(ngModel)]="custom[field.key]" /> }
              @default { <input class="input" [name]="'cf_' + field.key" [(ngModel)]="custom[field.key]" /> }
            }
          </div>
        }
        <div class="field full"><label>{{ 'common.notes' | t }}</label><textarea class="textarea" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer class="modal-footer">
        <button class="btn" type="button" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
        <button class="btn primary" type="submit" form="client-form" [disabled]="busy()">{{ 'common.save' | t }}</button>
      </div>
    </app-modal>
  `,
})
export class ClientFormModal {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly members = inject(MembersService);

  readonly client = input<Client | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Client>();

  protected form: Partial<Client> = { type: 'person', status: 'active', owner_id: null };
  protected tags = '';
  protected custom: Record<string, unknown> = {};
  protected readonly customFields = signal<CustomField[]>([]);
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.members.load();
    const client = this.client();
    this.form = client ? { ...client } : { type: 'person', status: 'active', owner_id: this.auth.user()?.id ?? null };
    this.tags = (client?.tags ?? []).join(', ');
    this.custom = { ...(client?.custom_fields ?? {}) };
    if ((this.auth.subscription()?.limits['custom_fields'] ?? 0) !== 0) {
      this.api.get<{ data: CustomField[] }>('custom-fields').subscribe((res) => this.customFields.set(res.data));
    }
  }

  save(): void {
    this.busy.set(true);
    const payload = {
      name: this.form.name, company: this.form.company, email: this.form.email || null, phone: this.form.phone, address: this.form.address,
      type: this.form.type, status: this.form.status, owner_id: this.form.owner_id, category: this.form.category, notes: this.form.notes,
      tags: splitTags(this.tags), ...(this.customFields().length ? { custom_fields: this.custom } : {}),
    };
    const client = this.client();
    const request = client ? this.api.patch<{ data: Client }>(`clients/${client.id}`, payload) : this.api.post<{ data: Client }>('clients', payload);
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
