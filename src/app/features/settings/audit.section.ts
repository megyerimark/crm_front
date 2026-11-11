import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuditLog, Paginated } from '../../core/models';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-audit-section',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>{{ 'common.date' | t }}</th><th>{{ 'common.name' | t }}</th><th>{{ 'common.actions' | t }}</th><th>{{ 'common.details' | t }}</th><th>IP</th></tr></thead>
        <tbody>
          @for (log of page()?.data ?? []; track log.id) {
            <tr><td class="subtle nowrap">{{ log.created_at | dt }}</td><td>{{ log.user?.name ?? '–' }}</td><td><code>{{ log.action }}</code></td><td class="small truncate" style="max-width:360px">{{ meta(log) }}</td><td class="subtle">{{ log.ip_address }}</td></tr>
          } @empty { <tr><td colspan="5"><div class="empty">{{ 'common.empty' | t }}</div></td></tr> }
        </tbody>
      </table></div>
      <app-pagination [meta]="page()?.meta ?? null" (page)="load($event)" (perPage)="load(1)" />
    </div>
  `,
})
export class AuditSection {
  private readonly api = inject(ApiService);
  protected readonly page = signal<Paginated<AuditLog> | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(page = 1): void {
    this.api.get<Paginated<AuditLog>>('audit-logs', { page }).subscribe((res) => this.page.set(res));
  }

  meta(log: AuditLog): string {
    return log.meta ? JSON.stringify(log.meta) : log.auditable_type ? `${log.auditable_type} #${log.auditable_id}` : '';
  }
}
