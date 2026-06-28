import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SoundService } from './core/services/sound.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly sound = inject(SoundService);

  protected readonly title = 'ChessMentor';
  protected readonly muted = this.sound.muted;

  protected toggleSound(): void {
    this.sound.toggleMute();
  }
}
