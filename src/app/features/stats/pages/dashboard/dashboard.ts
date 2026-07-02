import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PuzzleStore } from '../../../../core/store/puzzle.store';
import { StorageService } from '../../../../core/services/storage.service';
import { isBackup } from '../../../../core/models/backup.model';

/** Progression dashboard — solved totals, accuracy and recent attempts. */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly store = inject(PuzzleStore);
  private readonly storage = inject(StorageService);

  protected readonly solvedCount = this.store.solvedCount;
  protected readonly totalAttempts = this.store.totalAttempts;
  protected readonly accuracyPct = this.store.accuracyPct;
  protected readonly bestStreak = this.store.bestStreak;
  protected readonly backupMessage = signal<string | null>(null);

  /** Ten most recent attempts, newest first. */
  protected readonly recent = computed(() =>
    [...this.store.attemptEntities()]
      .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
      .slice(0, 10),
  );

  constructor() {
    void this.store.hydrate();
  }

  /** Download every local store as a single JSON file. */
  protected async exportData(): Promise<void> {
    const backup = await this.storage.exportAll();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-mentor-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.backupMessage.set('Sauvegarde téléchargée ✓');
  }

  /** Restore a backup file — REPLACES all local data. */
  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      this.backupMessage.set('Fichier illisible — ce n’est pas un JSON valide.');
      return;
    }
    if (!isBackup(parsed)) {
      this.backupMessage.set('Ce fichier n’est pas une sauvegarde ChessMentor.');
      return;
    }
    if (!globalThis.confirm('Remplacer toutes les données locales par cette sauvegarde ?')) {
      return;
    }

    await this.storage.importAll(parsed);
    this.backupMessage.set('Données restaurées ✓ — rechargement…');
    // Every page holds hydrated copies: a reload is the honest refresh.
    globalThis.location.reload();
  }
}
