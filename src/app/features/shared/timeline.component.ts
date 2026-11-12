import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Activity, Paginated } from '../../core/models';
import { UI } from '../../shared/ui';

const ICONS: Record<string, string> = {
  call: '📞', email: '✉️', meeting: '🤝', online_meeting: '💻', note: '📝', status_change: '🔄', system: '⚙️', form_submission: '📥', conversion: '⭐', stage_change: '➡️',
};

/** Chronological contact history for a client / lead / deal with a quick "log activity" box. */
@Component({
  selector: 'app-timeline',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.canWrite()) {
      <form class="stack" (ngSubmit)="log()">
        <div class="segmented" style="flex-wrap:wrap">
          @for (type of types; track type) {
            <button type="button" [class.active]="newType === type" (click)="newType = type">{{ icon(type) }} {{ 'activity.types.' + type | t }}</button>
          }
        </div>
        <textarea class="textarea" name="body" [(ngModel)]="body" [placeholder]="'activity.placeholder' | t" style="min-height:70px"></textarea>
        <div class="row end"><button class="btn primary sm" type="submit" [disabled]="!body.trim() || busy()">{{ 'activity.log' | t }}</button></div>
      </form>
      <hr />
    }
    <div class="timeline">
      @for (a of items(); track a.id) {
        <div class="timeline-item">
          <div class="timeline-icon">{{ icon(a.type) }}</div>
          <div class="spacer">
            <div class="row between">
              <strong>{{ a.title || ('activity.types.' + a.type | t) }}</strong>
              <span class="subtle nowrap" [title]="a.occurred_at | dt">{{ a.occurred_at | dt: 'relative' }}</span>
            </div>
            @if (a.body) { <p class="muted" style="white-space:pre-wrap">{{ a.body }}</p> }
            <span class="subtle">{{ a.user?.name ?? ('activity.types.system' | t) }}</span>
          </div>
        </div>
      } @empty {
        <app-empty-state illustration="activity" [compact]="true" [title]="'empty.activityTitle' | t" [text]="'empty.activityText' | t" />
      }
    </div>
  `,
})
export class TimelineComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  readonly subjectType = input.required<'client' | 'lead' | 'deal'>();
  readonly subjectId = input.required<number>();

  protected readonly types = ['call', 'email', 'meeting', 'online_meeting', 'note'];
  protected readonly items = signal<Activity[]>([]);
  protected readonly busy = signal(false);
  protected newType = 'note';
  protected body = '';

  ngOnInit(): void {
    this.reload();
  }

  icon(type: string): string {
    return ICONS[type] ?? '•';
  }

  reload(): void {
    this.api.get<Paginated<Activity>>('activities', { subject_type: this.subjectType(), subject_id: this.subjectId(), per_page: 50 }).subscribe((res) => this.items.set(res.data));
  }

  log(): void {
    this.busy.set(true);
    this.api.post('activities', { subject_type: this.subjectType(), subject_id: this.subjectId(), type: this.newType, body: this.body }).subscribe({
      next: () => {
        this.body = '';
        this.busy.set(false);
        this.reload();
      },
      error: () => this.busy.set(false),
    });
  }
}
