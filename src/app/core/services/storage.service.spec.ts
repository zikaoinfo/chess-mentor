import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { PuzzleAttempt } from '../models/puzzle.model';

function attempt(id: string, correct: boolean): PuzzleAttempt {
  return { puzzleId: id, solvedAt: new Date(), attempts: 1, timeMs: 1000, correct };
}

describe('StorageService (in-memory fallback under jsdom)', () => {
  let service: StorageService;

  beforeEach(async () => {
    service = TestBed.inject(StorageService);
    await service.clear();
  });

  it('starts empty', async () => {
    expect(await service.allAttempts()).toEqual([]);
  });

  it('saves and reads back attempts', async () => {
    await service.saveAttempt(attempt('abc', true));
    await service.saveAttempt(attempt('def', false));
    const all = await service.allAttempts();
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.puzzleId)).toEqual(expect.arrayContaining(['abc', 'def']));
  });

  it('clears stored attempts', async () => {
    await service.saveAttempt(attempt('abc', true));
    await service.clear();
    expect(await service.allAttempts()).toEqual([]);
  });

  it('records friends, dedups by lowercased name, counts games, sorts by recency', async () => {
    await service.recordFriend('Rival', new Date('2026-01-01'));
    await service.recordFriend('rival', new Date('2026-02-01')); // même joueur, casse ≠
    await service.recordFriend('Autre', new Date('2026-03-01'));

    const friends = await service.allFriends();
    expect(friends).toHaveLength(2);
    // Trié par dernière partie décroissante : Autre (mars) avant rival (février).
    expect(friends.map((f) => f.name)).toEqual(['Autre', 'rival']);

    const rival = friends.find((f) => f.id === 'rival');
    expect(rival?.games).toBe(2); // deux parties fusionnées
    expect(rival?.name).toBe('rival'); // dernière casse vue

    await service.removeFriend('rival');
    expect((await service.allFriends()).map((f) => f.id)).toEqual(['autre']);
  });

  it('ignores a blank friend name', async () => {
    await service.recordFriend('   ');
    expect(await service.allFriends()).toEqual([]);
  });
});
