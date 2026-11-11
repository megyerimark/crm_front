import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Paginated } from '../core/models';
import { TranslatePipe } from '../core/i18n/t.pipe';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta(); as m) {
      <div class="pagination">
        <span class="subtle">{{ m.from ?? 0 }}–{{ m.to ?? 0 }} {{ 'common.of' | t }} {{ m.total }}</span>
        <div class="row">
          <select class="select sm" style="width:auto" [value]="m.per_page" (change)="perPage.emit(+$any($event.target).value)">
            @for (size of [10, 25, 50, 100]; track size) {
              <option [value]="size">{{ size }} {{ 'common.perPage' | t }}</option>
            }
          </select>
          <button class="btn sm icon" [disabled]="m.current_page <= 1" (click)="page.emit(m.current_page - 1)" aria-label="Previous"><app-icon name="chevronLeft" /></button>
          <span class="small">{{ m.current_page }} / {{ m.last_page }}</span>
          <button class="btn sm icon" [disabled]="m.current_page >= m.last_page" (click)="page.emit(m.current_page + 1)" aria-label="Next"><app-icon name="chevronRight" /></button>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent {
  readonly meta = input<Paginated<unknown>['meta'] | null>(null);
  readonly page = output<number>();
  readonly perPage = output<number>();
}
