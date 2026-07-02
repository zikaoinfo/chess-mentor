import { Injectable, signal } from '@angular/core';

/** Chromium-only event fired when the app becomes installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** True when running from the home screen (Android/desktop or iOS Safari). */
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/**
 * Install-prompt plumbing. On Chromium (`beforeinstallprompt`) the prompt is
 * captured and replayed via `install()`. Safari iOS never fires the event:
 * `showIosHint` flags that case so the UI can show the manual instruction
 * ("Partager → Sur l'écran d'accueil") instead of a button.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private readonly installable = signal(false);
  readonly canInstall = this.installable.asReadonly();

  /** Safari iOS not yet installed: no event exists, only manual install. */
  readonly showIosHint = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.installable.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.installable.set(false);
      this.showIosHint.set(false);
    });

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.showIosHint.set(isIos && !isStandalone());
  }

  /** Replay the captured browser prompt; resolves once the user chose. */
  async install(): Promise<void> {
    const prompt = this.deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    this.deferredPrompt = null;
    this.installable.set(false);
  }
}
