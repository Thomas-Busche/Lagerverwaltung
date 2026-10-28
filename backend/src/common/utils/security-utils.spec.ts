import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EmailConfigDto, TestEmailDto } from '../../modules/email/dto/email.dto';
import { ArchiveBundleDto, CleanupOldLogsDto, LogRetentionDto } from '../../modules/logging/dto/logging-config.dto';
import { AddPurchaseOrderLineDto, UpdatePurchaseOrderLineDto } from '../../modules/purchasing/dto/purchase-order-line.dto';

import { buildContentDisposition, sanitizeFilename } from './content-disposition.util';
import { escapeCsvCell } from './csv.util';
import { escapeHtml } from './html.util';

const isValid = async <T extends object>(cls: new () => T, payload: object) =>
  (await validate(plainToInstance(cls, payload))).length === 0;

describe('escapeCsvCell', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('prefixes formula trigger %j', (value) => {
    expect(escapeCsvCell(value)).toBe(`"'${value}"`);
  });
  it('keeps numbers and plain numeric strings untouched', () => {
    expect(escapeCsvCell(-5)).toBe('"-5"');
    expect(escapeCsvCell('-3')).toBe('"-3"');
    expect(escapeCsvCell('+1,5')).toBe('"+1,5"');
  });
  it('doubles quotes and handles null', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell(null)).toBe('""');
  });
});

describe('escapeHtml', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<img src=x onerror="a">&\'')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#039;');
  });
});

describe('Content-Disposition helpers', () => {
  it('strips CRLF, quotes and path chars', () => {
    const header = buildContentDisposition('attachment', 'a"\r\nSet-Cookie: x=1/../b.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).not.toContain('/');
    expect(header.match(/"/g)).toHaveLength(2);
  });
  it('encodes unicode via filename*', () => {
    const header = buildContentDisposition('inline', 'Übersicht ä.pdf');
    expect(header).toContain('filename="_bersicht _.pdf"');
    expect(header).toContain("filename*=UTF-8''%C3%9Cbersicht%20%C3%A4.pdf");
  });
  it('falls back for empty names', () => {
    expect(sanitizeFilename('..', 'x')).toBe('x');
  });
});

describe('DTO validation', () => {
  it('rejects bad purchase line quantities', async () => {
    for (const quantity of [-1, 0, 1.5, 'abc', NaN, null, 99999999]) {
      expect(await isValid(UpdatePurchaseOrderLineDto, { quantity })).toBe(false);
    }
    expect(await isValid(AddPurchaseOrderLineDto, { itemId: 'i1', quantity: 3 })).toBe(true);
    expect(await isValid(AddPurchaseOrderLineDto, { quantity: 3 })).toBe(false);
  });
  it('validates logging DTOs', async () => {
    expect(await isValid(LogRetentionDto, { retentionDays: -4 })).toBe(false);
    expect(await isValid(LogRetentionDto, { retentionDays: 30 })).toBe(true);
    expect(await isValid(CleanupOldLogsDto, { daysToKeep: '5' })).toBe(false);
    expect(await isValid(CleanupOldLogsDto, {})).toBe(true);
    expect(await isValid(ArchiveBundleDto, { dates: ['../../etc'] })).toBe(false);
    expect(await isValid(ArchiveBundleDto, { dates: ['2026-10-01'] })).toBe(true);
  });
  it('validates email DTOs', async () => {
    expect(await isValid(TestEmailDto, { email: 'nope' })).toBe(false);
    expect(await isValid(TestEmailDto, { email: 'a@b.de' })).toBe(true);
    const cfg = { host: 'h', port: 587, secure: false, auth: { user: 'a@b.de', pass: 'x' }, from: 'a@b.de' };
    expect(await isValid(EmailConfigDto, cfg)).toBe(true);
    expect(await isValid(EmailConfigDto, { ...cfg, port: 70000 })).toBe(false);
    expect(await isValid(EmailConfigDto, { ...cfg, auth: { user: 'bad', pass: 'x' } })).toBe(false);
  });
});
