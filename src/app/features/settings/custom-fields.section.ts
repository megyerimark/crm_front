import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { CustomField } from '../../core/models';
import { UI, splitTags } from '../../shared/ui';

@Component({
  selector: 'app-custom-fields-section',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (limit() === 0) {
      <div class="locked"><app-icon name="lock" /><p class="mt-sm">{{ 'plan.limits.custom_fields' | t }} – {{ 'common.locked' | t }} (Pro)</p><a class="btn gold mt" routerLink="/settings/subscription">{{ 'common.upgrade' | t }}</a></div>
    } @else {
      <div class="card" style="max-width:820px">
        <div class="card-header"><h3>{{ 'settings.customFields' | t }}</h3><span class="subtle">{{ fields().length }} / {{ limit() ?? '∞' }}</span></div>
        @for (f of fields(); track f.id) {
          <div class="row" style="padding:12px 20px;border-bottom:1px solid var(--border)">
            <div class="spacer"><div class="cell-title">{{ f.label }}</div><div class="cell-sub">{{ f.key }} · {{ 'settings.customField.types.' + f.type | t }}{{ f.options.length ? ': ' + f.options.join(', ') : '' }}</div></div>
            @if (auth.canWrite()) { <button class="btn sm danger" (click)="remove(f)"><app-icon name="trash" [size]="14" /></button> }
          </div>
        }
        @if (auth.canWrite()) {
          <form class="card-body row wrap" (ngSubmit)="add()">
            <input class="input" style="flex:1;min-width:180px" name="label" [(ngModel)]="label" [placeholder]="'settings.customField.label' | t" />
            <select class="select" style="width:auto" name="type" [(ngModel)]="type">
              @for (t of types; track t) { <option [value]="t">{{ 'settings.customField.types.' + t | t }}</option> }
            </select>
            @if (type === 'select') { <input class="input" style="flex:1;min-width:180px" name="options" [(ngModel)]="options" [placeholder]="'forms.options' | t" /> }
            <button class="btn primary" type="submit"><app-icon name="plus" [size]="16" /> {{ 'settings.customField.new' | t }}</button>
            @if (error()) { <span class="error-text" style="width:100%">{{ error() }}</span> }
          </form>
        }
      </div>
    }
  `,
})
export class CustomFieldsSection {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly types = ['text', 'number', 'date', 'select', 'checkbox'];
  protected readonly fields = signal<CustomField[]>([]);
  protected readonly error = signal('');
  protected label = '';
  protected type = 'text';
  protected options = '';

  ngOnInit(): void {
    this.load();
  }

  limit(): number | null | undefined {
    return this.auth.subscription()?.limits['custom_fields'];
  }

  load(): void {
    this.api.get<{ data: CustomField[] }>('custom-fields').subscribe((res) => this.fields.set(res.data));
  }

  add(): void {
    this.api.post('custom-fields', { label: this.label, type: this.type, options: this.type === 'select' ? splitTags(this.options) : null }).subscribe({
      next: () => {
        this.label = '';
        this.options = '';
        this.error.set('');
        this.load();
        this.auth.refreshSubscription();
      },
      error: (err) => this.error.set(Object.values(fieldErrors(err))[0] ?? ''),
    });
  }

  remove(field: CustomField): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`custom-fields/${field.id}`).subscribe(() => this.load());
    }
  }
}
