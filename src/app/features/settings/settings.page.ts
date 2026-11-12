import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-settings-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header"><h1>{{ 'settings.title' | t }}</h1></div>
      <div class="tabs">
        <a routerLink="profile" routerLinkActive="active">{{ 'settings.profile' | t }}</a>
        @if (auth.isAdmin()) { <a routerLink="workspace" routerLinkActive="active">{{ 'settings.workspace' | t }}</a> }
        <a routerLink="subscription" routerLinkActive="active">{{ 'settings.subscription' | t }}</a>
        <a routerLink="pipelines" routerLinkActive="active">{{ 'settings.pipelines' | t }}</a>
        <a routerLink="automations" routerLinkActive="active">{{ 'settings.automations' | t }}</a>
        <a routerLink="custom-fields" routerLinkActive="active">{{ 'settings.customFields' | t }}</a>
        @if (auth.isAdmin()) { <a routerLink="audit" routerLinkActive="active">{{ 'settings.audit' | t }}</a> }
      </div>
      <router-outlet />
    </div>
  `,
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
}
