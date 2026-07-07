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

import { AuthService } from '../services/AuthService';

describe('AuthService.login() validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty email', () => {
    it('throws "El email es requerido." when email is empty string', async () => {
      await expect(AuthService.login('', 'password123')).rejects.toThrow(
        'El email es requerido.',
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws "El email es requerido." when email is only whitespace', async () => {
      await expect(AuthService.login('   ', 'password123')).rejects.toThrow(
        'El email es requerido.',
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('invalid email format', () => {
    it('throws "El email no tiene un formato válido." when email has no @', async () => {
      await expect(AuthService.login('usuario', 'password123')).rejects.toThrow(
        'El email no tiene un formato válido.',
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws "El email no tiene un formato válido." when email has no domain after @', async () => {
      await expect(AuthService.login('user@', 'password123')).rejects.toThrow(
        'El email no tiene un formato válido.',
      );
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('empty password', () => {
    it('throws "La contraseña es requerida." when password is empty', async () => {
      await expect(
        AuthService.login('user@example.com', ''),
      ).rejects.toThrow('La contraseña es requerida.');
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('throws "La contraseña es requerida." when password is only whitespace', async () => {
      await expect(
        AuthService.login('user@example.com', '   '),
      ).rejects.toThrow('La contraseña es requerida.');
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
