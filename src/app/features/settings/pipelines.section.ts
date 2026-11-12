import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { fieldErrors } from '../../core/interceptors';
import { Pipeline, Stage } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UI } from '../../shared/ui';

type StageDraft = Pick<Stage, 'name' | 'type'> & { id?: number };

@Component({
  selector: 'app-pipelines-section',
  imports: [FormsModule, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row between mb">
      <span class="muted">{{ usage() }}</span>
      @if (auth.canWrite()) { <button class="btn primary" (click)="startNew()"><app-icon name="plus" [size]="16" /> {{ 'pipeline.newPipeline' | t }}</button> }
    </div>
    <div class="grid grid-2">
      @for (p of pipelines(); track p.id) {
        <div class="card">
          <div class="card-header">
            <h3>{{ p.name }} @if (p.is_default) { <span class="badge primary">★</span> }</h3>
            @if (auth.canWrite()) {
              <div class="row">
                <button class="btn sm" (click)="edit(p)"><app-icon name="edit" [size]="14" /></button>
                @if (pipelines().length > 1) { <button class="btn sm danger" (click)="remove(p)"><app-icon name="trash" [size]="14" /></button> }
              </div>
            }
          </div>
          <div class="card-body row wrap">
            @for (s of p.stages; track s.id) { <span class="badge" [class.success]="s.type === 'won'" [class.danger]="s.type === 'lost'">{{ s.name }} ({{ s.deals_count ?? 0 }})</span> }
          </div>
        </div>
      }
    </div>

    @if (editing()) {
      <app-modal [title]="(editingId() ? 'pipeline.editPipeline' : 'pipeline.newPipeline') | t" (closed)="editing.set(false)">
        <div class="stack">
          <div class="field"><label>{{ 'pipeline.pipelineName' | t }}</label><input class="input" [(ngModel)]="name" /></div>
          <span class="label">{{ 'pipeline.stages' | t }}</span>
          @for (s of stages; track $index; let i = $index) {
            <div class="row">
              <input class="input sm" [(ngModel)]="s.name" />
              <select class="select sm" style="width:140px" [(ngModel)]="s.type">
                @for (type of ['open', 'won', 'lost']; track type) { <option [value]="type">{{ 'pipeline.stageTypes.' + type | t }}</option> }
              </select>
              <button class="btn ghost sm icon" (click)="moveStage(i, -1)" [disabled]="i === 0">↑</button>
              <button class="btn ghost sm icon" (click)="moveStage(i, 1)" [disabled]="i === stages.length - 1">↓</button>
              <button class="btn ghost sm icon" (click)="stages.splice(i, 1)"><app-icon name="x" [size]="14" /></button>
            </div>
          }
          <button class="btn sm" style="align-self:flex-start" (click)="stages.push({ name: '', type: 'open' })"><app-icon name="plus" [size]="14" /> {{ 'pipeline.addStage' | t }}</button>
          @if (editingId()) { <label class="check small"><input type="checkbox" [(ngModel)]="isDefault" /> ★ default</label> }
          @if (error()) { <div class="banner danger">{{ error() }}</div> }
        </div>
        <div footer class="modal-footer">
          <button class="btn" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          <button class="btn primary" (click)="save()">{{ 'common.save' | t }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class PipelinesSection {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected readonly pipelines = signal<Pipeline[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly error = signal('');
  protected name = '';
  protected isDefault = false;
  protected stages: StageDraft[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<{ data: Pipeline[] }>('pipelines').subscribe((res) => this.pipelines.set(res.data));
  }

  usage(): string {
    const u = this.auth.subscription()?.usage['pipelines'];
    return u ? `${u.used} / ${u.limit ?? '∞'}` : '';
  }

  startNew(): void {
    this.editingId.set(null);
    this.name = '';
    this.stages = ['new', 'contacted', 'proposal_sent', 'negotiation'].map((key) => ({ name: this.defaultStage(key), type: 'open' as const }));
    this.stages.push({ name: this.i18n.t('pipeline.stageTypes.won'), type: 'won' }, { name: this.i18n.t('pipeline.stageTypes.lost'), type: 'lost' });
    this.error.set('');
    this.editing.set(true);
  }

  edit(pipeline: Pipeline): void {
    this.editingId.set(pipeline.id);
    this.name = pipeline.name;
    this.isDefault = pipeline.is_default;
    this.stages = pipeline.stages.map((s) => ({ id: s.id, name: s.name, type: s.type }));
    this.error.set('');
    this.editing.set(true);
  }

  moveStage(index: number, direction: number): void {
    [this.stages[index], this.stages[index + direction]] = [this.stages[index + direction], this.stages[index]];
  }

  save(): void {
    const id = this.editingId();
    const payload = { name: this.name, stages: this.stages, ...(id ? { is_default: this.isDefault } : {}) };
    const request = id ? this.api.patch(`pipelines/${id}`, payload) : this.api.post('pipelines', payload);
    request.subscribe({
      next: () => {
        this.editing.set(false);
        this.toast.success(this.i18n.t('common.saved'));
        this.load();
        this.auth.refreshSubscription();
      },
      error: (err) => this.error.set(Object.values(fieldErrors(err))[0] ?? err?.error?.message ?? ''),
    });
  }

  remove(pipeline: Pipeline): void {
    if (confirm(this.i18n.t('common.confirmDelete'))) {
      this.api.delete(`pipelines/${pipeline.id}`).subscribe(() => {
        this.load();
        this.auth.refreshSubscription();
      });
    }
  }

  private defaultStage(key: string): string {
    const names: Record<string, Record<string, string>> = {
      hu: { new: 'Új érdeklődő', contacted: 'Kapcsolatfelvétel', proposal_sent: 'Ajánlat elküldve', negotiation: 'Tárgyalás' },
      en: { new: 'New lead', contacted: 'Contacted', proposal_sent: 'Proposal sent', negotiation: 'Negotiation' },
      de: { new: 'Neuer Interessent', contacted: 'Kontaktaufnahme', proposal_sent: 'Angebot gesendet', negotiation: 'Verhandlung' },
    };
    return names[this.i18n.locale()]?.[key] ?? key;
  }
}
