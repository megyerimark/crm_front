import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <div class="modal" [class.wide]="wide()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <div class="modal-header">
          <h2>{{ title() }}</h2>
          <button class="btn ghost icon sm" type="button" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
        </div>
        <div class="modal-body"><ng-content /></div>
        <ng-content select="[footer]" />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly title = input('');
  readonly wide = input(false);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
