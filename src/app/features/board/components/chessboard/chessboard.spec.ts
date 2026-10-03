import { TestBed } from '@angular/core/testing';
import { Chessboard } from './chessboard';

/** White pawn on e7 ready to promote; kings far apart. */
const PROMO_FEN = '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1';

function pressEnter(el: Element): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('Chessboard — promotion', () => {
  async function setup(fen: string) {
    await TestBed.configureTestingModule({ imports: [Chessboard] }).compileComponents();
    const fixture = TestBed.createComponent(Chessboard);
    fixture.componentRef.setInput('fen', fen);
    await fixture.whenStable();
    const emitted: string[] = [];
    fixture.componentInstance.move.subscribe((uci) => emitted.push(uci));
    const square = (name: string): Element => {
      const el = fixture.nativeElement.querySelector(`[aria-label="${name}"]`);
      if (!el) throw new Error(`square ${name} not found`);
      return el;
    };
    return { fixture, emitted, square };
  }

  it('holds a promoting move until a piece is chosen, then emits the full UCI', async () => {
    const { fixture, emitted, square } = await setup(PROMO_FEN);

    pressEnter(square('e7'));
    await fixture.whenStable();
    pressEnter(square('e8'));
    await fixture.whenStable();

    // No move yet — the picker is open instead.
    expect(emitted).toEqual([]);
    const buttons = fixture.nativeElement.querySelectorAll('.promo__btn');
    expect(buttons.length).toBe(4);

    (buttons[1] as HTMLButtonElement).click(); // q, r, b, n → index 1 = rook
    await fixture.whenStable();
    expect(emitted).toEqual(['e7e8r']);
    expect(fixture.nativeElement.querySelector('.promo')).toBeNull();
  });

  it('cancelling the picker emits nothing and closes it', async () => {
    const { fixture, emitted, square } = await setup(PROMO_FEN);

    pressEnter(square('e7'));
    await fixture.whenStable();
    pressEnter(square('e8'));
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.promo__cancel') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.querySelector('.promo')).toBeNull();
  });

  it('emits non-promoting moves immediately (no picker)', async () => {
    const { fixture, emitted, square } = await setup(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );

    pressEnter(square('e2'));
    await fixture.whenStable();
    pressEnter(square('e4'));
    await fixture.whenStable();
    expect(emitted).toEqual(['e2e4']);
    expect(fixture.nativeElement.querySelector('.promo')).toBeNull();
  });
  it('offers named promotion choices to screen reader users', async () => {
    const { fixture, square } = await setup(PROMO_FEN);
    pressEnter(square('e7'));
    await fixture.whenStable();
    pressEnter(square('e8'));
    await fixture.whenStable();
    expect(
      [...fixture.nativeElement.querySelectorAll('.promo__btn')].map((el: any) =>
        el.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Promouvoir en dame',
      'Promouvoir en tour',
      'Promouvoir en fou',
      'Promouvoir en cavalier',
    ]);
  });

  it.each([
    ['white', '25px'],
    ['black', '-25px'],
  ])('animates the arrival from the correct direction for %s', async (orientation, offset) => {
    const { fixture, square } = await setup('4k3/8/8/8/4P3/8/8/4K3 b - - 0 1');
    fixture.componentRef.setInput('orientation', orientation);
    fixture.componentRef.setInput('lastMove', 'e2e4');
    await fixture.whenStable();
    const piece = fixture.nativeElement.querySelector('.piece[data-square="e4"]') as SVGElement;
    expect(piece.style.getPropertyValue('--travel-y')).toBe(offset);
    expect(piece.style.getPropertyValue('--travel-x')).toBe('0px');
    expect(
      (
        fixture.nativeElement.querySelector('.piece[data-square="e1"]') as SVGElement
      ).style.getPropertyValue('--travel-y'),
    ).toBe('0px');
  });
});
