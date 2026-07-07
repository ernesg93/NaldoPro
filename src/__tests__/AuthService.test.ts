import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Mock firebase/auth before importing AuthService
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(() => ({})),
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
}));

import { AuthService, resolveAuthDisplayError, VALIDATION_MESSAGES } from '../services/AuthService';

describe('AuthService.login() validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty email', () => {
    it('throws when email is empty string', async () => {
      await expect(AuthService.login('', 'password123')).rejects.toThrow(
        VALIDATION_MESSAGES.EMAIL_REQUIRED,
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws when email is only whitespace', async () => {
      await expect(AuthService.login('   ', 'password123')).rejects.toThrow(
        VALIDATION_MESSAGES.EMAIL_REQUIRED,
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('invalid email format', () => {
    it('throws when email has no @', async () => {
      await expect(AuthService.login('usuario', 'password123')).rejects.toThrow(
        VALIDATION_MESSAGES.EMAIL_INVALID,
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws when email has no domain after @', async () => {
      await expect(AuthService.login('user@', 'password123')).rejects.toThrow(
        VALIDATION_MESSAGES.EMAIL_INVALID,
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('empty password', () => {
    it('throws when password is empty', async () => {
      await expect(
        AuthService.login('user@example.com', ''),
      ).rejects.toThrow(VALIDATION_MESSAGES.PASSWORD_REQUIRED);
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws when password is only whitespace', async () => {
      await expect(
        AuthService.login('user@example.com', '   '),
      ).rejects.toThrow(VALIDATION_MESSAGES.PASSWORD_REQUIRED);
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('valid credentials', () => {
    it('calls Firebase with trimmed email and original password', async () => {
      const mockCredential = { user: { uid: 'abc123' } } as any;
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce(mockCredential);

      const result = await AuthService.login('user@example.com', 'mypassword');

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'user@example.com',
        'mypassword',
      );
      expect(result).toBe(mockCredential);
    });

    it('trims email with surrounding whitespace before calling Firebase', async () => {
      const mockCredential = { user: { uid: 'abc123' } } as any;
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce(mockCredential);

      const result = await AuthService.login(
        '  user@example.com  ',
        'mypassword',
      );

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'user@example.com',
        'mypassword',
      );
      expect(result).toBe(mockCredential);
    });

    it('preserves original password with surrounding spaces (no trimming)', async () => {
      const mockCredential = { user: { uid: 'abc123' } } as any;
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce(mockCredential);

      const result = await AuthService.login(
        'user@example.com',
        '  mypassword  ',
      );

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'user@example.com',
        '  mypassword  ',
      );
      expect(result).toBe(mockCredential);
    });
  });
});

describe('resolveAuthDisplayError()', () => {
  const { EMAIL_REQUIRED, EMAIL_INVALID, PASSWORD_REQUIRED, GENERIC_AUTH_ERROR } = VALIDATION_MESSAGES;

  describe('known validation messages', () => {
    it('passes through EMAIL_REQUIRED', () => {
      const result = resolveAuthDisplayError(new Error(EMAIL_REQUIRED));
      expect(result).toBe(EMAIL_REQUIRED);
    });

    it('passes through EMAIL_INVALID', () => {
      const result = resolveAuthDisplayError(new Error(EMAIL_INVALID));
      expect(result).toBe(EMAIL_INVALID);
    });

    it('passes through PASSWORD_REQUIRED', () => {
      const result = resolveAuthDisplayError(new Error(PASSWORD_REQUIRED));
      expect(result).toBe(PASSWORD_REQUIRED);
    });
  });

  describe('Firebase-style errors', () => {
    it('returns generic fallback for Firebase auth error', () => {
      const result = resolveAuthDisplayError(
        new Error('Firebase: Error (auth/invalid-credential)'),
      );
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });

    it('returns generic fallback for Firebase user-not-found error', () => {
      const result = resolveAuthDisplayError(
        new Error('Firebase: Error (auth/user-not-found)'),
      );
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });
  });

  describe('unknown errors', () => {
    it('returns generic fallback for generic Error with unknown message', () => {
      const result = resolveAuthDisplayError(new Error('something broke'));
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });
  });

  describe('null/undefined/non-Error throws', () => {
    it('returns generic fallback when called with null', () => {
      const result = resolveAuthDisplayError(null);
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });

    it('returns generic fallback when called with undefined', () => {
      const result = resolveAuthDisplayError(undefined);
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });

    it('returns generic fallback when called with a string (non-Error throw)', () => {
      const result = resolveAuthDisplayError('raw string error');
      expect(result).toBe(GENERIC_AUTH_ERROR);
    });
  });
});
