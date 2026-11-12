import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { MembersService } from '../../core/members.service';
import { FormField, FormSubmission, LeadForm, Paginated } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI, splitTags } from '../../shared/ui';

const BASE_FIELDS = ['name', 'email', 'phone', 'company', 'message'];

@Component({
  selector: 'app-form-editor-page',
  imports: [FormsModule, RouterLink, LowerCasePipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/forms" class="small row mb"><app-icon name="chevronLeft" [size]="14" /> {{ 'forms.title' | t }}</a>
      @if (form(); as f) {
        <div class="page-header">
          <div>
            <h1>{{ f.name }}</h1>
            <div class="row mt-sm"><span class="badge" [class.success]="f.status === 'published'">{{ 'forms.' + f.status | t }}</span><span class="subtle">{{ f.submissions_count }} {{ 'forms.submissions' | t | lowercase }}</span></div>
          </div>
          @if (auth.canWrite()) {
            <div class="row wrap">
              <button class="btn danger" (click)="remove()"><app-icon name="trash" [size]="16" /></button>
              <a class="btn" [href]="f.public_url" target="_blank" rel="noopener"><app-icon name="eye" [size]="16" /> {{ 'forms.preview' | t }}</a>
              @if (f.status === 'published') {
                <button class="btn" (click)="save('draft')">{{ 'forms.unpublish' | t }}</button>
              } @else {
                <button class="btn gold" (click)="save('published')">{{ 'forms.publish' | t }}</button>
              }
              <button class="btn primary" (click)="save()" [disabled]="busy()">{{ 'common.save' | t }}</button>
            </div>
          }
        </div>

        <div class="tabs">
          <button [class.active]="tab() === 'edit'" (click)="tab.set('edit')">{{ 'forms.fields' | t }}</button>
          <button [class.active]="tab() === 'share'" (click)="tab.set('share')">{{ 'forms.share' | t }}</button>
          <button [class.active]="tab() === 'submissions'" (click)="tab.set('submissions'); loadSubmissions()">{{ 'forms.submissions' | t }}</button>
        </div>

        @switch (tab()) {
          @case ('edit') {
            <div class="grid grid-3">
              <div class="card span-2">
                <div class="card-header"><h3>{{ 'forms.fields' | t }}</h3></div>
                <div class="card-body stack">
                  @if (errors()['fields']) { <div class="banner danger">{{ errors()['fields'] }}</div> }
                  @for (field of draft.fields; track $index; let i = $index) {
                    <div class="card flat" style="padding:12px">
                      <div class="form-grid" style="grid-template-columns: 1.4fr 1fr 1fr auto; align-items:end">
                        <div class="field"><label>{{ 'forms.fieldLabel' | t }}</label><input class="input sm" [(ngModel)]="field.label" [name]="'label' + i" /></div>
                        <div class="field">
                          <label>{{ 'forms.fieldKey' | t }}</label>
                          <input class="input sm" [(ngModel)]="field.key" [name]="'key' + i" [disabled]="isBase(field.key)" />
                        </div>
                        <div class="field">
                          <label>{{ 'forms.fieldType' | t }}</label>
                          <select class="select sm" [(ngModel)]="field.type" [name]="'type' + i">
                            @for (type of types; track type) { <option [value]="type">{{ 'forms.types.' + type | t }}</option> }
                          </select>
                        </div>
                        <div class="row">
                          <label class="check small"><input type="checkbox" [(ngModel)]="field.required" [name]="'req' + i" /> *</label>
                          <button class="btn ghost sm icon" (click)="move(i, -1)" [disabled]="i === 0">↑</button>
                          <button class="btn ghost sm icon" (click)="move(i, 1)" [disabled]="i === draft.fields.length - 1">↓</button>
                          <button class="btn ghost sm icon" (click)="removeField(i)"><app-icon name="x" [size]="14" /></button>
                        </div>
                        @if (field.type === 'select') {
                          <div class="field full"><label>{{ 'forms.options' | t }}</label><input class="input sm" [ngModel]="(field.options ?? []).join(', ')" (ngModelChange)="field.options = split($event)" [name]="'opt' + i" /></div>
                        }
                      </div>
                    </div>
                  }
                  <div class="row wrap">
                    @for (key of missingBase(); track key) {
                      <button class="btn sm" (click)="addBase(key)"><app-icon name="plus" [size]="14" /> {{ 'common.' + key | t }}</button>
                    }
                    @if (auth.feature('custom_form_fields')) {
                      <button class="btn sm primary" (click)="addCustom()"><app-icon name="plus" [size]="14" /> {{ 'forms.addField' | t }}</button>
                    } @else {
                      <span class="badge gold"><app-icon name="lock" [size]="12" /> {{ 'forms.customFieldsLocked' | t }}</span>
                    }
                  </div>
                </div>
              </div>
              <div class="card">
                <div class="card-header"><h3>{{ 'nav.settings' | t }}</h3></div>
                <div class="card-body stack">
                  <div class="field"><label>{{ 'forms.name' | t }}</label><input class="input" [(ngModel)]="draft.name" name="name" /></div>
                  <div class="field"><label>{{ 'forms.publicTitle' | t }}</label><input class="input" [(ngModel)]="draft.title" name="title" /></div>
                  <div class="field"><label>{{ 'common.description' | t }}</label><textarea class="textarea" [(ngModel)]="draft.description" name="description"></textarea></div>
                  <div class="field">
                    <label>{{ 'common.language' | t }}</label>
                    <select class="select" [(ngModel)]="draft.locale" name="locale"><option value="hu">Magyar</option><option value="en">English</option><option value="de">Deutsch</option></select>
                  </div>
                  <div class="field"><label>{{ 'forms.thankYou' | t }}</label><textarea class="textarea" [(ngModel)]="draft.thank_you_message" name="thanks"></textarea></div>
                  <div class="field">
                    <label>{{ 'forms.privacyUrl' | t }}</label>
                    <input class="input" type="url" [(ngModel)]="draft.privacy_url" name="privacy" placeholder="https://" [class.invalid]="errors()['privacy_url']" />
                    @if (errors()['privacy_url']) { <span class="error-text">{{ errors()['privacy_url'] }}</span> }
                    @if (f.privacy_version) { <span class="hint">v{{ f.privacy_version }}</span> }
                  </div>
                  <label class="check small"><input type="checkbox" [(ngModel)]="draft.ask_marketing_consent" name="mc" /> {{ 'forms.marketingConsent' | t }}</label>
                  <label class="check small"><input type="checkbox" [(ngModel)]="draft.notify_owner" name="no" /> {{ 'forms.notifyOwner' | t }}</label>
                  <div class="field"><label>{{ 'forms.notifyEmails' | t }}</label><input class="input" [(ngModel)]="notifyEmails" name="ne" [placeholder]="'common.tagsHint' | t" /></div>
                  <div class="field">
                    <label>{{ 'forms.defaultOwner' | t }}</label>
                    <select class="select" [(ngModel)]="draft.default_owner_id" name="owner">
                      <option [ngValue]="null">{{ 'roles.owner' | t }}</option>
                      @for (m of members.members(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
                    </select>
                  </div>
                  <label class="check small">
                    <input type="checkbox" [(ngModel)]="draft.show_branding" name="brand" [disabled]="!auth.feature('remove_branding')" /> {{ 'forms.branding' | t }}
                    @if (!auth.feature('remove_branding')) { <app-icon name="lock" [size]="12" /> }
                  </label>
                </div>
              </div>
            </div>
          }
          @case ('share') {
            <div class="grid grid-2">
              <div class="card">
                <div class="card-header"><h3>{{ 'forms.link' | t }}</h3></div>
                <div class="card-body stack">
                  @if (f.status !== 'published') { <div class="banner warning">{{ 'forms.draft' | t }} – {{ 'forms.publish' | t }}</div> }
                  <div class="row"><input class="input" readonly [value]="f.public_url" /><button class="btn" (click)="copy(f.public_url)"><app-icon name="copy" [size]="16" /></button></div>
                  <p class="hint">{{ 'forms.utmHint' | t }}</p>
                  <div class="row"><code class="truncate" style="flex:1">{{ utmExample() }}</code><button class="btn sm" (click)="copy(utmExample())"><app-icon name="copy" [size]="14" /></button></div>
                  @if (!auth.feature('utm_tracking')) { <span class="badge gold"><app-icon name="lock" [size]="12" /> {{ 'plan.feature.utm_tracking' | t }}: Pro</span> }
                </div>
              </div>
              <div class="card">
                <div class="card-header"><h3>{{ 'forms.embed' | t }}</h3><button class="btn sm" (click)="copy(f.embed_code)"><app-icon name="copy" [size]="14" /> {{ 'common.copy' | t }}</button></div>
                <div class="card-body"><pre>{{ f.embed_code }}</pre></div>
              </div>
            </div>
          }
          @case ('submissions') {
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>{{ 'common.date' | t }}</th><th>{{ 'common.status' | t }}</th><th>{{ 'common.name' | t }}</th><th>{{ 'common.email' | t }}</th><th>{{ 'leads.utm' | t }}</th><th>{{ 'nav.leads' | t }}</th></tr></thead>
                  <tbody>
                    @for (s of submissions()?.data ?? []; track s.id) {
                      <tr>
                        <td class="nowrap subtle">{{ s.created_at | dt }}</td>
                        <td><span class="badge" [class.success]="s.status === 'accepted'" [class.danger]="s.status === 'spam'" [class.warning]="s.status === 'over_limit'">{{ 'forms.' + s.status | t }}</span></td>
                        <td>{{ str(s.data['name']) }}</td>
                        <td>{{ str(s.data['email']) }}</td>
                        <td class="small">{{ s.utm.source ?? '–' }}{{ s.utm.campaign ? ' / ' + s.utm.campaign : '' }}</td>
                        <td>@if (s.lead_id) { <a [routerLink]="['/leads', s.lead_id]">→</a> }</td>
                      </tr>
                    } @empty { <tr><td colspan="6"><div class="empty">{{ 'common.empty' | t }}</div></td></tr> }
                  </tbody>
                </table>
              </div>
              <app-pagination [meta]="submissions()?.meta ?? null" (page)="loadSubmissions($event)" (perPage)="loadSubmissions(1)" />
            </div>
          }
        }
      }
    </div>
  `,
})
export class FormEditorPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);
  readonly id = input.required<string>();

  protected readonly types = ['text', 'email', 'tel', 'textarea', 'number', 'select', 'checkbox', 'date'];
  protected readonly form = signal<LeadForm | null>(null);
  protected readonly submissions = signal<Paginated<FormSubmission> | null>(null);
  protected readonly tab = signal<'edit' | 'share' | 'submissions'>('edit');
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected draft = {} as LeadForm;
  protected notifyEmails = '';

  protected readonly utmExample = computed(() => `${this.form()?.public_url}?utm_source=facebook&utm_medium=social&utm_campaign=spring`);

  ngOnInit(): void {
    this.members.load();
    this.api.get<{ data: LeadForm }>(`forms/${this.id()}`).subscribe({
      next: (res) => this.apply(res.data),
      error: () => void this.router.navigateByUrl('/forms'),
    });
  }

  apply(form: LeadForm): void {
    this.form.set(form);
    this.draft = structuredClone(form);
    this.notifyEmails = form.notify_emails.join(', ');
  }

  isBase(key: string): boolean {
    return BASE_FIELDS.includes(key);
  }

  missingBase(): string[] {
    return BASE_FIELDS.filter((key) => !this.draft.fields?.some((f) => f.key === key));
  }

  addBase(key: string): void {
    const types: Record<string, FormField['type']> = { email: 'email', phone: 'tel', message: 'textarea' };
    this.draft.fields.push({ key, label: this.i18n.t('common.' + key), type: types[key] ?? 'text', required: false });
  }

  addCustom(): void {
    this.draft.fields.push({ key: `field_${this.draft.fields.length + 1}`, label: '', type: 'text', required: false });
  }

  removeField(index: number): void {
    this.draft.fields.splice(index, 1);
  }

  move(index: number, direction: number): void {
    const fields = this.draft.fields;
    [fields[index], fields[index + direction]] = [fields[index + direction], fields[index]];
  }

  split(value: string): string[] {
    return splitTags(value);
  }

  str(value: unknown): string {
    return value === null || value === undefined ? '–' : String(value);
  }

  save(status?: 'draft' | 'published'): void {
    this.busy.set(true);
    this.errors.set({});
    const d = this.draft;
    const payload = {
      name: d.name, title: d.title, description: d.description, locale: d.locale, fields: d.fields, thank_you_message: d.thank_you_message,
      privacy_url: d.privacy_url || null, ask_marketing_consent: d.ask_marketing_consent, notify_owner: d.notify_owner, notify_emails: splitTags(this.notifyEmails),
      show_branding: d.show_branding, default_owner_id: d.default_owner_id, ...(status ? { status } : {}),
    };
    this.api.patch<{ data: LeadForm }>(`forms/${this.id()}`, payload).subscribe({
      next: (res) => {
        this.apply(res.data);
        this.busy.set(false);
        this.toast.success(this.i18n.t('common.saved'));
      },
      error: (err) => {
        const errors = fieldErrors(err);
        const fieldError = Object.entries(errors).find(([key]) => key.startsWith('fields'));
        this.errors.set({ ...errors, ...(fieldError ? { fields: fieldError[1] } : {}) });
        this.busy.set(false);
      },
    });
  }

  loadSubmissions(page = 1): void {
    this.api.get<Paginated<FormSubmission>>(`forms/${this.id()}/submissions`, { page }).subscribe((res) => this.submissions.set(res));
  }

  copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => this.toast.success(this.i18n.t('common.copied')));
  }

  remove(): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`forms/${this.id()}`).subscribe(() => {
        this.auth.refreshSubscription();
        void this.router.navigateByUrl('/forms');
      });
    }
  }
}
