import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { MembersService } from '../../core/members.service';
import { Paginated, Task } from '../../core/models';
import { storage } from '../../core/storage';
import { UI } from '../../shared/ui';
import { TaskFormModal } from '../shared/task-form.modal';

type CalendarMode = 'month' | 'week' | 'day';

interface CalendarDay {
  date: Date;
  key: string;
  inMonth: boolean;
  today: boolean;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-tasks-page',
  imports: [FormsModule, RouterLink, TaskFormModal, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>{{ 'tasks.title' | t }}</h1></div>
        <div class="row wrap">
          <div class="segmented">
            <button [class.active]="view() === 'list'" (click)="setView('list')"><app-icon name="list" [size]="15" /> {{ 'common.list' | t }}</button>
            <button [class.active]="view() === 'calendar'" (click)="setView('calendar')"><app-icon name="calendar" [size]="15" /> {{ 'tasks.calendar' | t }}</button>
          </div>
          @if (auth.canWrite()) { <button class="btn primary" (click)="newTask.set({})"><app-icon name="plus" [size]="16" /> {{ 'tasks.new' | t }}</button> }
        </div>
      </div>

      @if (view() === 'list') {
        <div class="card">
          <div class="toolbar">
            <div class="search"><app-icon name="search" [size]="16" /><input class="input" [placeholder]="'common.search' | t" [(ngModel)]="search" (ngModelChange)="search$.next()" /></div>
            <select class="select" style="width:auto" [(ngModel)]="status" (ngModelChange)="reload()">
              <option value="open">{{ 'tasks.statuses.open' | t }} + {{ 'tasks.statuses.in_progress' | t }}</option>
              <option value="done">{{ 'tasks.statuses.done' | t }}</option>
              <option value="">{{ 'common.all' | t }}</option>
            </select>
            <select class="select" style="width:auto" [(ngModel)]="priority" (ngModelChange)="reload()">
              <option value="">{{ 'tasks.priority' | t }}: {{ 'common.all' | t }}</option>
              @for (p of priorities; track p) { <option [value]="p">{{ 'tasks.priorities.' + p | t }}</option> }
            </select>
            <select class="select" style="width:auto" [(ngModel)]="assignee" (ngModelChange)="reload()">
              <option value="">{{ 'tasks.assignee' | t }}: {{ 'common.all' | t }}</option>
              <option value="me">{{ 'tasks.mine' | t }}</option>
              @for (m of members.members(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }
            </select>
            <label class="check small"><input type="checkbox" [(ngModel)]="overdue" (ngModelChange)="reload()" /> {{ 'tasks.overdue' | t }}</label>
          </div>
          @for (task of page()?.data ?? []; track task.id) {
            <div class="row" style="padding:12px 16px;border-bottom:1px solid var(--border)">
              <input type="checkbox" [checked]="task.status === 'done'" [disabled]="!auth.canWrite()" (change)="toggle(task)" [attr.aria-label]="'tasks.markDone' | t" />
              <span class="dot" [class]="'dot ' + task.priority" [title]="'tasks.priorities.' + task.priority | t"></span>
              <div class="spacer" style="cursor:pointer;min-width:0" (click)="editTask.set(task)">
                <div class="cell-title truncate" [style.text-decoration]="task.status === 'done' ? 'line-through' : null">{{ task.title }}</div>
                <div class="cell-sub row wrap">
                  @if (task.client) { <a [routerLink]="['/clients', task.client.id]" (click)="$event.stopPropagation()">{{ task.client.name }}</a> }
                  @if (task.lead) { <a [routerLink]="['/leads', task.lead.id]" (click)="$event.stopPropagation()">{{ task.lead.name }}</a> }
                  @if (task.deal) { <span>{{ task.deal.title }}</span> }
                  @if (task.assignee) { <span>· {{ task.assignee.name }}</span> }
                </div>
              </div>
              @if (task.status === 'in_progress') { <span class="badge info">{{ 'tasks.statuses.in_progress' | t }}</span> }
              <span class="badge nowrap" [class.danger]="task.is_overdue">{{ task.due_at ? (task.due_at | dt) : ('tasks.noDue' | t) }}</span>
            </div>
          } @empty {
            @if (search || priority || assignee || overdue || status !== 'open') {
              <app-empty-state illustration="search" [title]="'empty.noResultsTitle' | t" [text]="'empty.noResultsText' | t" />
            } @else {
              <app-empty-state illustration="tasks" [title]="'empty.tasksTitle' | t" [text]="'empty.tasksText' | t" />
            }
          }
          <app-pagination [meta]="page()?.meta ?? null" (page)="goTo($event)" (perPage)="perPage = $event; reload()" />
        </div>
      } @else {
        <div class="card">
          <div class="toolbar">
            <button class="btn sm icon" (click)="shift(-1)" aria-label="Previous"><app-icon name="chevronLeft" /></button>
            <button class="btn sm" (click)="goToday()">{{ 'common.today' | t }}</button>
            <button class="btn sm icon" (click)="shift(1)" aria-label="Next"><app-icon name="chevronRight" /></button>
            <h2 style="margin-left:8px">{{ title() }}</h2>
            <span class="spacer"></span>
            <div class="segmented">
              @for (m of modes; track m) { <button [class.active]="mode() === m" (click)="setMode(m)">{{ 'tasks.' + m | t }}</button> }
            </div>
          </div>
          @if (mode() === 'day') {
            <div class="card-body stack">
              @for (task of tasksOn(dayKeyOf(cursor())); track task.id) {
                <div class="row" style="cursor:pointer" (click)="editTask.set(task)">
                  <span class="badge nowrap">{{ task.due_at | dt: 'time' }}</span>
                  <span class="dot" [class]="'dot ' + task.priority"></span>
                  <span [style.text-decoration]="task.status === 'done' ? 'line-through' : null">{{ task.title }}</span>
                  <span class="subtle">{{ task.client?.name ?? task.lead?.name ?? '' }}</span>
                </div>
              } @empty { <app-empty-state illustration="tasks" [compact]="true" [title]="'empty.tasksTitle' | t" /> }
            </div>
          } @else {
            <div class="calendar">
              @for (d of weekdays(); track $index) { <div class="head">{{ d }}</div> }
              @for (day of days(); track day.key) {
                <div class="day" [class.other]="!day.inMonth" [class.today]="day.today" [style.min-height.px]="mode() === 'week' ? 360 : 110"
                     (dblclick)="auth.canWrite() && newTask.set({ due_at: atNine(day.date) })">
                  <span class="num">{{ day.date.getDate() }}</span>
                  @for (task of tasksOn(day.key); track task.id) {
                    <div class="cal-task" [class]="'cal-task ' + task.priority" [class.done]="task.status === 'done'" [class.overdue]="task.is_overdue" (click)="editTask.set(task)" [title]="task.title">
                      {{ task.due_at | dt: 'time' }} {{ task.title }}
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (newTask(); as ctx) { <app-task-form-modal [context]="ctx" (closed)="newTask.set(null)" (saved)="newTask.set(null); refresh()" /> }
    @if (editTask(); as task) { <app-task-form-modal [task]="task" (closed)="editTask.set(null)" (saved)="editTask.set(null); refresh()" /> }
  `,
})
export class TasksPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly members = inject(MembersService);

  protected readonly priorities = ['low', 'normal', 'high', 'urgent'];
  protected readonly modes: CalendarMode[] = ['month', 'week', 'day'];
  protected readonly view = signal<'list' | 'calendar'>((storage.get('uf.tasks.view') as 'list' | 'calendar') || 'list');
  protected readonly mode = signal<CalendarMode>('month');
  protected readonly cursor = signal(new Date());
  protected readonly page = signal<Paginated<Task> | null>(null);
  protected readonly calendarTasks = signal<Task[]>([]);
  protected readonly newTask = signal<{ due_at?: string } | null>(null);
  protected readonly editTask = signal<Task | null>(null);
  protected readonly search$ = new Subject<void>();

  protected search = '';
  protected status = 'open';
  protected priority = '';
  protected assignee = '';
  protected overdue = false;
  protected perPage = 25;
  private current = 1;

  protected readonly weekdays = computed(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(this.i18n.intlLocale(), { weekday: 'short' }).format(new Date(monday.getTime() + i * 86400000)));
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const cursor = this.cursor();
    const todayKey = dayKey(new Date());
    let start: Date;
    let count: number;
    if (this.mode() === 'week') {
      start = this.startOfWeek(cursor);
      count = 7;
    } else {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      start = this.startOfWeek(first);
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      count = Math.max(35, Math.ceil((Math.round((last.getTime() - start.getTime()) / 86400000) + 1) / 7) * 7);
    }
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date, key: dayKey(date), inMonth: this.mode() === 'week' || date.getMonth() === cursor.getMonth(), today: dayKey(date) === todayKey };
    });
  });

  protected readonly title = computed(() => {
    const cursor = this.cursor();
    const locale = this.i18n.intlLocale();
    if (this.mode() === 'day') {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(cursor);
    }
    if (this.mode() === 'week') {
      const days = this.days();
      return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(days[0].date)} – ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(days[6].date)}`;
    }
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cursor);
  });

  private readonly byDay = computed(() => {
    const map = new Map<string, Task[]>();
    for (const task of this.calendarTasks()) {
      if (task.due_at) {
        const key = dayKey(new Date(task.due_at));
        map.set(key, [...(map.get(key) ?? []), task]);
      }
    }
    return map;
  });

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
  }

  ngOnInit(): void {
    this.members.load();
    this.refresh();
  }

  setView(view: 'list' | 'calendar'): void {
    this.view.set(view);
    storage.set('uf.tasks.view', view);
    this.refresh();
  }

  setMode(mode: CalendarMode): void {
    this.mode.set(mode);
    this.loadCalendar();
  }

  refresh(): void {
    if (this.view() === 'list') {
      this.fetch();
    } else {
      this.loadCalendar();
    }
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
      .get<Paginated<Task>>('tasks', { search: this.search, status: this.status, priority: this.priority, assignee_id: this.assignee, overdue: this.overdue ? 1 : '', page: this.current, per_page: this.perPage })
      .subscribe((res) => this.page.set(res));
  }

  loadCalendar(): void {
    let from: Date;
    let to: Date;
    if (this.mode() === 'day') {
      from = new Date(this.cursor().getFullYear(), this.cursor().getMonth(), this.cursor().getDate());
      to = new Date(from.getTime() + 86400000 - 1);
    } else {
      const days = this.days();
      from = days[0].date;
      to = new Date(days[days.length - 1].date.getTime() + 86400000 - 1);
    }
    this.api.get<{ data: Task[] }>('tasks', { from: from.toISOString(), to: to.toISOString() }).subscribe((res) => this.calendarTasks.set(res.data));
  }

  tasksOn(key: string): Task[] {
    return this.byDay().get(key) ?? [];
  }

  dayKeyOf(date: Date): string {
    return dayKey(date);
  }

  shift(direction: number): void {
    const c = this.cursor();
    const next = this.mode() === 'month'
      ? new Date(c.getFullYear(), c.getMonth() + direction, 1)
      : new Date(c.getFullYear(), c.getMonth(), c.getDate() + direction * (this.mode() === 'week' ? 7 : 1));
    this.cursor.set(next);
    this.loadCalendar();
  }

  goToday(): void {
    this.cursor.set(new Date());
    this.loadCalendar();
  }

  atNine(date: Date): string {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString();
  }

  toggle(task: Task): void {
    this.api.patch(`tasks/${task.id}`, { status: task.status === 'done' ? 'open' : 'done' }).subscribe(() => this.fetch());
  }

  private startOfWeek(date: Date): Date {
    const day = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  }
}
