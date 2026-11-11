import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.ensureLoaded()) {
    if (!auth.workspaceId() && !state.url.startsWith('/onboarding') && !state.url.startsWith('/admin')) {
      return router.parseUrl('/onboarding');
    }
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: state.url !== '/' ? { redirect: state.url } : {} });
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  return (await auth.ensureLoaded()) ? inject(Router).parseUrl('/') : true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).parseUrl('/');
};

export const superAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.ensureLoaded();
  return auth.user()?.is_super_admin ? true : inject(Router).parseUrl('/');
};
