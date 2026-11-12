import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fieldErrors } from '../../core/interceptors';
import { ImportJob, ImportPayload } from '../../core/models';
import { UI } from '../../shared/ui';

interface ImportRowLog {
  id: number;
  row_number: number;
  status: string;
  messages: string[] | null;
  record_id: number | null;
}

@Component({
  selector: 'app-imports-page',
  imports: [FormsModule, RouterLink, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'imports.title' | t }}</h1><p>{{ 'imports.subtitle' | t }}</p></div>
        @if (payload()) { <button class="btn" (click)="reset()"><app-icon name="plus" [size]="16" /> {{ 'common.add' | t }}</button> }
      </div>

      <div class="steps">
        @for (s of steps; track s; let i = $index) {
          <div class="step" [class.active]="stepIndex() === i" [class.done]="stepIndex() > i"><span class="n">{{ stepIndex() > i ? '✓' : i + 1 }}</span>{{ 'imports.steps.' + s | t }}</div>
        }
      </div>

      @if (!payload()) {
        <div class="card">
          <div class="card-body stack">
            <div class="row">
              <span class="label">{{ 'imports.target' | t }}</span>
              <div class="segmented">
                <button [class.active]="target === 'clients'" (click)="target = 'clients'">{{ 'nav.clients' | t }}</button>
                <button [class.active]="target === 'leads'" (click)="target = 'leads'">{{ 'nav.leads' | t }}</button>
              </div>
            </div>
            <label class="dropzone" [class.over]="over()" (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="onDrop($event)">
              <input type="file" accept=".csv,.txt,.xlsx,.xls" hidden (change)="onFile($event)" [disabled]="!auth.canWrite()" />
              <app-icon name="upload" [size]="32" />
              <h3 class="mt-sm">{{ (busy() ? 'common.loading' : 'imports.drop') | t }}</h3>
              <p class="subtle mt-sm">{{ 'imports.formats' | t }}</p>
            </label>
            @if (uploadError()) { <div class="banner danger">{{ uploadError() }}</div> }
          </div>
        </div>
      } @else if (payload(); as p) {
        @if (p.data.status === 'uploaded') {
          <div class="grid grid-3">
            <div class="card span-2">
              <div class="card-header">
                <h3>{{ 'imports.mapping' | t }} · {{ p.data.original_name }}</h3>
                @if (p.data.sheets.length > 1) {
                  <select class="select sm" style="width:auto" [ngModel]="p.data.sheet" (ngModelChange)="update({ sheet: $event })">
                    @for (s of p.data.sheets; track s) { <option [value]="s">{{ 'imports.sheet' | t }}: {{ s }}</option> }
                  </select>
                }
              </div>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>{{ 'imports.column' | t }}</th><th>{{ 'imports.field' | t }}</th><th>{{ 'imports.preview' | t }}</th></tr></thead>
                  <tbody>
                    @for (header of p.data.headers; track $index; let i = $index) {
                      <tr>
                        <td class="cell-title">{{ header }}</td>
                        <td>
                          <select class="select sm" [ngModel]="mapping[i] ?? ''" (ngModelChange)="setMapping(i, $event)">
                            <option value="">{{ 'imports.ignore' | t }}</option>
                            @for (field of p.fields; track field) { <option [value]="field">{{ 'imports.fieldNames.' + field | t }}</option> }
                          </select>
                        </td>
                        <td class="subtle truncate" style="max-width:220px">{{ sample(i) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="stack">
              <div class="card">
                <div class="card-header"><h3>{{ 'imports.steps.review' | t }}</h3></div>
                <div class="card-body stack">
                  <div class="row between"><span>{{ 'imports.rows' | t }}</span><strong>{{ p.data.total_rows }}</strong></div>
                  <div class="row between"><span class="badge success">{{ 'imports.valid' | t }}</span><strong>{{ p.preview?.summary?.valid }}</strong></div>
                  <div class="row between"><span class="badge danger">{{ 'imports.invalid' | t }}</span><strong>{{ p.preview?.summary?.invalid }}</strong></div>
                  <div class="row between"><span class="badge warning">{{ 'imports.duplicate' | t }}</span><strong>{{ p.preview?.summary?.duplicates }}</strong></div>
                  @if (p.max_rows !== null && p.data.total_rows > p.max_rows) { <div class="banner gold">{{ 'imports.maxRows' | t: { max: p.max_rows } }}</div> }
                  <hr />
                  <span class="label">{{ 'imports.duplicates' | t }}</span>
                  <label class="check"><input type="radio" name="dup" value="skip" [ngModel]="p.data.duplicate_mode" (ngModelChange)="update({ duplicate_mode: 'skip' })" /> {{ 'imports.skip' | t }}</label>
                  <label class="check">
                    <input type="radio" name="dup" value="update" [ngModel]="p.data.duplicate_mode" (ngModelChange)="update({ duplicate_mode: 'update' })" [disabled]="!p.can_update_duplicates" />
                    {{ 'imports.update' | t }} @if (!p.can_update_duplicates) { <app-icon name="lock" [size]="12" /> }
                  </label>
                  @if (startError()) { <div class="banner danger">{{ startError() }}</div> }
                  <button class="btn primary block" (click)="start()" [disabled]="busy() || !auth.canWrite()">{{ 'imports.start' | t }} <app-icon name="arrowRight" [size]="16" /></button>
                </div>
              </div>
            </div>
          </div>

          <div class="card mt">
            <div class="card-header"><h3>{{ 'imports.preview' | t }}</h3></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>#</th>@for (f of mappedFields(); track f) { <th>{{ 'imports.fieldNames.' + f | t }}</th> }<th>{{ 'common.status' | t }}</th></tr></thead>
                <tbody>
                  @for (row of p.preview?.rows ?? []; track row.row) {
                    <tr>
                      <td class="subtle">{{ row.row }}</td>
                      @for (f of mappedFields(); track f) { <td class="truncate" style="max-width:200px">{{ cell(row.values, f) }}</td> }
                      <td>
                        @if (row.errors.length) { <span class="badge danger" [title]="row.errors.join('\n')">{{ row.errors[0] }}</span> }
                        @else if (row.duplicate) { <span class="badge warning">{{ 'imports.duplicate' | t }}</span> }
                        @else { <span class="badge success">✓</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else {
          <div class="card">
            <div class="card-body stack">
              <div class="row between">
                <h2>{{ p.data.original_name }}</h2>
                <span class="badge" [class.success]="p.data.status === 'completed'" [class.danger]="p.data.status === 'failed'" [class.info]="p.data.status === 'processing' || p.data.status === 'queued'">{{ 'imports.statuses.' + p.data.status | t }}</span>
              </div>
              @if (p.data.status === 'queued' || p.data.status === 'processing') { <div class="banner info">{{ 'imports.processing' | t }}</div> }
              @if (p.data.status === 'completed') { <div class="banner info">✓ {{ 'imports.done' | t }}</div> }
              @if (p.data.error) { <div class="banner danger">{{ p.data.error }}</div> }
              <div class="grid grid-4">
                <div class="card flat stat"><span class="stat-label">{{ 'imports.imported' | t }}</span><span class="stat-value">{{ p.data.imported_count }}</span></div>
                <div class="card flat stat"><span class="stat-label">{{ 'imports.updated' | t }}</span><span class="stat-value">{{ p.data.updated_count }}</span></div>
                <div class="card flat stat"><span class="stat-label">{{ 'imports.skipped' | t }}</span><span class="stat-value">{{ p.data.skipped_count }}</span></div>
                <div class="card flat stat"><span class="stat-label">{{ 'imports.failed' | t }}</span><span class="stat-value" [class.danger]="p.data.failed_count > 0">{{ p.data.failed_count }}</span></div>
              </div>
              <div class="row"><a class="btn primary" [routerLink]="p.data.target === 'clients' ? '/clients' : '/leads'">{{ (p.data.target === 'clients' ? 'nav.clients' : 'nav.leads') | t }} →</a></div>
            </div>
            @if (rows().length) {
              <div class="card-header" style="border-top:1px solid var(--border)"><h3>{{ 'imports.rowLog' | t }}</h3></div>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>#</th><th>{{ 'common.status' | t }}</th><th>{{ 'common.message' | t }}</th></tr></thead>
                  <tbody>
                    @for (r of rows(); track r.id) {
                      <tr><td>{{ r.row_number }}</td><td><span class="badge" [class.success]="r.status === 'imported' || r.status === 'updated'" [class.danger]="r.status === 'failed'" [class.warning]="r.status === 'skipped'">{{ 'imports.' + r.status | t }}</span></td><td class="small">{{ r.messages?.join(' · ') }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      }

      <div class="card mt">
        <div class="card-header"><h3>{{ 'imports.history' | t }}</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>{{ 'common.date' | t }}</th><th>{{ 'imports.upload' | t }}</th><th>{{ 'imports.target' | t }}</th><th>{{ 'common.status' | t }}</th><th class="right">{{ 'imports.imported' | t }}</th><th class="right">{{ 'imports.skipped' | t }}</th><th class="right">{{ 'imports.failed' | t }}</th></tr></thead>
            <tbody>
              @for (job of history(); track job.id) {
                <tr class="clickable" (click)="openJob(job)">
                  <td class="subtle nowrap">{{ job.created_at | dt }}</td><td>{{ job.original_name }}</td><td>{{ (job.target === 'clients' ? 'nav.clients' : 'nav.leads') | t }}</td>
                  <td><span class="badge">{{ 'imports.statuses.' + job.status | t }}</span></td>
                  <td class="right">{{ job.imported_count + job.updated_count }}</td><td class="right">{{ job.skipped_count }}</td><td class="right">{{ job.failed_count }}</td>
                </tr>
              } @empty { <tr><td colspan="7"><app-empty-state illustration="imports" [compact]="true" [title]="'empty.importsTitle' | t" [text]="'empty.importsText' | t" /></td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ImportsPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);

  protected readonly steps = ['upload', 'map', 'review', 'result'];
  protected readonly payload = signal<ImportPayload | null>(null);
  protected readonly history = signal<ImportJob[]>([]);
  protected readonly rows = signal<ImportRowLog[]>([]);
  protected readonly busy = signal(false);
  protected readonly over = signal(false);
  protected readonly uploadError = signal('');
  protected readonly startError = signal('');
  protected target: 'clients' | 'leads' = 'clients';
  protected mapping: Record<number, string | null> = {};
  private poll: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  stepIndex(): number {
    const p = this.payload();
    if (!p) return 0;
    if (p.data.status === 'uploaded') return Object.values(this.mapping).some(Boolean) ? 2 : 1;
    return 3;
  }

  loadHistory(): void {
    this.api.get<{ data: ImportJob[] }>('imports').subscribe((res) => this.history.set(res.data));
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && this.auth.canWrite()) this.upload(file);
  }

  onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.upload(file);
  }

  upload(file: File): void {
    this.busy.set(true);
    this.uploadError.set('');
    const body = new FormData();
    body.append('file', file);
    body.append('target', this.target);
    this.http.post<ImportPayload>(this.api.url('imports'), body).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.applyPayload(res);
        this.loadHistory();
      },
      error: (err) => {
        this.busy.set(false);
        this.uploadError.set(fieldErrors(err)['file'] ?? err?.error?.message ?? '');
      },
    });
  }

  applyPayload(payload: ImportPayload): void {
    this.payload.set(payload);
    this.mapping = Object.fromEntries(Object.entries(payload.data.mapping).map(([k, v]) => [Number(k), v]));
    if (payload.data.status === 'completed' || payload.data.status === 'failed') {
      this.loadRows(payload.data.id);
    }
  }

  setMapping(index: number, field: string): void {
    this.mapping[index] = field || null;
    this.update({ mapping: Object.fromEntries(Object.entries(this.mapping).map(([k, v]) => [k, v])) });
  }

  update(changes: Record<string, unknown>): void {
    const p = this.payload();
    if (!p) return;
    this.api.patch<ImportPayload>(`imports/${p.data.id}`, changes).subscribe((res) => this.applyPayload(res));
  }

  mappedFields(): string[] {
    const fields = Object.values(this.mapping).filter((f): f is string => !!f).map((f) => (f === 'first_name' || f === 'last_name' ? 'name' : f));
    return [...new Set(fields)];
  }

  sample(index: number): string {
    const row = this.payload()?.preview?.rows[0];
    const field = this.mapping[index];
    return row && field ? this.cell(row.values, field === 'first_name' || field === 'last_name' ? 'name' : field) : '';
  }

  cell(values: Record<string, unknown>, field: string): string {
    const value = values[field];
    return value === null || value === undefined ? '' : String(value);
  }

  start(): void {
    const p = this.payload();
    if (!p) return;
    this.busy.set(true);
    this.startError.set('');
    this.api.post<{ data: ImportJob }>(`imports/${p.data.id}/start`).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.payload.set({ ...p, data: res.data, preview: null });
        this.watch(res.data.id);
      },
      error: (err) => {
        this.busy.set(false);
        this.startError.set(Object.values(fieldErrors(err))[0] ?? '');
      },
    });
  }

  openJob(job: ImportJob): void {
    this.api.get<ImportPayload>(`imports/${job.id}`).subscribe((res) => {
      this.applyPayload(res);
      if (res.data.status === 'queued' || res.data.status === 'processing') this.watch(job.id);
    });
  }

  reset(): void {
    this.stopPolling();
    this.payload.set(null);
    this.rows.set([]);
    this.mapping = {};
  }

  private watch(id: number): void {
    this.stopPolling();
    const check = () =>
      this.api.get<ImportPayload>(`imports/${id}`).subscribe((res) => {
        this.payload.set(res);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          this.stopPolling();
          this.loadRows(id);
          this.loadHistory();
          this.auth.refreshSubscription();
        }
      });
    check();
    this.poll = setInterval(check, 2000);
  }

  private loadRows(id: number): void {
    this.api.get<{ data: ImportRowLog[] }>(`imports/${id}/rows`, { per_page: 100 }).subscribe((res) => this.rows.set(res.data.filter((r) => r.status !== 'imported')));
  }

  private stopPolling(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }
}
