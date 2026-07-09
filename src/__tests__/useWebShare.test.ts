// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers: mock browser APIs
// ---------------------------------------------------------------------------

function mockNavigatorShare() {
  // Exclude clipboard to prevent pollution from mockClipboardWrite() mutations
  // that are never rolled back by vi.unstubAllGlobals().
  const { clipboard: _clipboard, ...navRest } = navigator as unknown as Record<string, unknown>;
  vi.stubGlobal('navigator', {
    ...navRest,
    share: vi.fn(),
  } as unknown as Navigator & { share: typeof vi.fn });
}

function deleteNavigatorShare() {
  vi.stubGlobal('navigator', {
    ...navigator,
    share: undefined,
  });
}

function mockClipboardWrite() {
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: {
      writeText: vi.fn(),
    },
  });
}

function mockWindowOpen() {
  window.open = vi.fn() as unknown as typeof window.open;
}

function spyOnFetch() {
  return vi.spyOn(globalThis, 'fetch');
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/pub.png';
const SAMPLE_TEXT = 'Oferta especial — 50% descuento';

// ===========================================================================
// isUserCancel tests
// ===========================================================================

describe('isUserCancel()', () => {
  it('returns true for AbortError', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    expect(
      isUserCancel(new DOMException('share canceled', 'AbortError')),
    ).toBe(true);
  });

  it('returns false for NotAllowedError with "current context" message (lost transient activation)', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    // "Current context" fires when the user gesture is lost after an async
    // operation (e.g. Tier 1 file fetch). This is NOT a user cancellation —
    // the app should fall through to Tier 2/Tier 3 fallback.
    expect(
      isUserCancel(
        new DOMException(
          'The request is not allowed by the user agent or the platform in the current context',
          'NotAllowedError',
        ),
      ),
    ).toBe(false);
  });

  it('returns true for NotAllowedError with "share canceled" message', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    expect(
      isUserCancel(new DOMException('share canceled', 'NotAllowedError')),
    ).toBe(true);
  });

  it('returns false for NotAllowedError with other message', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    expect(
      isUserCancel(
        new DOMException(
          'Share API is disabled by policy',
          'NotAllowedError',
        ),
      ),
    ).toBe(false);
  });

  it('returns false for non-DOM exceptions', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    expect(isUserCancel(new Error('Network error'))).toBe(false);
    expect(isUserCancel('random string')).toBe(false);
    expect(isUserCancel(null)).toBe(false);
  });

  it('returns false for unrelated DOMException types', async () => {
    const { isUserCancel } = await import('../hooks/useWebShare');
    expect(
      isUserCancel(new DOMException('Not found', 'NotFoundError')),
    ).toBe(false);
  });
});

// ===========================================================================
// sharePublication() tests
// ===========================================================================

describe('sharePublication()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ---------- 2.1 Native share success ----------
  describe('native share success', () => {
    beforeEach(() => {
      mockNavigatorShare();
      vi.mocked(navigator.share!).mockResolvedValue(undefined);
    });

    it('returns {status:"shared", channel:"native"} when navigator.share resolves', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result).toEqual({
        status: 'shared',
        channel: 'native',
      });
    });

    it('calls navigator.share with text and url derived from imageUrl', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(navigator.share).toHaveBeenCalledTimes(1);
      expect(navigator.share).toHaveBeenCalledWith({
        text: SAMPLE_TEXT,
        url: IMAGE_URL,
      });
    });
  });

  // ---------- 2.2 AbortError = canceled ----------
  describe('AbortError cancellation', () => {
    beforeEach(() => {
      mockNavigatorShare();
      vi.mocked(navigator.share!).mockRejectedValue(
        new DOMException('share canceled', 'AbortError'),
      );
      // Spy on fetch to assert it's NOT called
      spyOnFetch();
    });

    it('returns {status:"canceled"} for AbortError', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result).toEqual({ status: 'canceled' });
    });

    it('does NOT execute any fallback side-effects on cancel', async () => {
      mockClipboardWrite();
      const { sharePublication } = await import('../hooks/useWebShare');

      await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(navigator.share).toHaveBeenCalledTimes(1);
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  // ---------- 2.3 NotAllowedError classification ----------
  describe('NotAllowedError cancel-like classification', () => {
    beforeEach(() => {
      mockNavigatorShare();
      mockClipboardWrite();
      vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
      spyOnFetch().mockRejectedValue(new Error('fetch not needed'));
      mockWindowOpen();
    });

    it('falls through to Tier 3 fallback for NotAllowedError with "current context" message (lost transient activation, not cancel)', async () => {
      vi.mocked(navigator.share!).mockRejectedValue(
        new DOMException(
          'The request is not allowed by the user agent or the platform in the current context',
          'NotAllowedError',
        ),
      );
      const { sharePublication } = await import('../hooks/useWebShare');
      vi.mocked(window.open).mockReturnValue(window);

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      // "Current context" NotAllowedError means transient activation was lost
      // during Tier 1 fetch or similar async gap — this is NOT a user cancel.
      // The app SHOULD continue to Tier 2/Tier 3 fallback.
      expect(result.status).not.toBe('canceled');
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('returns {status:"canceled"} for NotAllowedError with genuine "share canceled" message', async () => {
      vi.mocked(navigator.share!).mockRejectedValue(
        new DOMException('share canceled', 'NotAllowedError'),
      );
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result).toEqual({ status: 'canceled' });
    });

    it('proceeds to clipboard fallback for NotAllowedError WITHOUT cancel-like message (non-cancel failure)', async () => {
      vi.mocked(navigator.share!).mockRejectedValue(
        new DOMException(
          'Share API is disabled by policy',
          'NotAllowedError',
        ),
      );
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      // Per design: non-cancel NotAllowedError → fallback (not 'failed')
      expect(result.status).toBe('fallback-shared');
      // Text was still copied
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  // ---------- 2.4 Fallback – clipboard on unsupported browser ----------
  describe('fallback to clipboard when navigator.share is unsupported', () => {
    beforeEach(() => {
      deleteNavigatorShare();
      mockClipboardWrite();
      vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
      spyOnFetch().mockRejectedValue(new Error('fetch not needed for this test'));
      mockWindowOpen();
    });

    it('copies text to clipboard when share is unsupported', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAMPLE_TEXT);
      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.copied).toBe(true);
    });
  });

  // ---------- 2.5 Image download via fetch/URL.createObjectURL/anchor ----------
  describe('image download via fetch+createObjectURL+anchor click', () => {
    beforeEach(() => {
      deleteNavigatorShare();
      mockClipboardWrite();
      vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
      const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      spyOnFetch().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(fakeBlob),
      } as Response);
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      });
      const anchorMethods = { href: '', download: '', click: vi.fn() };
      vi.spyOn(document, 'createElement').mockReturnValue(
        anchorMethods as unknown as HTMLElement,
      );
    });

    it('downloads image via anchor click and returns imageAction=downloaded', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.imageAction).toBe('downloaded');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('copies text to clipboard before attempting image download', async () => {
      const { sharePublication } = await import('../hooks/useWebShare');

      await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalled();
    });
  });

  // ---------- 2.6 fetch failure falls back to window.open ----------
  describe('fetch failure falls back to window.open image URL', () => {
    beforeEach(() => {
      deleteNavigatorShare();
      mockClipboardWrite();
      vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
      spyOnFetch().mockRejectedValue(new Error('Network error'));
      mockWindowOpen();
    });

    it('opens image URL in new tab when fetch fails', async () => {
      vi.mocked(window.open).mockReturnValue(window); // non-null → succeeds
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.imageAction).toBe('opened');
      expect(window.open).toHaveBeenCalledWith(
        IMAGE_URL,
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('still reports copied=true when clipboard worked despite fetch failure', async () => {
      vi.mocked(window.open).mockReturnValue(window);
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.copied).toBe(true);
    });
  });

  // ---------- 2.7 Clipboard failure + image still proceeds ----------
  describe('clipboard failure with image fallback still proceeding', () => {
    beforeEach(() => {
      deleteNavigatorShare();
      mockClipboardWrite();
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
        new Error('Clipboard permission denied'),
      );
      mockWindowOpen();
    });

    it('returns fallback-shared with copied=false and imageAction=opened when clipboard fails but image URL opens', async () => {
      spyOnFetch().mockRejectedValue(new Error('fetch failed'));
      vi.mocked(window.open).mockReturnValue(window);

      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.copied).toBe(false);
      expect(fb.imageAction).toBe('opened');
    });

    it('returns {status:"failed"} when both clipboard and image fail (nothing useful happened)', async () => {
      spyOnFetch().mockRejectedValue(new Error('fetch failed'));
      vi.mocked(window.open).mockImplementation(() => {
        throw new Error('popup blocked');
      });

      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });

      expect(result.status).toBe('failed');
      const fb = result as Extract<typeof result, { status: 'failed' }>;
      expect(fb.reason).toContain('No se pudo copiar');
    });
  });
});

// ===========================================================================
// createImageFile() tests — Tier 1 file helper
// ===========================================================================

describe('createImageFile()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // 5.1.1 fetches Blob, creates File with correct type/name
  it('fetches Cloudinary image and creates File with correct type and derived name', async () => {
    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL);

    expect(file).not.toBeNull();
    expect(file!.type).toBe('image/png');
    expect(file!.name).toBe('pub.png');
  });

  it('returns null when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL);

    expect(file).toBeNull();
  });

  it('returns null for non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL);

    expect(file).toBeNull();
  });

  it('returns null when blob type is not an image', async () => {
    const textBlob = new Blob(['not-an-image'], { type: 'text/plain' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(textBlob),
    } as Response);

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL);

    expect(file).toBeNull();
  });

  it('returns null when blob exceeds maxBytes limit', async () => {
    const largeBlob = new Blob(['x'.repeat(1024 * 1024)], { type: 'image/png' }); // ~1MB
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(largeBlob),
    } as Response);

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL, { maxBytes: 100 });

    expect(file).toBeNull();
  });

  it('returns null when AbortSignal is already aborted', async () => {
    const { createImageFile } = await import('../hooks/useWebShare');

    const controller = new AbortController();
    controller.abort();

    const file = await createImageFile(IMAGE_URL, { signal: controller.signal });

    expect(file).toBeNull();
  });

  it('uses the provided fileName when given', async () => {
    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/webp' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { createImageFile } = await import('../hooks/useWebShare');
    const file = await createImageFile(IMAGE_URL, { fileName: 'product.webp' });

    expect(file).not.toBeNull();
    expect(file!.name).toBe('product.webp');
    expect(file!.type).toBe('image/webp');
  });
});

// ===========================================================================
// tryFileShare() tests — Tier 1 canShare + navigator.share({files,...})
// ===========================================================================

describe('tryFileShare()', () => {
  let mockFile: File;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockFile = new File(['fake-image-data'], 'img.png', { type: 'image/png' });
  });

  // 5.1.2 canShare true → navigator.share({files,text,title}) with no url
  it('calls navigator.share with files, text, title and NO url when canShare returns true', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: mockShare,
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text', 'Test title');

    expect(result).toBe('shared');
    expect(mockShare).toHaveBeenCalledWith({
      files: [mockFile],
      text: 'Test text',
      title: 'Test title',
    });
    // Explicitly verify NO url property in the file-share payload
    const callArg = mockShare.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('url');
  });

  it('includes text and files but not title when title is omitted', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: mockShare,
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Only text');

    expect(result).toBe('shared');
    expect(mockShare).toHaveBeenCalledWith({
      files: [mockFile],
      text: 'Only text',
    });
  });

  // 5.1.3 canShare false/missing → return null (Tier 2 fallback)
  it('returns null when canShare returns false', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => false),
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    expect(result).toBeNull();
  });

  it('returns null when canShare is not a function', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: undefined,
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    expect(result).toBeNull();
  });

  // 5.1.4 AbortError cancel → return 'canceled', no fallback
  it('returns "canceled" for AbortError from file share', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(
        new DOMException('share canceled', 'AbortError'),
      ),
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    expect(result).toBe('canceled');
  });

  it('returns null (fallback) for "current context" NotAllowedError from file share (lost activation, not cancel)', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(
        new DOMException(
          'The request is not allowed by the user agent or the platform in the current context',
          'NotAllowedError',
        ),
      ),
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    // "Current context" means transient activation was lost after async gap.
    // This is NOT user cancel — fall through to Tier 2.
    expect(result).toBeNull();
  });

  it('returns "canceled" for NotAllowedError with genuine "share canceled" message from file share', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(
        new DOMException('share canceled', 'NotAllowedError'),
      ),
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    // Genuine user dismissal — must remain canceled, no fallback
    expect(result).toBe('canceled');
  });

  // 5.1.5 Generic failure → return null (Tier 2 fallback proceeds)
  it('returns null for non-cancel file share failure (triggers Tier 2 fallback)', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(new Error('Share API error')),
    });

    const { tryFileShare } = await import('../hooks/useWebShare');
    const result = await tryFileShare(mockFile, 'Test text');

    expect(result).toBeNull();
  });
});

// ===========================================================================
// sharePublication() — Tier 1 integration tests
// ===========================================================================

describe('sharePublication() Tier 1 file share integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // 5.1.6 Non-image blob → Tier 2 fallback (no file share attempt)
  it('falls back to Tier 2 native share when image blob is non-image type', async () => {
    // Enable Tier 1 with canShare, and Tier 2 with navigator.share
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });

    // Mock fetch to return a text blob (non-image)
    const textBlob = new Blob(['not-an-image'], { type: 'text/plain' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(textBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Tier 2 native share was used as fallback
    expect(result).toEqual({
      status: 'shared',
      channel: 'native',
    });
  });

  it('falls back to Tier 2 native share when blob exceeds maxBytes', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });

    // Default maxBytes in sharePublication is 10MB — create a blob larger than that
    const largeBlob = new Blob(['x'.repeat(15 * 1024 * 1024)], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(largeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Should fall through to Tier 2 regardless of maxBytes
    expect(result).toEqual({
      status: 'shared',
      channel: 'native',
    });
  });

  // 5.1.7 Fetch abort → Tier 2 fallback
  it('falls back to Tier 2 when fetch is aborted', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError'),
    );

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Tier 2 native share was used as fallback
    expect(result).toEqual({
      status: 'shared',
      channel: 'native',
    });
  });

  // Timer-based abort — verifies AbortController/timeout in sharePublication
  it('aborts Cloudinary fetch after timeout and falls back to Tier 2', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });

    // Mock fetch to hang forever but respect AbortSignal
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
          // Never resolve — simulate slow/flaky network
        });
      },
    );

    const { sharePublication } = await import('../hooks/useWebShare');

    // Use fake timers AFTER importing to avoid interfering with module loading
    vi.useFakeTimers();

    const sharePromise = sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Advance time past the 8s timeout to trigger the abort
    await vi.advanceTimersByTimeAsync(8500);

    const result = await sharePromise;

    // Should fall through to Tier 2 native share
    expect(result).toEqual({
      status: 'shared',
      channel: 'native',
    });

    vi.useRealTimers();
  });

  // File-share success path
  it('returns file-native channel when Tier 1 file share succeeds', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });

    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(result).toEqual({
      status: 'shared',
      channel: 'file-native',
    });
  });

  // File-share cancel stops the chain
  it('returns canceled and does NOT fall through to Tier 2 when file share is canceled', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(
        new DOMException('share canceled', 'AbortError'),
      ),
    });

    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(result).toEqual({ status: 'canceled' });
  });

  // canShare unsupported skips Tier 1 entirely
  it('skips Tier 1 entirely when canShare is not a function', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: undefined,
      share: vi.fn().mockResolvedValue(undefined),
    });

    // Even if fetch would succeed, Tier 1 should be skipped
    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Tier 2 native share used directly
    expect(result).toEqual({
      status: 'shared',
      channel: 'native',
    });
  });
});

// ===========================================================================
// tryImageDownload timeout tests (via sharePublication Tier 3 path)
// ===========================================================================

describe('tryImageDownload() timeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    deleteNavigatorShare();
    mockClipboardWrite();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
    mockWindowOpen();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
    const anchorMethods = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(
      anchorMethods as unknown as HTMLElement,
    );
  });

  it('falls back to window.open when image fetch times out', async () => {
    // Mock fetch to hang forever but respect AbortSignal
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
          // Never resolve — simulates slow network
        });
      },
    );
    vi.mocked(window.open).mockReturnValue(window);

    const { sharePublication } = await import('../hooks/useWebShare');

    vi.useFakeTimers();
    const sharePromise = sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Advance past the timeout to trigger abort
    await vi.advanceTimersByTimeAsync(10000);

    const result = await sharePromise;

    // Fetch timed out, should fall back to window.open
    expect(window.open).toHaveBeenCalledWith(
      IMAGE_URL,
      '_blank',
      'noopener,noreferrer',
    );
    expect(result.status).toBe('fallback-shared');
    const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
    expect(fb.imageAction).toBe('opened');

    vi.useRealTimers();
  });

  it('still returns downloaded when image fetch completes before timeout', async () => {
    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');

    const result = await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(result.status).toBe('fallback-shared');
    const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
    expect(fb.imageAction).toBe('downloaded');
  });
});

// ===========================================================================
// isSafeImageUrl tests
// ===========================================================================

describe('isSafeImageUrl()', () => {
  it('returns true for Cloudinary HTTPS URL', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(
      isSafeImageUrl('https://res.cloudinary.com/demo/image/upload/v1/pub.png'),
    ).toBe(true);
  });

  it('returns true for generic HTTPS image URL', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('https://example.com/image.jpg')).toBe(true);
  });

  it('returns false for HTTP URL (non-HTTPS)', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('http://example.com/image.jpg')).toBe(false);
  });

  it('returns false for data: URL scheme', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('data:image/png;base64,abc123')).toBe(false);
  });

  it('returns false for javascript: URL scheme', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('returns false for file: URL scheme', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
  });

  it('returns false for blob: URL scheme', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('blob:http://example.com/uuid')).toBe(false);
  });

  it('returns false for empty string', async () => {
    const { isSafeImageUrl } = await import('../hooks/useWebShare');
    expect(isSafeImageUrl('')).toBe(false);
  });
});

// ===========================================================================
// Blocker 1: URL safety guard for Tier 1 & 2 (isSafeImageUrl applied before
// createImageFile fetch and tryNativeShare navigator.share)
// ===========================================================================
//
// NOTE on testing pattern: we use fresh imports inside each test to avoid
// stale mocks leaking across tests. The beforeEach in each parent describe
// resets mocks so the different blocks don't interfere.

describe('URL safety — isSafeImageUrl guards at Tier 1 & 2 entry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ----- createImageFile guard -----
  describe('createImageFile() URL guard', () => {
    it('returns null for non-HTTPS URL without attempting fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const { createImageFile } = await import('../hooks/useWebShare');
      const result = await createImageFile('http://example.com/img.png');

      expect(result).toBeNull();
      // fetch must NOT be called — guard rejects before reaching fetch
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns null for non-HTTPS URL even when fetch would succeed', async () => {
      // If fetch would succeed (e.g. HTTP URL that resolves), guard still
      // rejects because the scheme is not HTTPS — safety before availability.
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['data'], { type: 'image/png' })),
      } as Response);

      const { createImageFile } = await import('../hooks/useWebShare');
      const result = await createImageFile('http://example.com/img.png');

      expect(result).toBeNull();
    });
  });

  // ----- tryNativeShare guard -----
  describe('tryNativeShare() URL guard', () => {
    it('returns null for non-HTTPS URL without calling navigator.share', async () => {
      // navigator.share is available and would succeed
      vi.stubGlobal('navigator', {
        ...navigator,
        share: vi.fn().mockResolvedValue(undefined),
      });

      // Import function directly (not via sharePublication)
      const mod = await import('../hooks/useWebShare');
      // We call sharePublication which dispatches to tryNativeShare internally
      // But we want to test the local tryNativeShare. Let's test via sharePublication
      // with canShare disabled so we hit Tier 2.
      const result = await mod.sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: 'http://example.com/img.png',
      });

      // For unsafe URL, tryNativeShare should return null, triggering Tier 3 fallback
      // Since clipboard isn't mocked, it'll fall through gracefully
      expect(navigator.share).not.toHaveBeenCalled();
      expect(result.status).not.toBe('shared');
    });

    it('protects navigator.share({url}) with unsafe URL — does not expose unsafe URL in share sheet', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: vi.fn().mockResolvedValue(undefined),
      });

      const { sharePublication } = await import('../hooks/useWebShare');
      await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: 'http://example.com/img.png',
      });

      // navigator.share must not be called with the unsafe URL
      expect(navigator.share).not.toHaveBeenCalled();
    });
  });

  // ----- sharePublication integration with unsafe URL -----
  describe('sharePublication skips Tier 1 and Tier 2 for unsafe URL, falls to Tier 3', () => {
    it('still copies text to clipboard when image URL is unsafe (Tier 3 clipboard unaffected)', async () => {
      // Provide clipboard so Tier 3 clipboard works — use stubGlobal to avoid
      // polluting the underlying navigator object for subsequent tests
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: 'http://example.com/img.png',
      });

      // Text was copied via clipboard (Tier 3)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAMPLE_TEXT);
      expect(result.status).toBe('fallback-shared');
      const fb = result as Extract<typeof result, { status: 'fallback-shared' }>;
      expect(fb.copied).toBe(true);
      // Image action may be 'failed' since HTTP URL is blocked by Tier 3 guard too
    });

    it('does NOT fetch the image for unsafe URL (Tier 1 skip)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('should not be called'),
      );

      // Also provide canShare so Tier 1 would be attempted
      vi.stubGlobal('navigator', {
        ...navigator,
        canShare: vi.fn(() => true),
        share: vi.fn().mockResolvedValue(undefined),
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { sharePublication } = await import('../hooks/useWebShare');
      await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: 'http://example.com/img.png',
      });

      // fetch must NOT be called for the unsafe URL
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('unsafe HTTP URL returns failed when clipboard also fails', async () => {
      // Both unsafe URL and no clipboard → nothing useful happened
      const { sharePublication } = await import('../hooks/useWebShare');

      const result = await sharePublication({
        text: SAMPLE_TEXT,
        imageUrl: 'http://example.com/img.png',
      });

      expect(result.status).toBe('failed');
    });
  });
});

// ===========================================================================
// console.warn observability tests
// ===========================================================================

describe('console.warn observability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs a warning when tryClipboard fails', async () => {
    deleteNavigatorShare();
    mockClipboardWrite();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error('Clipboard denied'),
    );
    mockWindowOpen();
    vi.mocked(window.open).mockReturnValue(window);
    // fetch fails too so we hit tryOpenImage also
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(console.warn).toHaveBeenCalled();
  });

  it('logs a warning when createImageFile fetch fails (Tier 1)', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Network error'),
    );

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Tier 1 failed but Tier 2 succeeded — should have logged the Tier 1 error
    expect(console.warn).toHaveBeenCalled();
  });

  it('does NOT log a warning for AbortError (genuine user cancellation is not an error)', async () => {
    mockNavigatorShare();
    vi.mocked(navigator.share!).mockRejectedValue(
      new DOMException('share canceled', 'AbortError'),
    );

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// CustomEvent observability — Blocker 5
// ===========================================================================

describe('CustomEvent observability — naldopro:share-error', () => {
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dispatchEventSpy = vi.spyOn(document, 'dispatchEvent').mockImplementation(() => true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('dispatches naldopro:share-error CustomEvent when tryClipboard fails', async () => {
    // Navigate.share unsupported → clipboard (which fails)
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')),
      },
    });

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('naldopro:share-error');
    expect(event.detail).toBeDefined();
    expect(event.detail.context).toContain('tryClipboard');
  });

  it('does NOT dispatch naldopro:share-error for user cancellation (AbortError)', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      share: vi.fn().mockRejectedValue(
        new DOMException('share canceled', 'AbortError'),
      ),
    });

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it('does NOT dispatch naldopro:share-error for genuine "share canceled" NotAllowedError', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      share: vi.fn().mockRejectedValue(
        new DOMException('share canceled', 'NotAllowedError'),
      ),
    });

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it('dispatches naldopro:share-error when createImageFile fetch fails', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('naldopro:share-error');
    expect(event.detail.context).toContain('createImageFile');
  });

  it('dispatches naldopro:share-error when tryFileShare fails non-cancel', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(new Error('Share API generic error')),
    });
    const fakeBlob = new Blob(['data'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    } as Response);

    const { sharePublication } = await import('../hooks/useWebShare');
    await sharePublication({
      text: SAMPLE_TEXT,
      imageUrl: IMAGE_URL,
    });

    // Tier 1 file share failed (non-cancel) → event dispatched
    expect(dispatchEventSpy).toHaveBeenCalled();
    // The event should be about the file share failure
    const events = dispatchEventSpy.mock.calls.map(
      (c) => (c[0] as CustomEvent).detail.context,
    );
    const hasFileShare = events.some((ctx: string) => ctx.includes('tryFileShare'));
    expect(hasFileShare).toBe(true);
  });
});

// ===========================================================================
// useWebShare hook tests — using renderHook
// ===========================================================================

describe('useWebShare() hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with idle state (loading=false, result=null)', async () => {
    mockNavigatorShare();
    vi.mocked(navigator.share!).mockResolvedValue(undefined);

    const { useWebShare } = await import('../hooks/useWebShare');
    const { result } = renderHook(() => useWebShare());

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('sets loading=true while sharing, then returns result', async () => {
    let resolveShare!: (v: unknown) => void;
    mockNavigatorShare();
    vi.mocked(navigator.share!).mockReturnValue(
      new Promise((r) => {
        resolveShare = r;
      }),
    );

    const { useWebShare } = await import('../hooks/useWebShare');
    const { result } = renderHook(() => useWebShare());

    // Start share in an act
    let sharePromise!: Promise<unknown>;
    act(() => {
      sharePromise = result.current.share({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });
    });

    // loading should be true mid-flight
    expect(result.current.loading).toBe(true);
    expect(result.current.result).toBeNull();

    // Resolve the share
    await act(async () => {
      resolveShare(undefined);
      await sharePromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result?.status).toBe('shared');
  });

  it('returns {status:"failed"} when native share and ALL fallbacks fail', async () => {
    mockNavigatorShare();
    vi.mocked(navigator.share!).mockRejectedValue(
      new Error('Unexpected crash'),
    );
    // No clipboard mock → writeText unavailable → fails
    // No fetch mock → fails
    // No window.open mock → fails (jsdom throws "Not implemented")

    const { useWebShare } = await import('../hooks/useWebShare');
    const { result } = renderHook(() => useWebShare());

    let shareResult!: Awaited<ReturnType<ReturnType<typeof useWebShare>['share']>>;
    await act(async () => {
      shareResult = await result.current.share({
        text: SAMPLE_TEXT,
        imageUrl: IMAGE_URL,
      });
    });

    expect(result.current.loading).toBe(false);
    expect(shareResult.status).toBe('failed');
    const fb = shareResult as Extract<typeof shareResult, { status: 'failed' }>;
    expect(fb.reason).toContain('No se pudo copiar');
  });
});
