import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { Workspace } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { timezoneList, UI } from '../../shared/ui';

@Component({
  selector: 'app-workspace-section',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" style="max-width:720px">
      <div class="card-header"><h3>{{ 'settings.workspace' | t }}</h3></div>
      <form class="card-body form-grid" (ngSubmit)="save()">
        <div class="field full">
          <label>{{ 'settings.workspaceName' | t }}</label><input class="input" name="name" [(ngModel)]="form.name" />
          @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
        </div>
        <div class="field">
          <label>{{ 'settings.country' | t }}</label>
          <select class="select" name="country" [(ngModel)]="form.country">
            @for (c of countries; track c[0]) { <option [value]="c[0]">{{ c[1] }}</option> }
          </select>
        </div>
        <div class="field">
          <label>{{ 'settings.currency' | t }}</label>
          <select class="select" name="currency" [(ngModel)]="form.currency"><option>HUF</option><option>EUR</option><option>USD</option><option>CHF</option><option>RON</option><option>CZK</option><option>PLN</option></select>
        </div>
        <div class="field">
          <label>{{ 'settings.timezone' | t }}</label>
          <select class="select" name="timezone" [(ngModel)]="form.timezone">@for (tz of timezones; track tz) { <option [value]="tz">{{ tz }}</option> }</select>
        </div>
        <div class="field">
          <label>{{ 'settings.defaultLanguage' | t }}</label>
          <select class="select" name="locale" [(ngModel)]="form.locale">@for (l of locales; track l.code) { <option [value]="l.code">{{ l.label }}</option> }</select>
        </div>
        <div class="full row end"><button class="btn primary" type="submit">{{ 'common.save' | t }}</button></div>
      </form>
    </div>
  `,
})
export class WorkspaceSection {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  protected readonly locales = LOCALES;
  protected readonly countries = [['HU', 'Magyarország'], ['AT', 'Österreich'], ['DE', 'Deutschland'], ['CH', 'Schweiz'], ['SK', 'Slovensko'], ['RO', 'România'], ['RS', 'Srbija'], ['HR', 'Hrvatska'], ['SI', 'Slovenija'], ['GB', 'United Kingdom']];
  protected readonly timezones = timezoneList(this.auth.workspace()?.timezone);
  protected form: Partial<Workspace> = { ...this.auth.workspace() };
  protected readonly errors = signal<Record<string, string>>({});

  save(): void {
    const { name, country, currency, timezone, locale } = this.form;
    this.api.patch<{ data: Workspace }>('workspace', { name, country, currency, timezone, locale }).subscribe({
      next: (res) => {
        this.auth.setWorkspaces(this.auth.workspaces().map((w) => (w.id === res.data.id ? res.data : w)));
        this.errors.set({});
        this.toast.success(this.i18n.t('common.saved'));
      },
      error: (err) => this.errors.set(fieldErrors(err)),
    });
  }
}
