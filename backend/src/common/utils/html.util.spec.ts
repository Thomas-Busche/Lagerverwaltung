import { escapeHtml } from './html.util';

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#039;y&#039;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands only once per call', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Ölfilter 5W-30 äöü')).toBe('Ölfilter 5W-30 äöü');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts non-string values', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
