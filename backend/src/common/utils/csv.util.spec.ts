import { escapeCsvCell } from './csv.util';

describe('escapeCsvCell', () => {
  it('wraps plain text in double quotes', () => {
    expect(escapeCsvCell('Bremsscheibe')).toBe('"Bremsscheibe"');
  });

  it('renders null and undefined as an empty cell', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it('doubles embedded double quotes', () => {
    expect(escapeCsvCell('Schraube 1/2"')).toBe('"Schraube 1/2"""');
  });

  it('keeps separators and line breaks inside the quoted cell', () => {
    expect(escapeCsvCell('a;b\nc')).toBe('"a;b\nc"');
  });

  it.each(['=SUM(A1:A2)', '+cmd', '-2+3', '@SUM(1)', '\tTAB', '\rCR'])(
    'prefixes formula trigger %p with a single quote',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('neutralises formulas that also contain quotes', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it.each(['-3', '+1,5', '-0.25', '42'])('does not prefix numeric string %p', (value) => {
    expect(escapeCsvCell(value)).toBe(`"${value}"`);
  });

  it('does not prefix numbers', () => {
    expect(escapeCsvCell(-7)).toBe('"-7"');
    expect(escapeCsvCell(0)).toBe('"0"');
  });

  it('converts other types via String()', () => {
    expect(escapeCsvCell(true)).toBe('"true"');
  });
});
