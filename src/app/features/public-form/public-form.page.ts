import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { PublicForm } from '../../core/models';
import { UI } from '../../shared/ui';

/**
 * Public lead form (shareable link and iframe embed). Server side validation, honeypot and
 * timing token come from the API; UTM parameters and the referrer are forwarded for source tracking.
 */
@Component({
  selector: 'app-public-form-page',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--bg); padding: 32px 16px; }
    :host(.embed) { background: transparent; padding: 0; min-height: 0; }
    .wrap { max-width: 560px; margin: 0 auto; }
    .hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
    .thanks { text-align: center; padding: 40px 20px; }
    .thanks .ok { width: 56px; height: 56px; border-radius: 50%; background: var(--success-soft); color: var(--success); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  `],
  host: { '[class.embed]': 'embed()' },
  template: `
    <div class="wrap">
      @if (unavailable()) {
        <div class="card"><div class="empty">{{ 'publicForm.unavailable' | t }}</div></div>
      } @else if (form(); as f) {
        <div class="card">
          @if (thanks()) {
            <div class="thanks">
              <div class="ok"><app-icon name="check" [size]="28" /></div>
              <h2>{{ 'publicForm.sent' | t }}</h2>
              <p class="muted mt-sm">{{ thanks() }}</p>
            </div>
          } @else {
            <div class="card-body">
              <h1 style="font-size:22px">{{ f.title }}</h1>
              @if (f.description) { <p class="muted mt-sm" style="white-space:pre-wrap">{{ f.description }}</p> }
            </div>
            <form class="card-body stack" style="border-top:1px solid var(--border)" (ngSubmit)="submit()" novalidate>
              @for (field of f.fields; track field.key) {
                <div class="field">
                  @if (field.type !== 'checkbox') { <label [for]="'f_' + field.key">{{ field.label }}{{ field.required ? ' *' : '' }}</label> }
                  @switch (field.type) {
                    @case ('textarea') { <textarea class="textarea" [id]="'f_' + field.key" [name]="field.key" [(ngModel)]="values[field.key]" [placeholder]="field.placeholder ?? ''" [class.invalid]="err(field.key)"></textarea> }
                    @case ('select') {
                      <select class="select" [id]="'f_' + field.key" [name]="field.key" [(ngModel)]="values[field.key]" [class.invalid]="err(field.key)">
                        <option [ngValue]="null">–</option>
                        @for (o of field.options ?? []; track o) { <option [ngValue]="o">{{ o }}</option> }
                      </select>
                    }
                    @case ('checkbox') { <label class="check"><input type="checkbox" [name]="field.key" [(ngModel)]="values[field.key]" /> {{ field.label }}{{ field.required ? ' *' : '' }}</label> }
                    @default {
                      <input class="input" [id]="'f_' + field.key" [type]="field.type" [name]="field.key" [(ngModel)]="values[field.key]" [placeholder]="field.placeholder ?? ''"
                             [attr.autocomplete]="autocomplete(field.key)" [class.invalid]="err(field.key)" />
                    }
                  }
                  @if (err(field.key)) { <span class="error-text">{{ err(field.key) }}</span> }
                </div>
              }
              <div class="hp" aria-hidden="true">
                <label>Website<input type="text" [name]="honeypot" tabindex="-1" autocomplete="off" [(ngModel)]="trap" /></label>
              </div>
              @if (f.privacy_url) {
                <label class="check small">
                  <input type="checkbox" name="privacy_accepted" [(ngModel)]="privacy" />
                  <span>{{ privacyBefore() }}<a [href]="f.privacy_url" target="_blank" rel="noopener">{{ 'publicForm.privacyLink' | t }}</a>{{ privacyAfter() }} *</span>
                </label>
                @if (errors()['privacy_accepted']) { <span class="error-text">{{ errors()['privacy_accepted'] }}</span> }
              }
              @if (f.ask_marketing_consent) {
                <label class="check small"><input type="checkbox" name="marketing_consent" [(ngModel)]="marketing" /> <span>{{ 'publicForm.marketing' | t }}</span></label>
              }
              @if (generalError()) { <div class="banner danger">{{ generalError() }}</div> }
              <button class="btn primary block" type="submit" [disabled]="busy()">{{ (busy() ? 'publicForm.sending' : 'publicForm.submit') | t }}</button>
            </form>
          }
        </div>
        @if (f.show_branding) { <p class="center subtle mt">{{ 'publicForm.poweredBy' | t }}</p> }
      } @else {
        <div class="card"><div class="card-body"><div class="skeleton" style="width:50%;height:20px"></div><div class="skeleton mt" style="height:38px"></div><div class="skeleton mt" style="height:38px"></div></div></div>
      }
    </div>
  `,
})
export class PublicFormPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  readonly slug = input.required<string>();

  protected readonly form = signal<PublicForm | null>(null);
  protected readonly unavailable = signal(false);
  protected readonly thanks = signal('');
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly generalError = signal('');
  protected readonly embed = signal(false);
  protected values: Record<string, unknown> = {};
  protected privacy = false;
  protected marketing = false;
  protected trap = '';
  protected honeypot = 'website';
  private token = '';

  ngOnInit(): void {
    this.embed.set(this.route.snapshot.queryParamMap.get('embed') === '1');
    this.api.get<{ data: PublicForm; token: string; honeypot: string }>(`public/forms/${this.slug()}`).subscribe({
      next: (res) => {
        this.form.set(res.data);
        this.token = res.token;
        this.honeypot = res.honeypot;
        this.i18n.use(res.data.locale);
      },
      error: () => this.unavailable.set(true),
    });
  }

  privacyBefore(): string {
    return this.i18n.t('publicForm.privacy').split('{link}')[0];
  }

  privacyAfter(): string {
    return this.i18n.t('publicForm.privacy').split('{link}')[1] ?? '';
  }

  err(key: string): string {
    return this.errors()[`data.${key}`] ?? '';
  }

  autocomplete(key: string): string | null {
    return { name: 'name', email: 'email', phone: 'tel', company: 'organization' }[key] ?? null;
  }

  submit(): void {
    this.busy.set(true);
    this.errors.set({});
    this.generalError.set('');
    const query = this.route.snapshot.queryParamMap;
    const utm = { source: query.get('utm_source'), medium: query.get('utm_medium'), campaign: query.get('utm_campaign'), content: query.get('utm_content') };
    let referrer = document.referrer || null;
    try {
      referrer = this.embed() && window.parent !== window ? document.referrer || null : referrer;
    } catch {
      /* cross-origin parent */
    }
    this.api
      .post<{ message: string }>(`public/forms/${this.slug()}/submissions`, {
        data: this.values, _token: this.token, [this.honeypot]: this.trap, privacy_accepted: this.privacy, marketing_consent: this.marketing,
        utm, referrer, via_link: !this.embed(),
      })
      .subscribe({
        next: (res) => this.thanks.set(res.message),
        error: (err) => {
          this.busy.set(false);
          const errors = fieldErrors(err);
          this.errors.set(errors);
          if (!Object.keys(errors).length) {
            this.generalError.set(err?.error?.message || this.i18n.t('errors.server'));
          }
        },
      });
  }
}
