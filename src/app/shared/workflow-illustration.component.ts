import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Brand illustration of how VállalkozóOS works: an enquiry card flows into a call-back task and ends as a won job.
 */
@Component({
  selector: 'app-workflow-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; }
    .float { animation: float 6s ease-in-out infinite; }
    .float.b { animation-delay: -2s; }
    .float.c { animation-delay: -4s; }
    @keyframes float { 50% { transform: translateY(-6px); } }
    @media (prefers-reduced-motion: reduce) { .float { animation: none; } }
    text { font-family: var(--font-display), sans-serif; }
  `],
  template: `
    <svg viewBox="0 0 440 300" role="img" [attr.aria-label]="labels().join(' → ')">
      <path d="M118 96 C 170 96, 170 150, 220 150 S 270 204, 322 204" fill="none" stroke="#7fe0c6" stroke-width="2.5" stroke-dasharray="6 7" opacity=".7"/>
      <g class="float">
        <rect x="18" y="52" width="170" height="88" rx="16" fill="#123b34" stroke="#2c6b5f"/>
        <circle cx="44" cy="80" r="11" fill="#f2a516"/>
        <text x="64" y="85" font-size="14" font-weight="700" fill="#ffffff">{{ labels()[0] }}</text>
        <rect x="34" y="102" width="120" height="8" rx="4" fill="#2c6b5f"/>
        <rect x="34" y="118" width="80" height="8" rx="4" fill="#24564d"/>
      </g>
      <g class="float b">
        <rect x="140" y="112" width="170" height="80" rx="16" fill="#f8faf7"/>
        <rect x="158" y="132" width="22" height="22" rx="6" fill="none" stroke="#0f6b5c" stroke-width="2.5"/>
        <path d="m163 143 4 4 8-9" fill="none" stroke="#0f6b5c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="190" y="148" font-size="14" font-weight="700" fill="#13201d">{{ labels()[1] }}</text>
        <rect x="158" y="166" width="100" height="8" rx="4" fill="#c9e7df"/>
      </g>
      <g class="float c">
        <rect x="252" y="170" width="170" height="88" rx="16" fill="#0f6b5c"/>
        <circle cx="280" cy="198" r="12" fill="#ffffff"/>
        <path d="m274 198 4 4 8-9" fill="none" stroke="#0f6b5c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="300" y="203" font-size="14" font-weight="700" fill="#ffffff">{{ labels()[2] }}</text>
        <text x="270" y="236" font-size="20" font-weight="800" fill="#f2a516">+1</text>
      </g>
    </svg>
  `,
})
export class WorkflowIllustrationComponent {
  private readonly i18n = inject(I18nService);
  protected readonly labels = computed(() => {
    this.i18n.locale();
    return [this.i18n.t('pipeline.lead'), this.i18n.t('tasks.title'), this.i18n.t('pipeline.stageTypes.won')];
  });
}
