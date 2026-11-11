import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Deal, Pipeline, Stage } from '../../core/models';
import { storage } from '../../core/storage';
import { UI } from '../../shared/ui';
import { DealFormModal } from '../shared/deal-form.modal';

@Component({
  selector: 'app-pipeline-page',
  imports: [FormsModule, RouterLink, DealFormModal, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" style="max-width:none">
      <div class="page-header">
        <div><h1>{{ 'pipeline.title' | t }}</h1><p>{{ 'pipeline.dragHint' | t }}</p></div>
        <div class="row wrap">
          @if (pipelines().length > 1) {
            <select class="select" style="width:auto" [ngModel]="pipelineId()" (ngModelChange)="selectPipeline($event)">
              @for (p of pipelines(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
            </select>
          }
          <a class="btn" routerLink="/settings/pipelines"><app-icon name="settings" [size]="16" /></a>
          @if (auth.canWrite()) { <button class="btn primary" (click)="newIn.set(stages()[0]?.id ?? null)"><app-icon name="plus" [size]="16" /> {{ 'pipeline.newDeal' | t }}</button> }
        </div>
      </div>

      <div class="kanban">
        @for (stage of stages(); track stage.id) {
          <section class="kanban-col" [class.drop]="dropTarget() === stage.id"
                   (dragover)="onDragOver($event, stage.id)" (dragleave)="dropTarget.set(null)" (drop)="onDrop($event, stage)">
            <div class="kanban-head">
              <div class="row between">
                <strong>{{ stage.name }}</strong>
                <span class="badge" [class.success]="stage.type === 'won'" [class.danger]="stage.type === 'lost'">{{ dealsIn(stage.id).length }}</span>
              </div>
              <div class="subtle">{{ total(stage.id) | money }}</div>
            </div>
            <div class="kanban-body">
              @for (deal of dealsIn(stage.id); track deal.id; let i = $index) {
                <article class="deal-card" [attr.draggable]="auth.canWrite()" [class.dragging]="dragging() === deal.id"
                         (dragstart)="onDragStart($event, deal)" (dragend)="dragging.set(null)" (dragover)="onCardOver($event, stage.id, i)" (click)="editing.set(deal)">
                  <div class="cell-title">{{ deal.title }}</div>
                  @if (deal.client || deal.lead) { <div class="cell-sub">{{ deal.client?.name ?? deal.lead?.name }}</div> }
                  <div class="row between mt-sm">
                    <strong>{{ deal.value | money: deal.currency }}</strong>
                    @if (deal.expected_close_date) { <span class="subtle">{{ deal.expected_close_date | dt: 'date' }}</span> }
                  </div>
                  @if (deal.owner) { <div class="row mt-sm"><span class="avatar" style="width:22px;height:22px;font-size:9.5px">{{ deal.owner.name | initials }}</span><span class="subtle">{{ deal.owner.name }}</span></div> }
                </article>
              }
              @if (auth.canWrite()) {
                <button class="btn ghost sm block" (click)="newIn.set(stage.id)"><app-icon name="plus" [size]="14" /> {{ 'common.add' | t }}</button>
              }
            </div>
          </section>
        }
      </div>
    </div>

    @if (newIn() !== null) {
      <app-deal-form-modal [stages]="stages()" [stageId]="newIn()" (closed)="newIn.set(null)" (saved)="newIn.set(null); loadDeals()" />
    }
    @if (editing(); as deal) {
      <app-deal-form-modal [deal]="deal" [stages]="stages()" (closed)="editing.set(null)" (saved)="editing.set(null); loadDeals()" />
    }
  `,
})
export class PipelinePage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  protected readonly pipelines = signal<Pipeline[]>([]);
  protected readonly pipelineId = signal<number | null>(Number(storage.get('uf.pipeline')) || null);
  protected readonly deals = signal<Deal[]>([]);
  protected readonly dragging = signal<number | null>(null);
  protected readonly dropTarget = signal<number | null>(null);
  protected readonly newIn = signal<number | null>(null);
  protected readonly editing = signal<Deal | null>(null);
  private dropIndex: number | null = null;

  protected readonly stages = computed<Stage[]>(() => this.pipelines().find((p) => p.id === this.pipelineId())?.stages ?? []);

  ngOnInit(): void {
    this.api.get<{ data: Pipeline[] }>('pipelines').subscribe((res) => {
      this.pipelines.set(res.data);
      if (!res.data.some((p) => p.id === this.pipelineId())) {
        this.pipelineId.set((res.data.find((p) => p.is_default) ?? res.data[0])?.id ?? null);
      }
      this.loadDeals();
    });
  }

  selectPipeline(id: number): void {
    this.pipelineId.set(id);
    storage.set('uf.pipeline', String(id));
    this.loadDeals();
  }

  loadDeals(): void {
    if (this.pipelineId()) {
      this.api.get<{ data: Deal[] }>('deals', { pipeline_id: this.pipelineId() }).subscribe((res) => this.deals.set(res.data));
    }
  }

  dealsIn(stageId: number): Deal[] {
    return this.deals().filter((d) => d.stage_id === stageId).sort((a, b) => a.position - b.position || b.id - a.id);
  }

  total(stageId: number): number {
    return this.dealsIn(stageId).reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  }

  onDragStart(event: DragEvent, deal: Deal): void {
    this.dragging.set(deal.id);
    event.dataTransfer?.setData('text/plain', String(deal.id));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, stageId: number): void {
    if (this.dragging() === null) {
      return;
    }
    event.preventDefault();
    if (this.dropTarget() !== stageId) {
      this.dropTarget.set(stageId);
      this.dropIndex = null;
    }
  }

  onCardOver(event: DragEvent, stageId: number, index: number): void {
    if (this.dragging() === null) {
      return;
    }
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropTarget.set(stageId);
    this.dropIndex = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  }

  onDrop(event: DragEvent, stage: Stage): void {
    event.preventDefault();
    const id = this.dragging();
    this.dropTarget.set(null);
    this.dragging.set(null);
    if (id === null) {
      return;
    }
    const others = this.dealsIn(stage.id).filter((d) => d.id !== id);
    const position = Math.min(this.dropIndex ?? others.length, others.length);
    const ordered = [...others];
    const moved = this.deals().find((d) => d.id === id);
    if (!moved) {
      return;
    }
    ordered.splice(position, 0, { ...moved, stage_id: stage.id });

    /* Optimistic update, then persist. */
    const positions = new Map(ordered.map((d, i) => [d.id, i]));
    this.deals.update((list) => list.map((d) => (positions.has(d.id) ? { ...d, stage_id: d.id === id ? stage.id : d.stage_id, position: positions.get(d.id)! } : d)));
    this.api.post(`deals/${id}/move`, { stage_id: stage.id, position }).subscribe({ error: () => this.loadDeals() });
  }
}
