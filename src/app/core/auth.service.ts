import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { ApiService } from './api.service';
import { I18nService } from './i18n/i18n.service';
import { Locale, Role, Subscription, Theme, User, Workspace } from './models';
import { storage } from './storage';
import { ThemeService } from './theme.service';

interface AuthResponse {
  token: string;
  user: User;
  workspaces: Workspace[];
}

const TOKEN_KEY = 'uf.token';
const WORKSPACE_KEY = 'uf.workspace';
const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly token = signal<string | null>(storage.get(TOKEN_KEY));
  readonly user = signal<User | null>(null);
  readonly workspaces = signal<Workspace[]>([]);
  readonly workspaceId = signal<number | null>(Number(storage.get(WORKSPACE_KEY)) || null);
  readonly subscription = signal<Subscription | null>(null);

  readonly isLoggedIn = computed(() => !!this.token());
  readonly workspace = computed(() => this.workspaces().find((w) => w.id === this.workspaceId()) ?? null);
  readonly role = computed<Role | null>(() => this.workspace()?.role ?? null);
  readonly canWrite = computed(() => this.hasRole('member'));
  readonly isAdmin = computed(() => this.hasRole('admin'));
  readonly timezone = computed(() => this.user()?.timezone || this.workspace()?.timezone || 'Europe/Budapest');
  readonly currency = computed(() => this.workspace()?.currency || 'HUF');

  private loaded = false;

  hasRole(minimum: Role): boolean {
    const role = this.role();
    return !!role && ROLE_RANK[role] >= ROLE_RANK[minimum];
  }

  feature(key: string): boolean {
    return !!this.subscription()?.features[key];
  }

  /** Loads the user once (used by guards). */
  async ensureLoaded(): Promise<boolean> {
    if (!this.token()) {
      return false;
    }
    if (this.loaded) {
      return true;
    }
    try {
      await firstValueFrom(this.loadMe());
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  loadMe(): Observable<{ user: User; workspaces: Workspace[] }> {
    return this.api.get<{ user: User; workspaces: Workspace[] }>('auth/me').pipe(
      tap((res) => this.applySession(res.user, res.workspaces)),
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('auth/login', { email, password }).pipe(tap((res) => this.storeSession(res)));
  }

  register(payload: Record<string, unknown>): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('auth/register', payload).pipe(tap((res) => this.storeSession(res)));
  }

  logout(): void {
    if (this.token()) {
      this.api.post('auth/logout').subscribe({ error: () => undefined });
    }
    this.clear();
    void this.router.navigateByUrl('/login');
  }

  switchWorkspace(id: number): void {
    this.setWorkspace(id);
    this.api.post(`workspaces/${id}/switch`).subscribe({ error: () => undefined });
    this.refreshSubscription();
  }

  refreshSubscription(): void {
    if (!this.workspaceId()) {
      this.subscription.set(null);
      return;
    }
    this.api.get<{ data: Workspace; subscription: Subscription }>('workspace').subscribe({
      next: (res) => {
        this.subscription.set(res.subscription);
        this.workspaces.update((list) => list.map((w) => (w.id === res.data.id ? res.data : w)));
      },
      error: () => undefined,
    });
  }

  updateUser(user: User): void {
    this.user.set(user);
    this.i18n.use(user.locale);
    this.theme.set(user.theme);
  }

  setWorkspaces(workspaces: Workspace[]): void {
    this.workspaces.set(workspaces);
  }

  setLocale(locale: Locale): void {
    this.i18n.use(locale);
    if (this.user()) {
      this.api.patch<{ user: User }>('auth/profile', { locale }).subscribe((res) => this.user.set(res.user));
    }
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    if (this.user()) {
      this.api.patch<{ user: User }>('auth/profile', { theme }).subscribe((res) => this.user.set(res.user));
    }
  }

  setWorkspace(id: number | null): void {
    this.workspaceId.set(id);
    storage.set(WORKSPACE_KEY, id ? String(id) : null);
  }

  private storeSession(res: AuthResponse): void {
    this.token.set(res.token);
    storage.set(TOKEN_KEY, res.token);
    this.applySession(res.user, res.workspaces);
  }

  private applySession(user: User, workspaces: Workspace[]): void {
    this.loaded = true;
    this.updateUser(user);
    this.workspaces.set(workspaces);
    const preferred = [this.workspaceId(), user.current_workspace_id, workspaces[0]?.id].find(
      (id) => id && workspaces.some((w) => w.id === id),
    );
    this.setWorkspace(preferred ?? null);
    this.refreshSubscription();
  }

  clear(): void {
    this.loaded = false;
    this.token.set(null);
    this.user.set(null);
    this.workspaces.set([]);
    this.subscription.set(null);
    storage.set(TOKEN_KEY, null);
  }
}
