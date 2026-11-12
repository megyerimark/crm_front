import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { BillingInterval, PlanCatalogue, PlanKey } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { PricingTableComponent } from '../../shared/pricing-table.component';
import { UI } from '../../shared/ui';

const FEATURES: [string, string][] = [
  ['leads', 'inbox'], ['clients', 'users'], ['pipeline', 'kanban'], ['tasks', 'calendar'], ['import', 'upload'], ['reports', 'chart'],
];

/** Public marketing page: product story, pricing with monthly/yearly toggle and FAQ. */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, PricingTableComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; background: var(--surface); }
    .wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }
    header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
    header .wrap { display: flex; align-items: center; gap: 20px; height: 64px; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; color: var(--text); text-decoration: none !important; }
    .logo-mark { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #3c5cff, #2236b8); color: #fff; display: flex; align-items: center; justify-content: center; }
    nav.links { display: flex; gap: 18px; }
    nav.links a { color: var(--text-2); font-weight: 500; }
    .hero { padding: 72px 0 56px; background: radial-gradient(1200px 500px at 70% -10%, var(--primary-soft), transparent 70%); }
    .hero .wrap { display: grid; grid-template-columns: 1.05fr 1fr; gap: 48px; align-items: center; }
    .hero h1 { font-size: 48px; line-height: 1.08; letter-spacing: -0.03em; }
    .hero p.lead { font-size: 18px; color: var(--text-2); margin-top: 18px; max-width: 540px; }
    .hero .ctas { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
    .hero .btn { height: 46px; padding: 0 20px; font-size: 15px; }
    .mock { border-radius: 16px; border: 1px solid var(--border); background: var(--bg); box-shadow: var(--shadow-lg); overflow: hidden; }
    .mock-top { height: 34px; display: flex; gap: 6px; align-items: center; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .mock-top i { width: 10px; height: 10px; border-radius: 50%; background: var(--border-strong); }
    .mock-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px; }
    .mock-col { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 220px; }
    .mock-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; }
    .mock-card b { display: block; color: var(--text); }
    section { padding: 72px 0; scroll-margin-top: 64px; }
    section.alt { background: var(--bg); }
    .section-title { text-align: center; max-width: 640px; margin: 0 auto 40px; }
    .section-title h2 { font-size: 32px; letter-spacing: -0.02em; }
    .section-title p { color: var(--text-2); margin-top: 10px; font-size: 16px; }
    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .feature { padding: 24px; }
    .feature .ic { width: 42px; height: 42px; border-radius: 12px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
    .steps4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; counter-reset: s; }
    .step4 { padding: 22px; position: relative; }
    .step4 .n { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: var(--primary-text); font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .toggle { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 30px; }
    details { border-bottom: 1px solid var(--border); padding: 16px 0; }
    summary { cursor: pointer; font-weight: 600; font-size: 15.5px; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
    summary::-webkit-details-marker { display: none; }
    details[open] summary app-icon { transform: rotate(180deg); }
    details p { color: var(--text-2); margin-top: 10px; }
    .cta { text-align: center; border-radius: 22px; padding: 56px 24px; color: #fff; background: radial-gradient(circle at 20% 0%, #3c5cff, #16206a 60%, #0b1030); }
    .cta h2 { font-size: 34px; color: #fff; }
    .cta p { color: #c9d1ff; margin: 10px 0 24px; }
    footer { border-top: 1px solid var(--border); padding: 28px 0; color: var(--text-3); font-size: 13px; }
    @media (max-width: 960px) {
      nav.links { display: none; }
      .hero .wrap { grid-template-columns: 1fr; }
      .hero h1 { font-size: 36px; }
      .features { grid-template-columns: 1fr 1fr; }
      .steps4 { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) { .features, .steps4 { grid-template-columns: 1fr; } .mock-body { grid-template-columns: 1fr 1fr; } .mock-col:nth-child(3) { display: none; } header .hide-sm { display: none; } }
  `],
  template: `
    <header>
      <div class="wrap">
        <a class="logo" routerLink="/welcome"><span class="logo-mark"><app-icon name="zap" [size]="17" /></span>{{ appName }}</a>
        <nav class="links">
          <a routerLink="/welcome" fragment="features">{{ 'landing.nav.features' | t }}</a>
          <a routerLink="/welcome" fragment="how">{{ 'landing.nav.how' | t }}</a>
          <a routerLink="/welcome" fragment="pricing">{{ 'landing.nav.pricing' | t }}</a>
          <a routerLink="/welcome" fragment="faq">{{ 'landing.nav.faq' | t }}</a>
        </nav>
        <span class="spacer"></span>
        <select class="select sm hide-sm" style="width:auto" [value]="i18n.locale()" (change)="i18n.use($any($event.target).value)" [attr.aria-label]="'common.language' | t">
          @for (l of locales; track l.code) { <option [value]="l.code">{{ l.code.toUpperCase() }}</option> }
        </select>
        <button class="btn ghost icon" (click)="theme.toggle()" [attr.aria-label]="'common.theme' | t"><app-icon [name]="theme.isDark() ? 'sun' : 'moon'" /></button>
        @if (auth.isLoggedIn()) {
          <a class="btn primary" routerLink="/">{{ 'nav.dashboard' | t }}</a>
        } @else {
          <a class="btn ghost hide-sm" routerLink="/login">{{ 'landing.nav.login' | t }}</a>
          <a class="btn primary" routerLink="/register">{{ 'landing.nav.start' | t }}</a>
        }
      </div>
    </header>

    <div class="hero">
      <div class="wrap">
        <div>
          <span class="badge gold">★ {{ 'auth.trial' | t }}</span>
          <h1 class="mt">{{ 'landing.heroTitle' | t }}</h1>
          <p class="lead">{{ 'landing.heroText' | t }}</p>
          <div class="ctas">
            <a class="btn primary" [routerLink]="['/register']" [queryParams]="{ plan: 'pro', interval: interval() }">{{ 'landing.heroCta' | t }} <app-icon name="arrowRight" [size]="16" /></a>
            <a class="btn" routerLink="/welcome" fragment="pricing">{{ 'landing.heroSecondary' | t }}</a>
          </div>
          <p class="subtle mt">{{ 'landing.heroNote' | t }}</p>
        </div>
        <div class="mock" aria-hidden="true">
          <div class="mock-top"><i></i><i></i><i></i></div>
          <div class="mock-body">
            @for (col of mockColumns(); track col.title) {
              <div class="mock-col">
                <strong class="small">{{ col.title }}</strong>
                @for (card of col.cards; track card[0]) { <div class="mock-card"><b>{{ card[0] }}</b><span class="subtle">{{ card[1] }}</span></div> }
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <section id="features">
      <div class="wrap">
        <div class="section-title"><h2>{{ 'nav.dashboard' | t }} · {{ 'nav.leads' | t }} · {{ 'nav.clients' | t }}</h2><p>{{ 'landing.audience' | t }}</p></div>
        <div class="features">
          @for (f of features; track f[0]) {
            <div class="card feature">
              <div class="ic"><app-icon [name]="f[1]" /></div>
              <h3>{{ feature(f[0])[0] }}</h3>
              <p class="muted mt-sm">{{ feature(f[0])[1] }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section id="how" class="alt">
      <div class="wrap">
        <div class="section-title"><h2>{{ 'landing.howTitle' | t }}</h2></div>
        <div class="steps4">
          @for (step of steps(); track $index) {
            <div class="card step4"><div class="n">{{ $index + 1 }}</div><p>{{ step }}</p></div>
          }
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="wrap">
        <div class="section-title"><h2>{{ 'landing.pricingTitle' | t }}</h2><p>{{ 'landing.pricingText' | t }}</p></div>
        <div class="toggle">
          <div class="segmented">
            <button [class.active]="interval() === 'monthly'" (click)="interval.set('monthly')">{{ 'landing.monthly' | t }}</button>
            <button [class.active]="interval() === 'yearly'" (click)="interval.set('yearly')">{{ 'landing.yearly' | t }}</button>
          </div>
          <span class="badge success">{{ 'landing.yearlySave' | t }}</span>
        </div>
        @if (catalogue(); as c) {
          <app-pricing-table [plans]="c.data" [interval]="interval()" [labelFor]="labelFor" (choose)="choose($event)" />
          <p class="center subtle mt">{{ (c.prices_include_vat ? 'landing.vatIncluded' : 'landing.vatExcluded') | t }} {{ 'landing.trialFirst' | t }} * Fair use.</p>
        }
      </div>
    </section>

    <section id="faq" class="alt">
      <div class="wrap" style="max-width:800px">
        <div class="section-title"><h2>{{ 'landing.faqTitle' | t }}</h2></div>
        @for (item of faq(); track $index) {
          <details><summary>{{ item[0] }} <app-icon name="chevronDown" /></summary><p>{{ item[1] }}</p></details>
        }
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="cta">
          <h2>{{ 'landing.ctaTitle' | t }}</h2>
          <p>{{ 'landing.ctaText' | t }}</p>
          <a class="btn gold" style="height:46px;padding:0 22px" [routerLink]="['/register']" [queryParams]="{ plan: 'pro', interval: interval() }">{{ 'landing.heroCta' | t }}</a>
        </div>
      </div>
    </section>

    <footer><div class="wrap row between wrap"><span>© {{ year }} VállalkozóOS · {{ appName }}. {{ 'landing.footer' | t }}</span><a routerLink="/login">{{ 'landing.nav.login' | t }}</a></div></footer>
  `,
})
export class LandingPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly appName = environment.appName;
  protected readonly locales = LOCALES;
  protected readonly features = FEATURES;
  protected readonly year = new Date().getFullYear();
  protected readonly interval = signal<BillingInterval>('yearly');
  protected readonly catalogue = signal<PlanCatalogue | null>(null);

  protected readonly steps = computed(() => this.i18n.raw<string[]>('landing.how'));
  protected readonly faq = computed(() => this.i18n.raw<string[][]>('landing.faq'));
  protected readonly mockColumns = computed(() => {
    this.i18n.locale();
    return [
      { title: this.i18n.t('leads.status.new'), cards: [['Kovács Anna', 'facebook · ma'], ['Tóth Gábor', 'google · tegnap'], ['Szabó Éva', 'link']] },
      { title: this.i18n.t('pipeline.stageTypes.open'), cards: [['Klímaszerelés', '450 000 Ft'], ['Karbantartás', '35 000 Ft']] },
      { title: this.i18n.t('pipeline.stageTypes.won'), cards: [['Irodaklíma', '1 250 000 Ft']] },
    ];
  });

  protected readonly labelFor = (plan: PlanKey): string => this.i18n.t(plan === 'free' ? 'landing.startFree' : 'landing.choose');

  ngOnInit(): void {
    this.api.get<PlanCatalogue>('plans').subscribe((res) => this.catalogue.set(res));
  }

  feature(key: string): string[] {
    return this.i18n.raw<string[]>(`landing.features.${key}`);
  }

  choose(plan: PlanKey): void {
    if (this.auth.isLoggedIn()) {
      void this.router.navigate(['/settings/subscription'], { queryParams: { plan, interval: this.interval() } });
    } else {
      void this.router.navigate(['/register'], { queryParams: { plan, interval: this.interval() } });
    }
  }
}
