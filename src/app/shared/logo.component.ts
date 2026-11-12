import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * VállalkozóOS logo: a "V" check mark (a job done) with an amber dot (a new enquiry) and the wordmark.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
    .word { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: var(--text); }
    :host(.inverse) .word { color: #fff; }
    .os { display: inline-block; margin-left: 2px; padding: 2px 5px 1px; border-radius: 6px; background: var(--accent); color: #1d1606; font-size: .72em; vertical-align: 2px; letter-spacing: 0; }
  `],
  host: { '[class.inverse]': 'inverse()' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" [attr.fill]="inverse() ? '#1a8a76' : '#0f6b5c'" />
      <path d="M8.5 9.5 16 23l7.5-13.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="23.5" cy="9.5" r="2.6" fill="#f2a516" />
    </svg>
    @if (wordmark()) {
      <span class="word" [style.font-size.px]="size() * 0.56">Vállalkozó<span class="os">OS</span></span>
    }
  `,
})
export class LogoComponent {
  readonly size = input(32);
  readonly inverse = input(false);
  readonly wordmark = input(true);
}
