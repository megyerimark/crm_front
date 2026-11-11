import { TranslatePipe } from '../core/i18n/t.pipe';
import { DatePipe, InitialsPipe, MoneyPipe, NumberPipe } from './format.pipes';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';
import { PaginationComponent } from './pagination.component';

/** Common imports for feature components. */
export const UI = [TranslatePipe, DatePipe, MoneyPipe, NumberPipe, InitialsPipe, IconComponent, ModalComponent, PaginationComponent] as const;

export function leadStatusClass(status: string): string {
  return { new: 'primary', contacted: 'info', qualified: 'success', unqualified: '', converted: 'gold' }[status] ?? '';
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
