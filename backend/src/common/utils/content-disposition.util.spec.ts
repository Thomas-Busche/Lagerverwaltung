import { buildContentDisposition, sanitizeFilename } from './content-disposition.util';

describe('sanitizeFilename', () => {
  it('keeps a regular file name unchanged', () => {
    expect(sanitizeFilename('inventur_2026-11-11.csv')).toBe('inventur_2026-11-11.csv');
  });

  it('replaces path separators, including backslashes', () => {
    expect(sanitizeFilename('../etc/passwd')).toBe('_etc_passwd');
    expect(sanitizeFilename('..\\windows\\system32')).toBe('_windows_system32');
    expect(sanitizeFilename('Lager\\Halle 2.pdf')).toBe('Lager_Halle 2.pdf');
  });

  it('replaces quotes and other reserved characters', () => {
    expect(sanitizeFilename('a"b:c*d?e<f>g|h;i')).toBe('a_b_c_d_e_f_g_h_i');
  });

  it('strips control characters such as CR/LF (header injection)', () => {
    expect(sanitizeFilename('report\r\nSet-Cookie: x=1.csv')).toBe('reportSet-Cookie_ x=1.csv');
  });

  it('removes leading dots so no hidden files are produced', () => {
    expect(sanitizeFilename('...hidden.txt')).toBe('hidden.txt');
  });

  it('limits the length to 150 characters', () => {
    expect(sanitizeFilename('a'.repeat(300))).toHaveLength(150);
  });

  it('falls back for empty or fully stripped input', () => {
    expect(sanitizeFilename('')).toBe('download');
    expect(sanitizeFilename('   ')).toBe('download');
    expect(sanitizeFilename('\r\n', 'export.csv')).toBe('export.csv');
    expect(sanitizeFilename(undefined as unknown as string)).toBe('download');
  });
});

describe('buildContentDisposition', () => {
  it('builds an attachment header with ASCII fallback and UTF-8 filename*', () => {
    expect(buildContentDisposition('attachment', 'bericht.pdf')).toBe(
      `attachment; filename="bericht.pdf"; filename*=UTF-8''bericht.pdf`,
    );
  });

  it('supports inline disposition', () => {
    expect(buildContentDisposition('inline', 'qr.png')).toMatch(/^inline; /);
  });

  it('replaces non-ASCII characters in the fallback and percent-encodes them in filename*', () => {
    expect(buildContentDisposition('attachment', 'Prüfprotokoll Öl.pdf')).toBe(
      `attachment; filename="Pr_fprotokoll _l.pdf"; filename*=UTF-8''Pr%C3%BCfprotokoll%20%C3%96l.pdf`,
    );
  });

  it('encodes characters that encodeURIComponent leaves untouched', () => {
    expect(buildContentDisposition('attachment', "it's (1)*.csv")).toContain(
      `filename*=UTF-8''it%27s%20%281%29_.csv`,
    );
  });

  it('never leaves a percent sign in the ASCII fallback', () => {
    expect(buildContentDisposition('attachment', '100%.csv')).toContain('filename="100_.csv"');
  });

  it('keeps the quoted filename intact for names with quotes or backslashes', () => {
    const header = buildContentDisposition('attachment', 'inventur_protokoll_Halle\\"A\\.pdf');
    const quoted = header.match(/filename="([^"]*)";/);
    expect(quoted?.[1]).toBe('inventur_protokoll_Halle__A_.pdf');
    expect(header).not.toContain('\\');
  });

  it('never contains CR/LF', () => {
    expect(buildContentDisposition('attachment', 'a\r\nb.csv')).not.toMatch(/[\r\n]/);
  });
});
