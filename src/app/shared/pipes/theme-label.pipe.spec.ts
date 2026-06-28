import { ThemeLabelPipe } from './theme-label.pipe';

describe('ThemeLabelPipe', () => {
  const pipe = new ThemeLabelPipe();

  it('translates known themes to French', () => {
    expect(pipe.transform('fork')).toBe('Fourchette');
    expect(pipe.transform('mateIn2')).toBe('Mat en 2');
  });

  it('humanises unknown camelCase ids', () => {
    expect(pipe.transform('doubleCheck')).toBe('Double Check');
  });

  it('returns an empty string for nullish input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
