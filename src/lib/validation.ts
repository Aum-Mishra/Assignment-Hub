import { FileValidationResult } from '../types/assignment';

// Maximum upload size in MB (default: 25MB)
const envMaxSizeMb = import.meta.env.VITE_MAX_FILE_SIZE_MB;
export const MAX_FILE_SIZE_MB = envMaxSizeMb ? parseInt(envMaxSizeMb, 10) : 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Formats a byte number into a human-readable string (e.g., 2.4 MB).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm))} ${sizes[unitIndex]}`;
}

/**
 * Validates assignment title:
 * - Must be present
 * - 1 to 150 characters after trimming
 */
export function validateTitle(title: string): FileValidationResult {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Assignment title is required.' };
  }
  if (trimmed.length > 150) {
    return {
      valid: false,
      error: `Assignment title cannot exceed 150 characters (currently ${trimmed.length} characters).`,
    };
  }
  return { valid: true };
}

/**
 * Validates uploaded ZIP file:
 * - File must exist and not be empty
 * - Must have .zip extension
 * - Must not exceed configured maximum file size
 * - Performs ZIP signature / magic bytes validation (PK header)
 *
 * NOTE ON SECURITY BOUNDARY:
 * Client-side validation improves user experience by catching mistakes early
 * and saves network bandwidth. However, client-side validation is NOT a security
 * boundary against malicious actors who can bypass browser checks. Complete archive
 * validation, decompression safety, and malware scanning would require a trusted
 * backend component.
 */
export async function validateZipFile(
  file: File | null | undefined,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): Promise<FileValidationResult> {
  if (!file) {
    return { valid: false, error: 'Please select a ZIP file to upload.' };
  }

  // 1. Check file size
  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty (0 bytes).' };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) exceeds the maximum limit of ${formatBytes(maxSizeBytes)}.`,
    };
  }

  // 2. Check filename extension
  const fileNameLower = file.name.toLowerCase();
  if (!fileNameLower.endsWith('.zip')) {
    return { valid: false, error: 'Invalid file type. Only .zip archives are allowed.' };
  }

  // 3. Inspect ZIP magic bytes (header signature)
  try {
    const slice = file.slice(0, 4);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Standard ZIP signature starts with 'PK' (0x50, 0x4B):
    // - 0x50, 0x4B, 0x03, 0x04 : Standard local file header
    // - 0x50, 0x4B, 0x05, 0x06 : Empty zip (end of central directory)
    // - 0x50, 0x4B, 0x07, 0x08 : Spanned / split archive header
    const isPK = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isValidZipSignature =
      isPK &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08));

    if (!isValidZipSignature) {
      return {
        valid: false,
        error: 'The selected file does not appear to be a valid ZIP archive (invalid header signature).',
      };
    }
  } catch (err) {
    // If reading slice fails
    return {
      valid: false,
      error: 'Failed to inspect file contents. Please ensure the file is accessible.',
    };
  }

  return { valid: true };
}
