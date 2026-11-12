import { TranslatePipe } from '../core/i18n/t.pipe';
import { EmptyStateComponent } from './empty-state.component';
import { DatePipe, InitialsPipe, MoneyPipe, NumberPipe } from './format.pipes';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';
import { PaginationComponent } from './pagination.component';

/** Common imports for feature components. */
export const UI = [TranslatePipe, DatePipe, MoneyPipe, NumberPipe, InitialsPipe, IconComponent, ModalComponent, PaginationComponent, EmptyStateComponent] as const;

export function leadStatusClass(status: string): string {
  return { new: 'primary', contacted: 'info', qualified: 'success', unqualified: '', converted: 'solid' }[status] ?? '';
}

export function clientStatusClass(status: string): string {
  return { active: 'success', inactive: '', prospect: 'info' }[status] ?? '';
}

export function splitTags(value: string): string[] {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toLocalInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** IANA time zones offered in selects; always contains UTC and the values already stored. */
export function timezoneList(...current: (string | null | undefined)[]): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['Europe/Budapest', 'Europe/Vienna', 'Europe/Berlin'];
  return [...new Set([...current.filter((tz): tz is string => !!tz), 'UTC', ...supported])].sort();
}
