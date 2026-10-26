import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateZipFile,
  formatBytes,
  MAX_FILE_SIZE_BYTES,
} from '../validation';

describe('formatBytes', () => {
  it('formats zero bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-10)).toBe('0 B');
  });

  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(26214400)).toBe('25 MB');
  });
});

describe('validateTitle', () => {
  it('rejects empty and whitespace-only titles', () => {
    expect(validateTitle('')).toEqual({
      valid: false,
      error: 'Assignment title is required.',
    });
    expect(validateTitle('   \t\n  ')).toEqual({
      valid: false,
      error: 'Assignment title is required.',
    });
  });

  it('rejects titles longer than 150 characters', () => {
    const longTitle = 'A'.repeat(151);
    const result = validateTitle(longTitle);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot exceed 150 characters');
  });

  it('accepts valid titles within 1 to 150 characters', () => {
    expect(validateTitle('Computer Networks Lab 1').valid).toBe(true);
    expect(validateTitle('   Operating Systems Homework 4   ').valid).toBe(true);
    expect(validateTitle('B'.repeat(150)).valid).toBe(true);
  });
});

describe('validateZipFile', () => {
  it('rejects missing or undefined files', async () => {
    const result = await validateZipFile(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please select a ZIP file to upload.');
  });

  it('rejects empty files (0 bytes)', async () => {
    const emptyFile = new File([], 'assignment.zip', { type: 'application/zip' });
    const result = await validateZipFile(emptyFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty (0 bytes)');
  });

  it('rejects files exceeding maximum file size', async () => {
    // Fake file size exceeding 25MB
    const largeFile = new File(['mock content'], 'large.zip', { type: 'application/zip' });
    Object.defineProperty(largeFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1024 });

    const result = await validateZipFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds the maximum limit');
  });

  it('rejects files without .zip extension', async () => {
    const txtFile = new File(['hello'], 'document.pdf', { type: 'application/pdf' });
    const result = await validateZipFile(txtFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Only .zip archives are allowed');
  });

  it('rejects non-ZIP files disguised as .zip (magic bytes check)', async () => {
    // File named .zip but starting with 'RIFF' or plain ASCII text
    const fakeZip = new File(['THIS IS NOT A ZIP'], 'fake.zip', {
      type: 'application/zip',
    });
    const result = await validateZipFile(fakeZip);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid header signature');
  });

  it('accepts files with valid ZIP header magic bytes (PK\\x03\\x04)', async () => {
    // Standard ZIP signature: 0x50, 0x4B, 0x03, 0x04
    const validZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const validZip = new File([validZipHeader], 'assignment_solution.zip', {
      type: 'application/zip',
    });
    const result = await validateZipFile(validZip);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts empty ZIP header magic bytes (PK\\x05\\x06)', async () => {
    // Empty zip signature: 0x50, 0x4B, 0x05, 0x06
    const emptyZipHeader = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]);
    const validZip = new File([emptyZipHeader], 'empty_archive.zip', {
      type: 'application/zip',
    });
    const result = await validateZipFile(validZip);
    expect(result.valid).toBe(true);
  });
});

