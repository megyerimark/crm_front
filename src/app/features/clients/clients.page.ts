import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService, QueryParams } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MembersService } from '../../core/members.service';
import { Client, Paginated } from '../../core/models';
import { storage } from '../../core/storage';
import { UI, clientStatusClass, saveBlob } from '../../shared/ui';
import { ClientFormModal } from '../shared/client-form.modal';

@Component({
  selector: 'app-clients-page',
  imports: [FormsModule, LowerCasePipe, RouterLink, ClientFormModal, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'clients.title' | t }}</h1><p>{{ page()?.meta?.total ?? 0 | num }} {{ 'clients.title' | t | lowercase }}</p></div>
        <div class="row wrap">
          <button class="btn" (click)="export('csv')"><app-icon name="download" [size]="16" /> {{ 'clients.exportCsv' | t }}</button>
          <button class="btn" (click)="export('xlsx')" [title]="auth.feature('excel_export') ? '' : ('common.locked' | t)">
            <app-icon [name]="auth.feature('excel_export') ? 'download' : 'lock'" [size]="16" /> {{ 'clients.exportXlsx' | t }}
          </button>
          @if (auth.canWrite()) { <button class="btn primary" (click)="editing.set('new')"><app-icon name="plus" [size]="16" /> {{ 'clients.new' | t }}</button> }
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div>
          <select class="select" style="width:auto" [(ngModel)]="status" (ngModelChange)="reload()">
            <option value="">{{ 'common.status' | t }}: {{ 'common.all' | t }}</option>
            <option value="active">{{ 'clients.active' | t }}</option><option value="prospect">{{ 'clients.prospect' | t }}</option><option value="inactive">{{ 'clients.inactive' | t }}</option>
          </select>
          <select class="select" style="width:auto" [(ngModel)]="type" (ngModelChange)="reload()">
            <option value="">{{ 'common.type' | t }}: {{ 'common.all' | t }}</option>
            <option value="person">{{ 'clients.person' | t }}</option><option value="company">{{ 'clients.companyType' | t }}</option>
          </select>
          <select class="select" style="width:auto" [(ngModel)]="ownerId" (ngModelChange)="reload()">
            <option value="">{{ 'common.owner' | t }}: {{ 'common.all' | t }}</option>
            @for (m of members.members(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }
          </select>
          <button class="btn ghost sm" (click)="showAdvanced.set(!showAdvanced())">
            <app-icon [name]="auth.feature('advanced_search') ? 'search' : 'lock'" [size]="14" /> {{ 'clients.advancedFilters' | t }}
          </button>
          <span class="spacer"></span>
          <div class="segmented">
            <button [class.active]="view() === 'table'" (click)="setView('table')"><app-icon name="list" [size]="15" /></button>
            <button [class.active]="view() === 'cards'" (click)="setView('cards')"><app-icon name="grid" [size]="15" /></button>
          </div>
        </div>
        @if (showAdvanced()) {
          @if (auth.feature('advanced_search')) {
            <div class="toolbar">
              <input class="input sm" style="width:160px" [placeholder]="'common.category' | t" [(ngModel)]="category" (ngModelChange)="search$.next()" />
              <input class="input sm" style="width:160px" [placeholder]="'common.tags' | t" [(ngModel)]="tag" (ngModelChange)="search$.next()" />
              <select class="select sm" style="width:auto" [(ngModel)]="source" (ngModelChange)="reload()">
                <option value="">{{ 'common.source' | t }}: {{ 'common.all' | t }}</option>
                @for (s of ['manual', 'form', 'link', 'import']; track s) { <option [value]="s">{{ 'leads.sources.' + s | t }}</option> }
              </select>
              <label class="row small">{{ 'clients.createdFrom' | t }} <input class="input sm" type="date" style="width:auto" [(ngModel)]="createdFrom" (ngModelChange)="reload()" /></label>
              <label class="row small">{{ 'clients.createdTo' | t }} <input class="input sm" type="date" style="width:auto" [(ngModel)]="createdTo" (ngModelChange)="reload()" /></label>
            </div>
          } @else {
            <div class="toolbar"><span class="badge gold"><app-icon name="lock" [size]="12" /> {{ 'common.locked' | t }}</span></div>
          }
        }

        @if (view() === 'table') {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th class="sortable" (click)="sortBy('name')">{{ 'common.name' | t }} {{ sortIcon('name') }}</th>
                  <th class="sortable" (click)="sortBy('email')">{{ 'common.email' | t }} / {{ 'common.phone' | t }} {{ sortIcon('email') }}</th>
                  <th class="sortable" (click)="sortBy('status')">{{ 'common.status' | t }} {{ sortIcon('status') }}</th>
                  <th>{{ 'common.tags' | t }}</th>
                  <th>{{ 'common.owner' | t }}</th>
                  <th class="right">{{ 'clients.openTasks' | t }}</th>
                  <th class="sortable" (click)="sortBy('created_at')">{{ 'common.created' | t }} {{ sortIcon('created_at') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (c of page()?.data ?? []; track c.id) {
                  <tr class="clickable" (click)="open(c)">
                    <td>
                      <div class="row">
                        <span class="avatar">{{ c.name | initials }}</span>
                        <div><div class="cell-title">{{ c.name }}</div><div class="cell-sub">{{ c.company }}</div></div>
                      </div>
                    </td>
                    <td><div>{{ c.email }}</div><div class="cell-sub">{{ c.phone }}</div></td>
                    <td><span class="badge" [class]="'badge ' + statusClass(c.status)">{{ 'clients.' + c.status | t }}</span></td>
                    <td><div class="row wrap">@for (tag of c.tags; track tag) { <span class="tag">{{ tag }}</span> }</div></td>
                    <td class="small">{{ c.owner?.name ?? '–' }}</td>
                    <td class="right">{{ c.open_tasks_count ?? 0 }}</td>
                    <td class="subtle nowrap">{{ c.created_at | dt: 'date' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7">@if (hasFilters()) {
                    <app-empty-state illustration="search" [title]="'empty.noResultsTitle' | t" [text]="'empty.noResultsText' | t" />
                  } @else {
                    <app-empty-state illustration="clients" [title]="'empty.clientsTitle' | t" [text]="'empty.clientsText' | t">
                      <a class="btn primary" routerLink="/imports">{{ 'empty.clientsCta' | t }}</a>
                    </app-empty-state>
                  }</td></tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="card-body grid grid-3">
            @for (c of page()?.data ?? []; track c.id) {
              <div class="card flat" style="padding:16px;cursor:pointer" (click)="open(c)">
                <div class="row">
                  <span class="avatar lg">{{ c.name | initials }}</span>
                  <div class="spacer truncate"><div class="cell-title truncate">{{ c.name }}</div><div class="cell-sub truncate">{{ c.company }}</div></div>
                  <span class="badge" [class]="'badge ' + statusClass(c.status)">{{ 'clients.' + c.status | t }}</span>
                </div>
                <div class="stack-sm mt small">
                  @if (c.email) { <span class="row"><app-icon name="mail" [size]="14" /> {{ c.email }}</span> }
                  @if (c.phone) { <span class="row"><app-icon name="phone" [size]="14" /> {{ c.phone }}</span> }
                </div>
                <div class="row wrap mt-sm">@for (tag of c.tags; track tag) { <span class="tag">{{ tag }}</span> }</div>
              </div>
            } @empty { <div style="grid-column:1/-1">@if (hasFilters()) {
                    <app-empty-state illustration="search" [title]="'empty.noResultsTitle' | t" [text]="'empty.noResultsText' | t" />
                  } @else {
                    <app-empty-state illustration="clients" [title]="'empty.clientsTitle' | t" [text]="'empty.clientsText' | t">
                      <a class="btn primary" routerLink="/imports">{{ 'empty.clientsCta' | t }}</a>
                    </app-empty-state>
                  }</div> }
          </div>
        }
        <app-pagination [meta]="page()?.meta ?? null" (page)="goTo($event)" (perPage)="perPage = $event; reload()" />
      </div>
    </div>

    @if (editing() === 'new') { <app-client-form-modal (closed)="editing.set(null)" (saved)="editing.set(null); open($event)" /> }
  `,
})
export class ClientsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);

  protected readonly page = signal<Paginated<Client> | null>(null);
  protected readonly editing = signal<'new' | null>(null);
  protected readonly view = signal<'table' | 'cards'>((storage.get('uf.clients.view') as 'table' | 'cards') || 'table');
  protected readonly showAdvanced = signal(false);
  protected readonly search$ = new Subject<void>();

  protected search = '';
  protected status = '';
  protected type = '';
  protected ownerId = '';
  protected category = '';
  protected tag = '';
  protected source = '';
  protected createdFrom = '';
  protected createdTo = '';
  protected sort = 'created_at';
  protected direction: 'asc' | 'desc' = 'desc';
  protected perPage = 25;
  private current = 1;

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
  }

  ngOnInit(): void {
    this.members.load();
    this.reload();
  }

  statusClass = clientStatusClass;

  params(): QueryParams {
    return {
      search: this.search, status: this.status, type: this.type, owner_id: this.ownerId, category: this.category, tag: this.tag, source: this.source,
      created_from: this.createdFrom, created_to: this.createdTo, sort: this.sort, direction: this.direction,
    };
  }

  reload(): void {
    this.current = 1;
    this.fetch();
  }

  goTo(page: number): void {
    this.current = page;
    this.fetch();
  }

  fetch(): void {
    this.api.get<Paginated<Client>>('clients', { ...this.params(), page: this.current, per_page: this.perPage }).subscribe((res) => this.page.set(res));
  }

  sortBy(column: string): void {
    this.direction = this.sort === column && this.direction === 'asc' ? 'desc' : 'asc';
    this.sort = column;
    this.reload();
  }

  sortIcon(column: string): string {
    return this.sort === column ? (this.direction === 'asc' ? '↑' : '↓') : '';
  }

  setView(view: 'table' | 'cards'): void {
    this.view.set(view);
    storage.set('uf.clients.view', view);
  }

  hasFilters(): boolean {
    return !!(this.search || this.status || this.type || this.ownerId || this.category || this.tag || this.source || this.createdFrom || this.createdTo);
  }

  open(client: Client): void {
    void this.router.navigate(['/clients', client.id]);
  }

  export(format: 'csv' | 'xlsx'): void {
    this.api.download('clients/export', { ...this.params(), format }).subscribe({
      next: (blob) => saveBlob(blob, `clients.${format}`),
      error: async (err) => {
        /* Blob error bodies are not parsed by the interceptor; it already showed the generic toast. */
        void err;
      },
    });
  }
}
