import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MembersService } from '../../core/members.service';
import { Lead, LeadForm, Paginated } from '../../core/models';
import { UI, leadStatusClass } from '../../shared/ui';
import { LeadFormModal } from '../shared/lead-form.modal';

@Component({
  selector: 'app-leads-page',
  imports: [FormsModule, RouterLink, LeadFormModal, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'leads.title' | t }}</h1><p>{{ page()?.meta?.total ?? 0 | num }}</p></div>
        @if (auth.canWrite()) { <button class="btn primary" (click)="creating.set(true)"><app-icon name="plus" [size]="16" /> {{ 'leads.new' | t }}</button> }
      </div>

      <div class="card">
        <div class="toolbar" style="padding-bottom:0;border-bottom:0">
          <div class="tabs" style="margin:0;border:0">
            <button [class.active]="statusFilter === ''" (click)="setStatus('')">{{ 'common.all' | t }}</button>
            @for (s of statuses; track s) {
              <button [class.active]="statusFilter === s" (click)="setStatus(s)">{{ 'leads.status.' + s | t }}</button>
            }
          </div>
        </div>
        <div class="toolbar">
          <div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div>
          <select class="select" style="width:auto" [(ngModel)]="source" (ngModelChange)="reload()">
            <option value="">{{ 'common.source' | t }}: {{ 'common.all' | t }}</option>
            @for (s of sources; track s) { <option [value]="s">{{ 'leads.sources.' + s | t }}</option> }
          </select>
          <select class="select" style="width:auto" [(ngModel)]="formId" (ngModelChange)="reload()">
            <option value="">{{ 'leads.form' | t }}: {{ 'common.all' | t }}</option>
            @for (f of forms(); track f.id) { <option [value]="f.id">{{ f.name }}</option> }
          </select>
          <select class="select" style="width:auto" [(ngModel)]="ownerId" (ngModelChange)="reload()">
            <option value="">{{ 'common.owner' | t }}: {{ 'common.all' | t }}</option>
            @for (m of members.members(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>{{ 'common.name' | t }}</th><th>{{ 'common.email' | t }} / {{ 'common.phone' | t }}</th><th>{{ 'common.status' | t }}</th>
              <th>{{ 'common.source' | t }}</th><th>{{ 'common.owner' | t }}</th><th>{{ 'common.created' | t }}</th>
            </tr></thead>
            <tbody>
              @for (l of page()?.data ?? []; track l.id) {
                <tr class="clickable" (click)="open(l.id)">
                  <td><div class="cell-title">{{ l.name }}</div><div class="cell-sub truncate" style="max-width:280px">{{ l.company || l.message }}</div></td>
                  <td><div>{{ l.email }}</div><div class="cell-sub">{{ l.phone }}</div></td>
                  <td><span class="badge" [class]="'badge ' + statusClass(l.status)">{{ 'leads.status.' + l.status | t }}</span></td>
                  <td>
                    <div class="small">{{ 'leads.sources.' + l.source | t }}</div>
                    <div class="cell-sub">{{ l.form?.name }}{{ l.utm.source ? ' · ' + l.utm.source : '' }}</div>
                  </td>
                  <td class="small">{{ l.owner?.name ?? '–' }}</td>
                  <td class="subtle nowrap" [title]="l.created_at | dt">{{ l.created_at | dt: 'relative' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6">
                  @if (hasFilters()) {
                    <app-empty-state illustration="search" [title]="'empty.noResultsTitle' | t" [text]="'empty.noResultsText' | t" />
                  } @else {
                    <app-empty-state illustration="leads" [title]="'empty.leadsTitle' | t" [text]="'empty.leadsText' | t">
                      <a class="btn primary" routerLink="/forms">{{ 'empty.leadsCta' | t }}</a>
                    </app-empty-state>
                  }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [meta]="page()?.meta ?? null" (page)="goTo($event)" (perPage)="perPage = $event; reload()" />
      </div>
    </div>
    @if (creating()) { <app-lead-form-modal (closed)="creating.set(false)" (saved)="creating.set(false); open($event.id)" /> }
  `,
})
export class LeadsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);
  readonly status = input<string>();

  protected readonly statuses = ['new', 'contacted', 'qualified', 'unqualified', 'converted'];
  protected readonly sources = ['manual', 'form', 'link', 'import'];
  protected readonly page = signal<Paginated<Lead> | null>(null);
  protected readonly forms = signal<LeadForm[]>([]);
  protected readonly creating = signal(false);
  protected readonly search$ = new Subject<void>();
  protected search = '';
  protected statusFilter = '';
  protected source = '';
  protected formId = '';
  protected ownerId = '';
  protected perPage = 25;
  private current = 1;

  statusClass = leadStatusClass;

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
  }

  ngOnInit(): void {
    this.statusFilter = this.status() ?? '';
    this.members.load();
    this.api.get<{ data: LeadForm[] }>('forms').subscribe((res) => this.forms.set(res.data));
    this.reload();
  }

  setStatus(status: string): void {
    this.statusFilter = status;
    this.reload();
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
    this.api
      .get<Paginated<Lead>>('leads', { search: this.search, status: this.statusFilter, source: this.source, form_id: this.formId, owner_id: this.ownerId, page: this.current, per_page: this.perPage })
      .subscribe((res) => this.page.set(res));
  }

  hasFilters(): boolean {
    return !!(this.search || this.statusFilter || this.source || this.formId || this.ownerId);
  }

  open(id: number): void {
    void this.router.navigate(['/leads', id]);
  }
}
