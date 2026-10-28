/** Reduces user-controlled text to a safe file name (no CR/LF, quotes, path chars). */
export function sanitizeFilename(name: string, fallback = 'download'): string {
  const cleaned = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\/:*?"<>|;]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
}

/** Builds an RFC 6266 Content-Disposition value (ASCII fallback + filename*). */
export function buildContentDisposition(
  disposition: 'attachment' | 'inline',
  filename: string,
): string {
  const safe = sanitizeFilename(filename);
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, '_').replace(/%/g, '_');
  const encoded = encodeURIComponent(safe).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
