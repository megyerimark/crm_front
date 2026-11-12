import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { I18nService } from './i18n/i18n.service';
import { ToastService } from './toast.service';

/** Adds bearer token, workspace and locale headers to API requests and handles common errors. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const i18n = inject(I18nService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Locale': i18n.locale() };
  const token = auth.token();
  const workspaceId = auth.workspaceId();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (workspaceId && !req.url.includes('/public/')) {
    headers['X-Workspace-Id'] = String(workspaceId);
  }

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((error: HttpErrorResponse) => {
      const body = error.error && typeof error.error === 'object' ? error.error : {};
      if (req.url.includes('/public/')) {
        return throwError(() => error);
      }
      if (error.status === 403 && body.code === 'email_unverified') {
        void router.navigateByUrl('/verify-email');
      } else if (error.status === 401 && auth.isLoggedIn()) {
        auth.clear();
        void router.navigateByUrl('/login');
      } else if (error.status === 402) {
        toast.show(body.message || i18n.t('plan.limitReached'), 'upgrade', 7000);
      } else if (error.status === 403 || error.status === 423 || error.status === 429) {
        toast.error(body.message || i18n.t('errors.forbidden'));
      } else if (error.status === 0 || error.status >= 500) {
        toast.error(i18n.t('errors.server'));
      }
      return throwError(() => error);
    }),
  );
};

/** First validation message per field from a Laravel 422 response. */
export function fieldErrors(error: unknown): Record<string, string> {
  const errors = (error as HttpErrorResponse)?.error?.errors as Record<string, string[]> | undefined;
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    result[key] = messages[0];
  }
  return result;
}

export function errorMessage(error: unknown, fallback: string): string {
  return (error as HttpErrorResponse)?.error?.message || fallback;
}
