import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { UI } from '../../shared/ui';

interface SystemHealth {
  checks: { key: string; status: 'ok' | 'warn' | 'error'; detail: string | null }[];
  versions: { php: string; laravel: string };
  failed_jobs: { uuid: string; queue: string; job: string | null; exception: string; failed_at: string }[];
  recent_errors: { at: string; level: string; message: string }[];
}

/** Services, queue, scheduler, configuration checks, failed jobs and recent application errors. */
@Component({
  selector: 'app-admin-system',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as d) {
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header"><h3>{{ 'platform.checks' | t }}</h3><button class="btn ghost sm" (click)="load()">↻</button></div>
          @for (c of d.checks; track c.key) {
            <div class="row" style="padding:10px 22px;border-bottom:1px solid var(--border)">
              <span class="dot" [style.background]="c.status === 'ok' ? 'var(--success)' : c.status === 'warn' ? 'var(--warning)' : 'var(--danger)'"></span>
              <strong style="width:140px">{{ c.key }}</strong>
              <span class="muted small spacer truncate">{{ c.detail }}</span>
              <span class="badge" [class.success]="c.status === 'ok'" [class.warning]="c.status === 'warn'" [class.danger]="c.status === 'error'">{{ c.status }}</span>
            </div>
          }
          <div class="card-body subtle">{{ 'platform.versions' | t }}: PHP {{ d.versions.php }} · Laravel {{ d.versions.laravel }}</div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'platform.failedJobs' | t }} ({{ d.failed_jobs.length }})</h3></div>
          @for (j of d.failed_jobs; track j.uuid) {
            <div class="card-body" style="border-bottom:1px solid var(--border)">
              <div class="row between"><strong>{{ j.job }}</strong><span class="subtle">{{ j.failed_at }}</span></div>
              <code class="small" style="color:var(--danger)">{{ j.exception }}</code>
              <div class="row end mt-sm"><button class="btn sm" (click)="forget(j.uuid)">{{ 'platform.forget' | t }}</button><button class="btn sm primary" (click)="retry(j.uuid)">{{ 'platform.retry' | t }}</button></div>
            </div>
          } @empty { <div class="empty small">{{ 'platform.noErrors' | t }}</div> }
        </div>
      </div>
      <div class="card mt">
        <div class="card-header"><h3>{{ 'platform.recentErrors' | t }}</h3></div>
        <div class="table-wrap"><table class="table">
          <tbody>
            @for (e of d.recent_errors; track $index) {
              <tr><td class="subtle nowrap">{{ e.at }}</td><td><span class="badge danger">{{ e.level }}</span></td><td class="small"><code>{{ e.message }}</code></td></tr>
            } @empty { <tr><td><div class="empty small">{{ 'platform.noErrors' | t }}</div></td></tr> }
          </tbody>
        </table></div>
      </div>
    }
  `,
})
export class AdminSystemComponent {
  private readonly api = inject(ApiService);
  protected readonly data = signal<SystemHealth | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<SystemHealth>('admin/system').subscribe((res) => this.data.set(res));
  }

  retry(uuid: string): void {
    this.api.post(`admin/system/failed-jobs/${uuid}/retry`).subscribe(() => this.load());
  }

  forget(uuid: string): void {
    this.api.delete(`admin/system/failed-jobs/${uuid}`).subscribe(() => this.load());
  }
}
