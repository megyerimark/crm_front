import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../core/toast.service';
import { TranslatePipe } from '../core/i18n/t.pipe';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toasts',
  imports: [IconComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind">
          <div class="spacer">
            {{ toast.message }}
            @if (toast.kind === 'upgrade') {
              <div class="mt-sm"><a routerLink="/settings/subscription" (click)="toasts.dismiss(toast.id)">{{ 'common.upgrade' | t }} →</a></div>
            }
          </div>
          <button class="btn ghost sm icon" (click)="toasts.dismiss(toast.id)" aria-label="Close"><app-icon name="x" [size]="14" /></button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
