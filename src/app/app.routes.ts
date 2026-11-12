import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, sessionGuard, superAdminGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'welcome', loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage) },
  { path: 'pricing', redirectTo: 'welcome' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage) },
  { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage) },
  { path: 'verify-email', canActivate: [sessionGuard], loadComponent: () => import('./features/auth/verify-email.page').then((m) => m.VerifyEmailPage) },
  { path: 'verify-email/confirm', loadComponent: () => import('./features/auth/signed-link.page').then((m) => m.SignedLinkPage), data: { kind: 'verify' } },
  { path: 'confirm-email-change', loadComponent: () => import('./features/auth/signed-link.page').then((m) => m.SignedLinkPage), data: { kind: 'email-change' } },
  { path: 'invite/:token', loadComponent: () => import('./features/auth/invite.page').then((m) => m.InvitePage) },
  { path: 'f/:slug', loadComponent: () => import('./features/public-form/public-form.page').then((m) => m.PublicFormPage) },
  { path: 'onboarding', canActivate: [authGuard], loadComponent: () => import('./features/auth/onboarding.page').then((m) => m.OnboardingPage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'clients', loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage) },
      { path: 'clients/:id', loadComponent: () => import('./features/clients/client-detail.page').then((m) => m.ClientDetailPage) },
      { path: 'leads', loadComponent: () => import('./features/leads/leads.page').then((m) => m.LeadsPage) },
      { path: 'leads/:id', loadComponent: () => import('./features/leads/lead-detail.page').then((m) => m.LeadDetailPage) },
      { path: 'pipeline', loadComponent: () => import('./features/pipeline/pipeline.page').then((m) => m.PipelinePage) },
      { path: 'tasks', loadComponent: () => import('./features/tasks/tasks.page').then((m) => m.TasksPage) },
      { path: 'forms', loadComponent: () => import('./features/forms/forms.page').then((m) => m.FormsPage) },
      { path: 'forms/:id', loadComponent: () => import('./features/forms/form-editor.page').then((m) => m.FormEditorPage) },
      { path: 'imports', loadComponent: () => import('./features/imports/imports.page').then((m) => m.ImportsPage) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage) },
      { path: 'team', loadComponent: () => import('./features/team/team.page').then((m) => m.TeamPage) },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'profile' },
          { path: 'profile', loadComponent: () => import('./features/settings/profile.section').then((m) => m.ProfileSection) },
          { path: 'workspace', canActivate: [adminGuard], loadComponent: () => import('./features/settings/workspace.section').then((m) => m.WorkspaceSection) },
          { path: 'subscription', loadComponent: () => import('./features/settings/subscription.section').then((m) => m.SubscriptionSection) },
          { path: 'pipelines', loadComponent: () => import('./features/settings/pipelines.section').then((m) => m.PipelinesSection) },
          { path: 'automations', loadComponent: () => import('./features/settings/automations.section').then((m) => m.AutomationsSection) },
          { path: 'custom-fields', loadComponent: () => import('./features/settings/custom-fields.section').then((m) => m.CustomFieldsSection) },
          { path: 'audit', canActivate: [adminGuard], loadComponent: () => import('./features/settings/audit.section').then((m) => m.AuditSection) },
        ],
      },
      { path: 'admin', canActivate: [superAdminGuard], loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
