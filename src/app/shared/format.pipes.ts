import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n/i18n.service';

/** Dates are stored in UTC and shown in the user's (or workspace's) time zone. */
@Pipe({ name: 'dt', pure: false })
export class DatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  transform(value: string | null | undefined, mode: 'date' | 'datetime' | 'time' | 'relative' = 'datetime'): string {
    const tz = this.auth.timezone();
    switch (mode) {
      case 'date':
        return this.i18n.date(value, tz);
      case 'time':
        return this.i18n.date(value, tz, { timeStyle: 'short' });
      case 'relative':
        return this.i18n.relative(value);
      default:
        return this.i18n.dateTime(value, tz);
    }
  }
}

@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  transform(value: number | null | undefined, currency?: string): string {
    return this.i18n.money(value, currency || this.auth.currency());
  }
}

@Pipe({ name: 'num', pure: false })
export class NumberPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | null | undefined): string {
    return this.i18n.number(value);
  }
}

@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return (name ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
