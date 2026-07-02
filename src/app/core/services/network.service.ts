import { Injectable, signal } from '@angular/core';

/**
 * Online/offline state as a signal, fed by `navigator.onLine` and the
 * `online`/`offline` window events. Signal writes wake zoneless change
 * detection, so consumers just read `isOnline()` in their templates.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly online = signal(typeof navigator === 'undefined' || navigator.onLine);

  readonly isOnline = this.online.asReadonly();

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}
