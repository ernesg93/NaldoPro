import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Named constants (magic-value free)
// ---------------------------------------------------------------------------

/** Timeout for Tier 1 Cloudinary image fetch (milliseconds). */
const TIER1_FETCH_TIMEOUT_MS = 8000;

/** Maximum file size accepted for Tier 1 file share (bytes). */
const TIER1_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Timeout for Tier 3 image download fetch (milliseconds). */
const IMAGE_DOWNLOAD_TIMEOUT_MS = 8000;

/** Delay before revoking the download blob URL (gives browser time to start). */
const REVOKE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SharePublicationInput = {
  text: string;
  imageUrl: string;
  title?: string;
  fileName?: string;
};

export type ShareResult =
  | { status: 'shared'; channel: 'file-native' | 'native' }
  | { status: 'fallback-shared'; copied: boolean; imageAction: 'downloaded' | 'opened' | 'failed' }
  | { status: 'canceled' }
  | { status: 'failed'; reason: string };

// ---------------------------------------------------------------------------
// Cancel classification
// ---------------------------------------------------------------------------
//
// Two patterns are classified as user-cancel:
// 1. AbortError — always a user-cancel or explicit abort (e.g. timeout).
// 2. NotAllowedError with specific genuine-cancel messages:
//    - "share canceled" / "share cancelled" — Safari/WebKit user cancel.
//
// The "current context" NotAllowedError is deliberately excluded from cancel
// classification. It fires when the user gesture is lost after an async
// operation (e.g. Tier 1 file fetch). This is NOT a user cancellation — the
// app SHOULD fall through to Tier 2/Tier 3 fallback so the user still gets
// useful behavior (text copy + image access despite the lost activation).
// Non-cancel NotAllowedError messages (e.g. "disabled by policy") also
// PROCEED to fallback because they represent a real failure, not user intent.
// ---------------------------------------------------------------------------

const CANCEL_NOT_ALLOWED_MESSAGES = [
  'share canceled',
  'share cancelled',
  // NOTE: "current context" is deliberately excluded. It fires when the user
  // gesture is lost after an async operation (e.g. Tier 1 file fetch). That
  // is NOT a user cancellation — the app should fall through to Tier 2/Tier 3
  // fallback instead of stopping the chain.
];

export function isUserCancel(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    const msg = (error.message ?? '').toLowerCase();
    return CANCEL_NOT_ALLOWED_MESSAGES.some((m) => msg.includes(m));
  }
  return false;
}

// ---------------------------------------------------------------------------
// URL safety guard
// ---------------------------------------------------------------------------

export function isSafeImageUrl(url: string): boolean {
  // Reject empty, nullish, or non-string values
  if (!url || typeof url !== 'string') return false;
  // Allow only HTTPS URLs. This rejects http:, data:, javascript:,
  // file:, blob:, and any other non-HTTPS scheme.
  return url.startsWith('https://');
}

// ---------------------------------------------------------------------------
// Browser API adapters (testable via mock)
// ---------------------------------------------------------------------------

async function tryNativeShare(
  text: string,
  url: string,
): Promise<'shared' | 'canceled' | null> {
  if (!isSafeImageUrl(url)) return null;
  if (typeof navigator.share !== 'function') {
    return null; // unsupported → proceed to fallback
  }
  try {
    await navigator.share({ text, url });
    return 'shared';
  } catch (err) {
    if (isUserCancel(err)) return 'canceled';
    // Real failure — proceed to fallback
    console.warn('[useWebShare] tryNativeShare failed (non-cancel):', err);
    dispatchShareError('tryNativeShare', err);
    return null;
  }
}

async function tryClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('[useWebShare] tryClipboard failed:', err);
    dispatchShareError('tryClipboard', err);
    return false;
  }
}

async function tryImageDownload(
  imageUrl: string,
  timeoutMs: number = IMAGE_DOWNLOAD_TIMEOUT_MS,
): Promise<'downloaded' | 'opened' | 'failed'> {
  if (!isSafeImageUrl(imageUrl)) {
    return 'failed';
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) throw new Error('fetch not ok');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = imageUrl.split('/').pop() ?? 'image.png';
    anchor.click();
    // Delay revoke so the browser has time to start the download.
    // Guard against jsdom environments where revokeObjectURL may not exist.
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(blobUrl);
    }, REVOKE_DELAY_MS);
    return 'downloaded';
  } catch (err) {
    // fetch/download failed → try opening in new tab
    clearTimeout(timeoutId);
    console.warn('[useWebShare] tryImageDownload failed:', err);
    dispatchShareError('tryImageDownload', err);
    return tryOpenImage(imageUrl);
  }
}

async function tryOpenImage(imageUrl: string): Promise<'opened' | 'failed'> {
  if (!isSafeImageUrl(imageUrl)) {
    return 'failed';
  }
  try {
    const win = window.open(imageUrl, '_blank', 'noopener,noreferrer');
    if (!win) throw new Error('window.open returned null');
    return 'opened';
  } catch (err) {
    console.warn('[useWebShare] tryOpenImage failed:', err);
    dispatchShareError('tryOpenImage', err);
    return 'failed';
  }
}

// ---------------------------------------------------------------------------
// Tier 1 helpers — Web Share Level 2 (file + text/title)
// ---------------------------------------------------------------------------

export type CreateImageFileOptions = {
  signal?: AbortSignal;
  maxBytes?: number;
  fileName?: string;
};

export async function createImageFile(
  imageUrl: string,
  options?: CreateImageFileOptions,
): Promise<File | null> {
  if (!isSafeImageUrl(imageUrl)) return null;
  try {
    const response = await fetch(imageUrl, { signal: options?.signal });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    if (options?.maxBytes !== undefined && blob.size > options.maxBytes) {
      return null;
    }
    const fileName = options?.fileName ?? imageUrl.split('/').pop() ?? 'image.png';
    return new File([blob], fileName, { type: blob.type });
  } catch (err) {
    console.warn('[useWebShare] createImageFile failed:', err);
    dispatchShareError('createImageFile', err);
    return null;
  }
}

export async function tryFileShare(
  file: File,
  text: string,
  title?: string,
): Promise<'shared' | 'canceled' | null> {
  if (typeof navigator.canShare !== 'function') return null;
  if (!navigator.canShare({ files: [file] })) return null;
  try {
    const shareData: { files: File[]; text: string; title?: string } = {
      files: [file],
      text,
    };
    if (title) shareData.title = title;
    await navigator.share(shareData);
    return 'shared';
  } catch (err) {
    if (isUserCancel(err)) return 'canceled';
    // Non-fatal failure → proceed to Tier 2
    console.warn('[useWebShare] tryFileShare failed (non-cancel):', err);
    dispatchShareError('tryFileShare', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure helper — the complete share orchestration
// ---------------------------------------------------------------------------

export async function sharePublication(
  input: SharePublicationInput,
): Promise<ShareResult> {
  const { text, imageUrl, title, fileName } = input;

  // Tier 1: File share (Web Share Level 2)
  if (typeof navigator.canShare === 'function') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIER1_FETCH_TIMEOUT_MS);
    try {
      const file = await createImageFile(imageUrl, {
        signal: controller.signal,
        fileName,
        maxBytes: TIER1_MAX_IMAGE_BYTES,
      });
      if (file) {
        const fileResult = await tryFileShare(file, text, title);
        if (fileResult === 'shared') {
          return { status: 'shared', channel: 'file-native' };
        }
        if (fileResult === 'canceled') {
          return { status: 'canceled' };
        }
        // null → continue to Tier 2
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Tier 2: Try native text+URL share
  const nativeResult = await tryNativeShare(text, imageUrl);
  if (nativeResult === 'shared') {
    return { status: 'shared', channel: 'native' };
  }
  if (nativeResult === 'canceled') {
    return { status: 'canceled' };
  }

  // Tier 3: Fallback clipboard + image download/open
  const copied = await tryClipboard(text);
  const imageAction = await tryImageDownload(imageUrl);

  // If both fallback actions failed, nothing useful happened → report as failed
  if (!copied && imageAction === 'failed') {
    dispatchShareError('sharePublication', new Error('All fallbacks failed'));
    return {
      status: 'failed',
      reason: 'No se pudo copiar el texto ni acceder a la imagen.',
    };
  }

  return {
    status: 'fallback-shared',
    copied,
    imageAction,
  };
}

// ---------------------------------------------------------------------------
// Observability — dispatch naldopro:share-error CustomEvent on document
// ---------------------------------------------------------------------------

function dispatchShareError(context: string, error: unknown): void {
  document.dispatchEvent(
    new CustomEvent('naldopro:share-error', {
      detail: {
        context,
        error: error instanceof Error ? error.message : String(error),
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// React hook — wraps sharePublication with loading/result state
// ---------------------------------------------------------------------------

export function useWebShare() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);

  const share = useCallback(async (input: SharePublicationInput) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await sharePublication(input);
      setResult(res);
      return res;
    } catch (err) {
      const failed: ShareResult = {
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      };
      setResult(failed);
      return failed;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setLoading(false);
  }, []);

  return { share, loading, result, reset };
}
