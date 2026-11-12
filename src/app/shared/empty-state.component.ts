import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

export type EmptyIllustration = 'leads' | 'clients' | 'tasks' | 'forms' | 'pipeline' | 'imports' | 'search' | 'activity';

/* Brand illustrations: soft emerald shapes, emerald strokes and one amber "new" dot. Colours come from theme tokens. */
const BASE = '<rect x="10" y="14" width="100" height="76" rx="14" fill="var(--primary-soft)"/>';
const ILLUSTRATIONS: Record<EmptyIllustration, string> = {
  leads: BASE + '<path d="M28 58h18l6 9h16l6-9h18v16a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6z" fill="var(--surface)" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round"/><path d="M34 58l8-20h36l8 20" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round"/><circle cx="88" cy="32" r="7" fill="var(--accent)"/>',
  clients: BASE + '<rect x="26" y="32" width="68" height="44" rx="9" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><circle cx="46" cy="50" r="7" fill="none" stroke="var(--primary)" stroke-width="3"/><path d="M35 68c2-6 6-9 11-9s9 3 11 9" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/><path d="M64 48h18M64 57h12" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/><circle cx="90" cy="30" r="7" fill="var(--accent)"/>',
  tasks: BASE + '<rect x="32" y="26" width="56" height="56" rx="9" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><path d="m41 44 4 4 7-8M41 62l4 4 7-8" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 45h18M60 63h14" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/><circle cx="88" cy="28" r="7" fill="var(--accent)"/>',
  forms: BASE + '<rect x="34" y="24" width="52" height="60" rx="9" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><path d="M44 40h32M44 52h32M44 64h20" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/><rect x="58" y="70" width="20" height="8" rx="4" fill="var(--primary)"/><circle cx="86" cy="26" r="7" fill="var(--accent)"/>',
  pipeline: BASE + '<rect x="24" y="30" width="20" height="50" rx="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><rect x="50" y="30" width="20" height="38" rx="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><rect x="76" y="30" width="20" height="26" rx="6" fill="var(--primary)"/><circle cx="86" cy="43" r="4" fill="var(--accent)"/>',
  imports: BASE + '<rect x="30" y="30" width="44" height="52" rx="8" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><path d="M30 46h44M30 62h44M52 30v52" stroke="var(--chart-2)" stroke-width="2.5"/><circle cx="84" cy="40" r="13" fill="var(--primary)"/><path d="M84 46V34m-5 5 5-5 5 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  search: BASE + '<circle cx="54" cy="50" r="18" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><path d="m67 63 14 14" stroke="var(--primary)" stroke-width="5" stroke-linecap="round"/><path d="M47 50h14" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/>',
  activity: BASE + '<path d="M30 70h60" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/><circle cx="38" cy="70" r="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><circle cx="60" cy="70" r="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><circle cx="82" cy="70" r="6" fill="var(--accent)"/><rect x="30" y="30" width="52" height="24" rx="7" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/><path d="M40 42h28" stroke="var(--chart-2)" stroke-width="3" stroke-linecap="round"/>',
};

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" [style.padding.px]="compact() ? 24 : null">
      <svg [attr.width]="compact() ? 84 : 120" [attr.height]="compact() ? 70 : 100" viewBox="0 0 120 100" aria-hidden="true" [innerHTML]="art()"></svg>
      <h3>{{ title() }}</h3>
      @if (text()) { <p>{{ text() }}</p> }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly illustration = input<EmptyIllustration>('search');
  readonly title = input.required<string>();
  readonly text = input<string>('');
  readonly compact = input(false);
  /* Static, trusted markup from the ILLUSTRATIONS map above. */
  protected readonly art = computed(() => this.sanitizer.bypassSecurityTrustHtml(ILLUSTRATIONS[this.illustration()]));
}
