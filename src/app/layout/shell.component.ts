import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService, LOCALES } from '../core/i18n/i18n.service';
import { AppNotification, Locale } from '../core/models';
import { ThemeService } from '../core/theme.service';
import { LogoComponent } from '../shared/logo.component';
import { UI } from '../shared/ui';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  exact?: boolean;
  admin?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    .sidebar { background: var(--sidebar); color: var(--sidebar-text); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; padding: 18px 12px; gap: 18px; z-index: 30; }
    .brand { display: flex; align-items: center; padding: 2px 8px; text-decoration: none !important; }
    .sidebar nav { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
    .sidebar nav a { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; color: var(--sidebar-text); font-weight: 500; text-decoration: none; }
    .sidebar nav a:hover { background: rgba(255,255,255,.05); color: #fff; }
    .sidebar nav a.active { background: var(--sidebar-active); color: #fff; }
    .sidebar nav a.active app-icon { color: var(--nav-active-icon); }
    .nav-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: #5e6890; padding: 12px 12px 4px; }
    .ws { position: relative; }
    .ws-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); color: #fff; cursor: pointer; font: inherit; text-align: left; }
    .ws-btn .avatar { border-radius: 8px; background: #1d4a42; color: #bfe9de; }
    .ws-btn small { color: var(--sidebar-text); display: block; font-size: 11.5px; }
    .side-foot { margin-top: auto; }
    .topbar { height: 60px; display: flex; align-items: center; gap: 8px; padding: 0 24px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 20; }
    main { min-width: 0; }
    .menu-wrap { position: relative; }
    .menu.right { right: 0; top: calc(100% + 6px); }
    .menu.up { left: 0; right: 0; bottom: calc(100% + 6px); }
    .notif { width: 340px; max-height: 420px; overflow-y: auto; }
    .count { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
    .mobile-toggle { display: none; }
    .tabbar { display: none; }
    .scrim { display: none; }
    @media (max-width: 960px) { .scrim { display: block; position: fixed; inset: 0; z-index: 29; background: rgba(6, 18, 15, .45); } }
    @media (max-width: 960px) {
      :host { grid-template-columns: 1fr; }
      .sidebar { position: fixed; left: 0; top: 0; width: 260px; transform: translateX(-100%); transition: transform .2s; box-shadow: var(--shadow-lg); }
      .sidebar.open { transform: none; }
      .mobile-toggle { display: inline-flex; }
      .topbar { padding: 0 16px; }
    }
    @media (max-width: 720px) {
      .mobile-toggle { display: none; }
      main { padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
      .tabbar { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; transform: translateZ(0); height: calc(64px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); background: var(--surface); border-top: 1px solid var(--border); box-shadow: 0 -6px 20px rgba(0,0,0,.06); }
      .tabbar a, .tabbar button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font: inherit; font-size: 10.5px; font-weight: 600; color: var(--text-3); background: none; border: 0; text-decoration: none !important; min-width: 0; padding: 0 2px; }
      .tabbar span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tabbar a.active { color: var(--primary); }
      .tabbar a.active app-icon { transform: translateY(-1px); }
    }
  `],
  template: `
    <aside class="sidebar" [class.open]="mobileOpen()">
      <a class="brand" routerLink="/"><app-logo [size]="30" [inverse]="true" /></a>

      <div class="ws">
        <button class="ws-btn" type="button" (click)="toggle('ws')">
          <span class="avatar">{{ auth.workspace()?.name | initials }}</span>
          <span class="spacer truncate">
            <span class="truncate" style="display:block">{{ auth.workspace()?.name ?? ('nav.workspace' | t) }}</span>
            @if (auth.role()) {
              <small>{{ 'roles.' + auth.role() | t }} · {{ planLabel() }}</small>
            }
          </span>
          <app-icon name="chevronDown" [size]="16" />
        </button>
        @if (open() === 'ws') {
          <div class="menu" style="left:0;right:0;top:calc(100% + 6px)">
            <div class="menu-label">{{ 'nav.workspace' | t }}</div>
            @for (ws of auth.workspaces(); track ws.id) {
              <button type="button" (click)="switchTo(ws.id)">
                <span class="avatar" style="width:24px;height:24px;font-size:10px">{{ ws.name | initials }}</span>
                <span class="spacer truncate">{{ ws.name }}</span>
                @if (ws.id === auth.workspaceId()) { <app-icon name="check" [size]="15" /> }
              </button>
            }
            <div class="sep"></div>
            <a routerLink="/onboarding" (click)="close()"><app-icon name="plus" [size]="15" /> {{ 'nav.newWorkspace' | t }}</a>
          </div>
        }
      </div>

      <nav>
        @for (item of nav; track item.path) {
          @if (auth.workspace() && (!item.admin || auth.isAdmin())) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }"><app-icon [name]="item.icon" /> {{ item.label | t }}</a>
          }
        }
        @if (auth.user()?.is_super_admin) {
          <div class="nav-label">Admin</div>
          <a routerLink="/admin" routerLinkActive="active"><app-icon name="shield" /> {{ 'nav.admin' | t }}</a>
        }
      </nav>

      <div class="side-foot menu-wrap">
        <button class="ws-btn" type="button" (click)="toggle('user')">
          <span class="avatar" style="border-radius:50%">{{ auth.user()?.name | initials }}</span>
          <span class="spacer truncate">
            <span class="truncate" style="display:block">{{ auth.user()?.name }}</span>
            <small class="truncate">{{ auth.user()?.email }}</small>
          </span>
        </button>
        @if (open() === 'user') {
          <div class="menu up">
            <a routerLink="/settings/profile" (click)="close()"><app-icon name="team" [size]="15" /> {{ 'common.profile' | t }}</a>
            <a routerLink="/settings/subscription" (click)="close()"><app-icon name="star" [size]="15" /> {{ 'settings.subscription' | t }}</a>
            <div class="sep"></div>
            <button type="button" (click)="auth.logout()"><app-icon name="logout" [size]="15" /> {{ 'common.logout' | t }}</button>
          </div>
        }
      </div>
    </aside>

    @if (mobileOpen()) { <div class="scrim" (click)="mobileOpen.set(false)"></div> }
    <main>
      <header class="topbar">
        <button class="btn ghost icon mobile-toggle" type="button" (click)="mobileOpen.set(!mobileOpen())" aria-label="Menu"><app-icon name="menu" /></button>
        @if (trialDays() !== null) {
          <a class="badge gold" routerLink="/settings/subscription">
            <app-icon name="star" [size]="12" />
            {{ trialDays() === 0 ? ('plan.trialEndsToday' | t) : ('plan.trialEnds' | t: { days: trialDays() }) }}
          </a>
        }
        @if (auth.workspace() && !auth.canWrite()) {
          <span class="badge"><app-icon name="eye" [size]="12" /> {{ 'common.readOnly' | t }}</span>
        }
        <div class="spacer"></div>

        <div class="menu-wrap">
          <button class="btn ghost icon" type="button" (click)="toggle('lang')" [attr.aria-label]="'common.language' | t"><app-icon name="globe" /></button>
          @if (open() === 'lang') {
            <div class="menu right">
              @for (l of locales; track l.code) {
                <button type="button" (click)="setLocale(l.code)">{{ l.label }} @if (i18n.locale() === l.code) { <app-icon name="check" [size]="15" /> }</button>
              }
            </div>
          }
        </div>
        <button class="btn ghost icon" type="button" (click)="toggleTheme()" [attr.aria-label]="'common.theme' | t">
          <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" />
        </button>
        <div class="menu-wrap">
          <button class="btn ghost icon" type="button" (click)="openNotifications()" [attr.aria-label]="'nav.notifications' | t">
            <app-icon name="bell" />
            @if (unread() > 0) { <span class="count">{{ unread() }}</span> }
          </button>
          @if (open() === 'notif') {
            <div class="menu right notif">
              <div class="row between" style="padding:6px 10px">
                <strong>{{ 'nav.notifications' | t }}</strong>
                @if (unread() > 0) { <button class="btn ghost sm" style="width:auto" (click)="markRead()">{{ 'nav.markRead' | t }}</button> }
              </div>
              @for (n of notifications(); track n.id) {
                @if (n.data.quote_id) {
                  <a [routerLink]="['/quotes', n.data.quote_id]" (click)="close()">
                    <span class="dot" [style.background]="n.read_at ? 'transparent' : 'var(--accent, #f59e0b)'"></span>
                    <span class="spacer">
                      <strong>{{ n.data.type === 'quote_follow_up' ? ('quotes.notifications.follow_up' | t) + ': ' + n.data.name : n.data.name + ' ' + ('quotes.notifications.' + n.data.type.replace('quote_', '') | t) }}</strong>
                      <span class="subtle" style="display:block">{{ n.data.number }} · {{ n.data.title }} · {{ n.created_at | dt: 'relative' }}</span>
                    </span>
                  </a>
                } @else {
                  <a [routerLink]="n.data.lead_id ? ['/leads', n.data.lead_id] : ['/leads']" (click)="close()">
                    <span class="dot" [style.background]="n.read_at ? 'transparent' : 'var(--primary)'"></span>
                    <span class="spacer">
                      <strong>{{ n.data.name }}</strong>
                      <span class="subtle" style="display:block">{{ n.data.form }} · {{ n.created_at | dt: 'relative' }}</span>
                    </span>
                  </a>
                }
              } @empty {
                <div class="empty small">{{ 'nav.noNotifications' | t }}</div>
              }
            </div>
          }
        </div>
      </header>
      <router-outlet />
    </main>

    <nav class="tabbar" [attr.aria-label]="'nav.dashboard' | t">
      @for (item of tabs; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }"><app-icon [name]="item.icon" [size]="21" /><span>{{ item.label | t }}</span></a>
      }
      <button type="button" (click)="mobileOpen.set(!mobileOpen())"><app-icon name="menu" [size]="21" /><span>{{ 'nav.menu' | t }}</span></button>
    </nav>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly appName = environment.appName;
  protected readonly locales = LOCALES;
  protected readonly open = signal<string | null>(null);
  protected readonly mobileOpen = signal(false);
  protected readonly notifications = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);

  protected readonly nav: NavItem[] = [
    { path: '/', icon: 'dashboard', label: 'nav.dashboard', exact: true },
    { path: '/leads', icon: 'inbox', label: 'nav.leads' },
    { path: '/clients', icon: 'users', label: 'nav.clients' },
    { path: '/pipeline', icon: 'kanban', label: 'nav.pipeline' },
    { path: '/quotes', icon: 'quote', label: 'nav.quotes' },
    { path: '/tasks', icon: 'checkSquare', label: 'nav.tasks' },
    { path: '/forms', icon: 'form', label: 'nav.forms' },
    { path: '/imports', icon: 'upload', label: 'nav.imports' },
    { path: '/reports', icon: 'chart', label: 'nav.reports' },
    { path: '/team', icon: 'team', label: 'nav.team' },
    { path: '/settings', icon: 'settings', label: 'nav.settings' },
    { path: '/support', icon: 'message', label: 'nav.support' },
  ];

  /** Bottom tab bar on phones: the four most used screens. */
  protected readonly tabs: NavItem[] = [
    { path: '/', icon: 'dashboard', label: 'nav.dashboard', exact: true },
    { path: '/leads', icon: 'inbox', label: 'nav.leads' },
    { path: '/tasks', icon: 'checkSquare', label: 'nav.tasks' },
    { path: '/clients', icon: 'users', label: 'nav.clients' },
  ];

  protected readonly planLabel = computed(() => {
    const ws = this.auth.workspace();
    if (!ws) {
      return '';
    }
    return ws.on_trial && ws.plan === 'free' ? this.i18n.t('plan.trial') : this.i18n.t('plan.' + ws.effective_plan);
  });

  protected readonly trialDays = computed(() => {
    const ws = this.auth.workspace();
    if (!ws?.on_trial || !ws.trial_ends_at || ws.subscription_status === 'active') {
      return null;
    }
    return Math.max(0, Math.ceil((new Date(ws.trial_ends_at).getTime() - Date.now()) / 86400000) - 1);
  });

  constructor() {
    this.loadNotifications();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.mobileOpen.set(false);
      this.open.set(null);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.menu-wrap, .ws')) {
      this.open.set(null);
    }
  }

  toggle(menu: string): void {
    this.open.set(this.open() === menu ? null : menu);
  }

  close(): void {
    this.open.set(null);
  }

  switchTo(id: number): void {
    this.close();
    this.auth.switchWorkspace(id);
    void this.router.navigateByUrl('/').then(() => window.location.reload());
  }

  setLocale(locale: Locale): void {
    this.auth.setLocale(locale);
    this.close();
  }

  toggleTheme(): void {
    this.auth.setTheme(this.theme.isDark() ? 'light' : 'dark');
  }

  openNotifications(): void {
    this.toggle('notif');
    this.loadNotifications();
  }

  markRead(): void {
    this.api.post('notifications/read').subscribe(() => this.loadNotifications());
  }

  private loadNotifications(): void {
    if (!this.auth.workspaceId()) {
      return;
    }
    this.api.get<{ data: AppNotification[]; unread: number }>('notifications').subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.unread.set(res.unread);
      },
      error: () => undefined,
    });
  }
}
