import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService, LOCALES } from '../../core/i18n/i18n.service';
import { BillingInterval, PlanCatalogue, PlanDefinition, PlanKey } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { LogoComponent } from '../../shared/logo.component';
import { PricingTableComponent } from '../../shared/pricing-table.component';
import { UI } from '../../shared/ui';

const FEATURES: [string, string][] = [
  ['leads', 'inbox'], ['clients', 'users'], ['pipeline', 'kanban'], ['tasks', 'calendar'], ['import', 'upload'], ['reports', 'chart'],
];
const PROBLEM_ICONS = ['phone', 'mail', 'clock', 'list'];
const WHY_ICONS = ['globe', 'zap', 'grid', 'shield'];

interface CompareRow {
  label: string;
  kind: 'limit' | 'feature';
  key: string;
}

/** Comparison table rows grouped by topic (labels come from the plan.* dictionary). */
const COMPARE: { group: string; rows: CompareRow[] }[] = [
  { group: 'basics', rows: [
    { label: 'plan.limits.users', kind: 'limit', key: 'users' },
    { label: 'plan.limits.clients', kind: 'limit', key: 'clients' },
    { label: 'plan.limits.active_leads', kind: 'limit', key: 'active_leads' },
    { label: 'plan.limits.active_tasks', kind: 'limit', key: 'active_tasks' },
  ] },
  { group: 'leads', rows: [
    { label: 'plan.limits.forms', kind: 'limit', key: 'forms' },
    { label: 'plan.limits.submissions_per_month', kind: 'limit', key: 'submissions_per_month' },
    { label: 'plan.feature.custom_form_fields', kind: 'feature', key: 'custom_form_fields' },
    { label: 'plan.feature.utm_tracking', kind: 'feature', key: 'utm_tracking' },
    { label: 'plan.feature.remove_branding', kind: 'feature', key: 'remove_branding' },
  ] },
  { group: 'sales', rows: [
    { label: 'plan.limits.pipelines', kind: 'limit', key: 'pipelines' },
    { label: 'plan.limits.automations', kind: 'limit', key: 'automations' },
    { label: 'plan.feature.email_reminders', kind: 'feature', key: 'email_reminders' },
    { label: 'plan.feature.auto_assignment', kind: 'feature', key: 'auto_assignment' },
  ] },
  { group: 'data', rows: [
    { label: 'plan.limits.custom_fields', kind: 'limit', key: 'custom_fields' },
    { label: 'plan.limits.import_max_rows', kind: 'limit', key: 'import_max_rows' },
    { label: 'plan.feature.import_update_duplicates', kind: 'feature', key: 'import_update_duplicates' },
    { label: 'plan.feature.advanced_search', kind: 'feature', key: 'advanced_search' },
    { label: 'plan.feature.excel_export', kind: 'feature', key: 'excel_export' },
  ] },
  { group: 'team', rows: [
    { label: 'plan.feature.advanced_reports', kind: 'feature', key: 'advanced_reports' },
    { label: 'plan.feature.team', kind: 'feature', key: 'team' },
    { label: 'plan.feature.team_reports', kind: 'feature', key: 'team_reports' },
  ] },
];

/** Public marketing page of VállalkozóOS. Every claim here maps to a shipped feature; planned ones are marked "soon". */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, LogoComponent, PricingTableComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; background: var(--surface); }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
    header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
    header .wrap { display: flex; align-items: center; gap: 18px; height: 66px; }
    nav.links { display: flex; gap: 20px; margin-left: 12px; }
    nav.links a { color: var(--text-2); font-weight: 500; }
    nav.links a:hover { color: var(--text); text-decoration: none; }
    .hero { position: relative; overflow: hidden; color: #e6f2ee; background: radial-gradient(900px 520px at 85% 10%, #1d7a69 0, transparent 60%), radial-gradient(700px 500px at 0% 100%, #123f37 0, transparent 60%), #0b1f1b; }
    .hero::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 44px 44px; pointer-events: none; }
    .hero .wrap { position: relative; z-index: 1; display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center; padding-top: 84px; padding-bottom: 92px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(242,165,22,.14); color: var(--accent); font-weight: 600; font-size: 13px; }
    .hero h1 { font-size: 58px; line-height: 1.04; letter-spacing: -0.035em; color: #fff; margin-top: 18px; font-weight: 800; }
    .hero h1 em { font-style: normal; color: var(--accent); }
    .hero p.lead { font-size: 19px; color: #b9d0c8; margin-top: 20px; max-width: 560px; line-height: 1.55; }
    .hero .ctas { display: flex; gap: 12px; margin-top: 30px; flex-wrap: wrap; }
    .hero .btn { height: 50px; padding: 0 22px; font-size: 15.5px; border-radius: 12px; }
    .hero .btn.outline { background: transparent; color: #fff; border-color: rgba(255,255,255,.25); }
    .hero .btn.outline:hover { background: rgba(255,255,255,.06); }
    .hero .note { color: #8fb0a6; font-size: 13px; margin-top: 16px; }
    .mock { background: #f8faf7; color: #13201d; border-radius: 20px; padding: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.45); display: grid; gap: 12px; transform: rotate(-1.2deg); }
    .mock-head { display: flex; justify-content: space-between; align-items: center; }
    .mock-kpi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .mock-box { background: #fff; border: 1px solid #e2e6df; border-radius: 12px; padding: 12px 14px; }
    .mock-box .v { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: #0f6b5c; }
    .mock-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #eef1ec; font-size: 13px; }
    .mock-row:first-of-type { border-top: 0; }
    .mock-dot { width: 8px; height: 8px; border-radius: 50%; background: #f2a516; flex-shrink: 0; }
    .mock-tag { margin-left: auto; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: #e2f1ec; color: #0f6b5c; font-weight: 600; }
    .trades { border-bottom: 1px solid var(--border); background: var(--surface-2); }
    .trades .wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 18px; padding-bottom: 18px; }
    .chip { padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); font-size: 13px; font-weight: 500; color: var(--text-2); }
    section { padding: 88px 0; scroll-margin-top: 66px; }
    section.alt { background: var(--bg); }
    .section-title { max-width: 680px; margin: 0 auto 44px; text-align: center; }
    .section-title h2 { font-size: 38px; letter-spacing: -0.03em; font-weight: 800; }
    .section-title p { color: var(--text-2); margin-top: 12px; font-size: 17px; }
    .kicker { display: block; color: var(--primary); font-weight: 700; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .tile { padding: 24px; }
    .ic { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .ic.warn { background: var(--danger-soft); color: var(--danger); }
    .tile h3 { font-size: 17px; }
    .tile p { color: var(--text-2); margin-top: 8px; }
    .journey { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; position: relative; }
    .journey::before { content: ''; position: absolute; top: 22px; left: 10%; right: 10%; height: 2px; background: linear-gradient(90deg, var(--primary), var(--accent)); opacity: .5; }
    .jstep { position: relative; padding: 0 14px; text-align: center; }
    .jstep .n { width: 46px; height: 46px; margin: 0 auto 16px; border-radius: 50%; background: var(--surface); border: 2px solid var(--primary); color: var(--primary); font-weight: 800; font-family: var(--font-display); display: flex; align-items: center; justify-content: center; position: relative; }
    .jstep:last-child .n { border-color: var(--accent); color: var(--gold); }
    .jstep p { color: var(--text-2); font-size: 13.5px; margin-top: 6px; }
    .why { background: #0b1f1b; color: #d5e7e1; }
    .why .section-title h2 { color: #fff; }
    .why .tile { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; }
    .why .tile h3 { color: #fff; }
    .why .tile p { color: #a8c2ba; }
    .why .ic { background: rgba(127,224,198,.12); color: #7fe0c6; }
    .setup { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; align-items: start; }
    .setup ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .setup li { display: flex; gap: 14px; align-items: flex-start; padding: 18px; }
    .setup li .n { width: 32px; height: 32px; border-radius: 10px; background: var(--primary); color: var(--primary-text); font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .roadmap { padding: 24px; background: linear-gradient(160deg, var(--primary-soft), var(--surface)); }
    .roadmap ul { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 10px; }
    .roadmap li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
    .toggle { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 34px; }
    .compare { margin-top: 56px; }
    .compare table { width: 100%; border-collapse: collapse; }
    .compare th, .compare td { padding: 12px 16px; border-bottom: 1px solid var(--border); text-align: center; }
    .compare th:first-child, .compare td:first-child { text-align: left; }
    .compare thead th { font-family: var(--font-display); font-size: 16px; position: sticky; top: 66px; background: var(--surface); z-index: 1; }
    .compare thead th.pro { color: var(--primary); }
    .compare td.pro { background: color-mix(in srgb, var(--primary-soft) 45%, transparent); }
    .compare tr.group td { background: var(--surface-2); font-weight: 700; font-size: 12.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--text-3); text-align: left; }
    .yes { color: var(--success); font-weight: 700; }
    .no { color: var(--text-3); }
    details { border-bottom: 1px solid var(--border); padding: 18px 0; }
    summary { cursor: pointer; font-weight: 600; font-size: 16px; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
    summary::-webkit-details-marker { display: none; }
    details[open] summary app-icon { transform: rotate(180deg); }
    details p { color: var(--text-2); margin-top: 10px; }
    .cta { text-align: center; border-radius: 26px; padding: 64px 24px; color: #fff; background: radial-gradient(700px 300px at 50% 0%, #1d7a69, #0b1f1b 70%); }
    .cta h2 { font-size: 38px; color: #fff; font-weight: 800; letter-spacing: -0.03em; }
    .cta p { color: #b9d0c8; margin: 12px 0 28px; font-size: 17px; }
    footer { border-top: 1px solid var(--border); padding: 32px 0; color: var(--text-3); font-size: 13px; }
    @media (max-width: 1020px) {
      nav.links { display: none; }
      .hero .wrap { grid-template-columns: 1fr; padding-top: 56px; padding-bottom: 64px; gap: 40px; }
      .hero h1 { font-size: 42px; }
      .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .journey { grid-template-columns: 1fr; gap: 18px; }
      .journey::before { display: none; }
      .jstep { display: grid; grid-template-columns: 46px 1fr; gap: 14px; text-align: left; }
      .jstep .n { margin: 0; }
      .setup { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      section { padding: 60px 0; }
      .section-title h2, .cta h2 { font-size: 28px; }
      .hero h1 { font-size: 34px; }
      .grid4, .grid3, .grid2 { grid-template-columns: minmax(0, 1fr); }
      header .hide-sm { display: none; }
      .mock { transform: none; }
      .compare th, .compare td { padding: 10px 8px; font-size: 13px; }
    }
  `],
  template: `
    <header>
      <div class="wrap">
        <a routerLink="/welcome" aria-label="VállalkozóOS"><app-logo [size]="30" /></a>
        <nav class="links">
          <a routerLink="/welcome" fragment="problem">{{ 'landing.nav.problem' | t }}</a>
          <a routerLink="/welcome" fragment="features">{{ 'landing.nav.features' | t }}</a>
          <a routerLink="/welcome" fragment="pricing">{{ 'landing.nav.pricing' | t }}</a>
          <a routerLink="/welcome" fragment="compare">{{ 'landing.nav.compare' | t }}</a>
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
          <a class="btn accent" [routerLink]="['/register']" [queryParams]="{ plan: 'pro', interval: interval() }">{{ 'landing.nav.start' | t }}</a>
        }
      </div>
    </header>

    <div class="hero">
      <div class="wrap">
        <div>
          <span class="eyebrow"><app-icon name="zap" [size]="14" /> {{ 'landing.eyebrow' | t }}</span>
          <h1>{{ heroLead() }}<em>{{ 'landing.heroAccent' | t }}</em></h1>
          <p class="lead">{{ 'landing.heroText' | t }}</p>
          <div class="ctas">
            <a class="btn accent" [routerLink]="['/register']" [queryParams]="{ plan: 'pro', interval: interval() }">{{ 'landing.heroCta' | t }} <app-icon name="arrowRight" [size]="17" /></a>
            <a class="btn outline" routerLink="/welcome" fragment="pricing">{{ 'landing.heroSecondary' | t }}</a>
          </div>
          <p class="note">{{ 'landing.heroNote' | t }}</p>
        </div>
        <div class="mock" aria-hidden="true">
          <div class="mock-head"><app-logo [size]="22" /><span class="small" style="color:#7c8783">{{ today() }}</span></div>
          <div class="mock-kpi">
            <div class="mock-box"><div class="small" style="color:#475450">{{ 'landing.mock.today' | t }}</div><div class="v">4</div></div>
            <div class="mock-box"><div class="small" style="color:#475450">{{ 'landing.mock.won' | t }}</div><div class="v">1 840 000 Ft</div></div>
          </div>
          <div class="mock-box">
            <strong class="small">{{ 'landing.mock.inbox' | t }}</strong>
            @for (row of mockRows; track row[0]) {
              <div class="mock-row"><span class="mock-dot"></span><div><b>{{ row[0] }}</b><div style="color:#7c8783;font-size:12px">{{ row[1] }}</div></div><span class="mock-tag">{{ row[2] }}</span></div>
            }
          </div>
        </div>
      </div>
    </div>

    <div class="trades">
      <div class="wrap">
        <strong class="small">{{ 'landing.audience' | t }}:</strong>
        @for (trade of trades(); track trade) { <span class="chip">{{ trade }}</span> }
      </div>
    </div>

    <section id="problem">
      <div class="wrap">
        <div class="section-title"><span class="kicker">{{ 'landing.nav.problem' | t }}</span><h2>{{ 'landing.problemTitle' | t }}</h2><p>{{ 'landing.problemText' | t }}</p></div>
        <div class="grid4">
          @for (p of problems(); track $index) {
            <div class="card tile"><div class="ic warn"><app-icon [name]="problemIcons[$index]" /></div><h3>{{ p[0] }}</h3><p>{{ p[1] }}</p></div>
          }
        </div>
      </div>
    </section>

    <section class="alt">
      <div class="wrap">
        <div class="section-title"><h2>{{ 'landing.solutionTitle' | t }}</h2><p>{{ 'landing.solutionText' | t }}</p></div>
        <div class="journey">
          @for (step of journey(); track $index) {
            <div class="jstep"><div class="n">{{ $index + 1 }}</div><div><h3>{{ step[0] }}</h3><p>{{ step[1] }}</p></div></div>
          }
        </div>
      </div>
    </section>

    <section id="features">
      <div class="wrap">
        <div class="section-title"><span class="kicker">{{ 'landing.nav.features' | t }}</span><h2>{{ 'landing.tagline' | t }}</h2></div>
        <div class="grid3">
          @for (f of features; track f[0]) {
            <div class="card tile"><div class="ic"><app-icon [name]="f[1]" /></div><h3>{{ feature(f[0])[0] }}</h3><p>{{ feature(f[0])[1] }}</p></div>
          }
        </div>
      </div>
    </section>

    <section class="why">
      <div class="wrap">
        <div class="section-title"><h2>{{ 'landing.whyTitle' | t }}</h2></div>
        <div class="grid4">
          @for (w of why(); track $index) {
            <div class="tile"><div class="ic"><app-icon [name]="whyIcons[$index]" /></div><h3>{{ w[0] }}</h3><p>{{ w[1] }}</p></div>
          }
        </div>
      </div>
    </section>

    <section id="how" class="alt">
      <div class="wrap">
        <div class="section-title"><span class="kicker">{{ 'landing.nav.how' | t }}</span><h2>{{ 'landing.howTitle' | t }}</h2></div>
        <div class="setup">
          <ol>
            @for (step of steps(); track $index) { <li class="card"><span class="n">{{ $index + 1 }}</span><span>{{ step }}</span></li> }
          </ol>
          <div class="card roadmap">
            <h3>{{ 'landing.roadmapTitle' | t }}</h3>
            <p class="muted mt-sm">{{ 'landing.roadmapText' | t }}</p>
            <ul>@for (item of roadmap(); track item) { <li>{{ item }} <span class="badge primary">{{ 'landing.soon' | t }}</span></li> }</ul>
          </div>
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="wrap">
        <div class="section-title"><span class="kicker">{{ 'landing.nav.pricing' | t }}</span><h2>{{ 'landing.pricingTitle' | t }}</h2><p>{{ 'landing.pricingText' | t }}</p></div>
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

          <div class="compare card" id="compare">
            <div class="card-header"><h2>{{ 'landing.compareTitle' | t }}</h2></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th></th>@for (plan of c.data; track plan.key) { <th [class.pro]="plan.key === 'pro'">{{ plan.name }}</th> }</tr></thead>
                <tbody>
                  <tr><td>{{ 'billing.title' | t }}</td>@for (plan of c.data; track plan.key) { <td [class.pro]="plan.key === 'pro'"><strong>{{ priceLabel(plan) }}</strong></td> }</tr>
                  @for (group of compare; track group.group) {
                    <tr class="group"><td [attr.colspan]="c.data.length + 1">{{ 'landing.compareGroups.' + group.group | t }}</td></tr>
                    @for (row of group.rows; track row.key) {
                      <tr>
                        <td>{{ row.label | t }}</td>
                        @for (plan of c.data; track plan.key) {
                          <td [class.pro]="plan.key === 'pro'">
                            @if (row.kind === 'feature') {
                              @if (plan.features[row.key]) { <span class="yes" aria-label="✓"><app-icon name="check" [size]="18" /></span> } @else { <span class="no">–</span> }
                            } @else {
                              <span [class.no]="plan.limits[row.key] === 0">{{ limitLabel(plan.limits[row.key]) }}</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </section>

    <section id="faq" class="alt">
      <div class="wrap" style="max-width:820px">
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
          <a class="btn accent" style="height:52px;padding:0 26px;font-size:16px;border-radius:12px" [routerLink]="['/register']" [queryParams]="{ plan: 'pro', interval: interval() }">{{ 'landing.heroCta' | t }}</a>
        </div>
      </div>
    </section>

    <footer>
      <div class="wrap row between wrap">
        <div class="row"><app-logo [size]="22" /><span>© {{ year }} · {{ 'landing.footer' | t }}</span></div>
        <div class="row"><a routerLink="/welcome" fragment="pricing">{{ 'landing.nav.pricing' | t }}</a><a routerLink="/login">{{ 'landing.nav.login' | t }}</a></div>
      </div>
    </footer>
  `,
})
export class LandingPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly locales = LOCALES;
  protected readonly features = FEATURES;
  protected readonly problemIcons = PROBLEM_ICONS;
  protected readonly whyIcons = WHY_ICONS;
  protected readonly compare = COMPARE;
  protected readonly year = new Date().getFullYear();
  protected readonly interval = signal<BillingInterval>('yearly');
  protected readonly catalogue = signal<PlanCatalogue | null>(null);
  protected readonly mockRows = [
    ['Kovács Anna', 'Klímaszerelés · 2 szoba', 'facebook'],
    ['Tóth Gábor', 'Karbantartás', 'weboldal'],
    ['Szabó Éva', 'Ajánlatkérés', 'link'],
  ];

  protected readonly heroLead = computed(() => this.i18n.t('landing.heroTitle').replace(this.i18n.t('landing.heroAccent'), ''));
  protected readonly trades = computed(() => this.i18n.raw<string[]>('landing.trades'));
  protected readonly problems = computed(() => this.i18n.raw<string[][]>('landing.problems'));
  protected readonly journey = computed(() => this.i18n.raw<string[][]>('landing.journey'));
  protected readonly why = computed(() => this.i18n.raw<string[][]>('landing.why'));
  protected readonly steps = computed(() => this.i18n.raw<string[]>('landing.how'));
  protected readonly roadmap = computed(() => this.i18n.raw<string[]>('landing.roadmap'));
  protected readonly faq = computed(() => this.i18n.raw<string[][]>('landing.faq'));
  protected readonly today = computed(() => new Intl.DateTimeFormat(this.i18n.intlLocale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()));

  protected readonly labelFor = (plan: PlanKey): string => this.i18n.t(plan === 'free' ? 'landing.startFree' : 'landing.choose');

  ngOnInit(): void {
    this.api.get<PlanCatalogue>('plans').subscribe((res) => this.catalogue.set(res));
  }

  feature(key: string): string[] {
    return this.i18n.raw<string[]>(`landing.features.${key}`);
  }

  limitLabel(value: number | null | undefined): string {
    if (value === null || value === undefined) return this.i18n.t('common.unlimited') + '*';
    if (value === 0) return '–';
    return this.i18n.number(value);
  }

  priceLabel(plan: PlanDefinition): string {
    const amount = plan.prices[this.interval()];
    const suffix = this.i18n.t(this.interval() === 'yearly' && amount ? 'landing.perYear' : 'plan.perMonth');
    return this.i18n.money(amount, plan.currency) + suffix;
  }

  choose(plan: PlanKey): void {
    const target = this.auth.isLoggedIn() ? ['/settings/subscription'] : ['/register'];
    void this.router.navigate(target, { queryParams: { plan, interval: this.interval() } });
  }
}
