import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { LeadForm } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-forms-page',
  imports: [LowerCasePipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ 'forms.title' | t }}</h1>
          <p>{{ usage() }}</p>
        </div>
        @if (auth.canWrite()) { <button class="btn primary" (click)="create()" [disabled]="busy()"><app-icon name="plus" [size]="16" /> {{ 'forms.new' | t }}</button> }
      </div>
      <div class="grid grid-3">
        @for (f of forms(); track f.id) {
          <div class="card" style="cursor:pointer" (click)="open(f)">
            <div class="card-body stack">
              <div class="row between">
                <h3 class="truncate">{{ f.name }}</h3>
                <span class="badge" [class.success]="f.status === 'published'">{{ 'forms.' + f.status | t }}</span>
              </div>
              <p class="muted truncate">{{ f.title || f.public_url }}</p>
              <div class="row between">
                <span class="subtle">{{ f.fields.length }} {{ 'forms.fields' | t | lowercase }}</span>
                <strong>{{ f.submissions_count | num }} {{ 'forms.submissions' | t | lowercase }}</strong>
              </div>
              @if (f.status === 'published') {
                <button class="btn sm" (click)="copy(f.public_url, $event)"><app-icon name="link" [size]="14" /> {{ 'forms.link' | t }}</button>
              }
            </div>
          </div>
        } @empty {
          <div class="card span-2"><div class="empty"><app-icon name="form" [size]="32" /><h3 class="mt-sm">{{ 'dashboard.stepForm' | t }}</h3></div></div>
        }
      </div>
    </div>
  `,
})
export class FormsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly forms = signal<LeadForm[]>([]);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    this.api.get<{ data: LeadForm[] }>('forms').subscribe((res) => this.forms.set(res.data));
  }

  usage(): string {
    const usage = this.auth.subscription()?.usage['forms'];
    return usage ? `${usage.used} / ${usage.limit ?? '∞'}` : '';
  }

  create(): void {
    this.busy.set(true);
    this.api.post<{ data: LeadForm }>('forms', { name: this.i18n.t('forms.new'), title: this.i18n.t('forms.new') }).subscribe({
      next: (res) => {
        this.auth.refreshSubscription();
        void this.router.navigate(['/forms', res.data.id]);
      },
      error: () => this.busy.set(false),
    });
  }

  open(form: LeadForm): void {
    void this.router.navigate(['/forms', form.id]);
  }

  copy(text: string, event: Event): void {
    event.stopPropagation();
    void navigator.clipboard?.writeText(text).then(() => this.toast.success(this.i18n.t('common.copied')));
  }
}
