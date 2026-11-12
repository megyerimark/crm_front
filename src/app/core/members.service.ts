import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Member } from './models';

/** Cached member list of the current workspace (owner / assignee selects). */
@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly members = signal<Member[]>([]);
  private loadedFor: number | null = null;

  load(force = false): void {
    const id = this.auth.workspaceId();
    if (!id || (!force && this.loadedFor === id)) {
      return;
    }
    this.loadedFor = id;
    this.api.get<{ data: Member[] }>('team/members').subscribe((res) => this.members.set(res.data));
  }
}
