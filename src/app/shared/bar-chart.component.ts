import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

export interface BarPoint {
  month: string;
  clients: number;
  leads: number;
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend mb"><span><i></i>{{ labels()[0] }}</span><span><i class="alt"></i>{{ labels()[1] }}</span></div>
    <div class="bars" role="img" [attr.aria-label]="labels().join(', ')">
      @for (point of data(); track point.month) {
        <div class="bar-group">
          <div class="bar-pair">
            <div class="bar" [style.height.%]="(point.clients / max()) * 100" [title]="labels()[0] + ': ' + point.clients"></div>
            <div class="bar alt" [style.height.%]="(point.leads / max()) * 100" [title]="labels()[1] + ': ' + point.leads"></div>
          </div>
          <span class="label">{{ monthLabel(point.month) }}</span>
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  private readonly i18n = inject(I18nService);
  readonly data = input<BarPoint[]>([]);
  readonly labels = input<[string, string]>(['', '']);
  protected readonly max = computed(() => Math.max(1, ...this.data().flatMap((p) => [p.clients, p.leads])));

  monthLabel(month: string): string {
    return new Intl.DateTimeFormat(this.i18n.intlLocale(), { month: 'short' }).format(new Date(`${month}-01T12:00:00`));
  }
}
