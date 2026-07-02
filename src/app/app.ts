import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SoundService } from './core/services/sound.service';
import { NetworkService } from './core/services/network.service';
import { PwaInstallService } from './core/services/pwa-install.service';
import { PwaUpdateService } from './core/services/pwa-update.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly sound = inject(SoundService);
  private readonly network = inject(NetworkService);
  private readonly pwaInstall = inject(PwaInstallService);
  private readonly pwaUpdate = inject(PwaUpdateService);

  protected readonly title = 'ChessMentor';
  protected readonly muted = this.sound.muted;

  protected readonly isOnline = this.network.isOnline;
  protected readonly updateReady = this.pwaUpdate.updateReady;
  protected readonly canInstall = this.pwaInstall.canInstall;
  protected readonly showIosHint = this.pwaInstall.showIosHint;
  /** The install banner is a one-shot suggestion — dismissable per session. */
  protected readonly installDismissed = signal(false);

  protected toggleSound(): void {
    this.sound.toggleMute();
  }

  protected installApp(): void {
    void this.pwaInstall.install();
  }

  protected dismissInstall(): void {
    this.installDismissed.set(true);
  }

  protected reloadForUpdate(): void {
    this.pwaUpdate.reload();
  }
}
