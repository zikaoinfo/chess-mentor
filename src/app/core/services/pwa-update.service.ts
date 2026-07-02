import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * Surfaces "a new deployed version is ready" as a signal. Without this,
 * installed users would stay pinned to a stale cached build after each
 * GitHub Pages deploy. `versionUpdates` only emits when the service worker
 * is enabled (production build), so dev mode simply never shows the toast.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);

  readonly updateReady = toSignal(
    this.swUpdate.isEnabled
      ? this.swUpdate.versionUpdates.pipe(
          filter((event) => event.type === 'VERSION_READY'),
          map(() => true),
        )
      : EMPTY,
    { initialValue: false },
  );

  reload(): void {
    document.location.reload();
  }
}
