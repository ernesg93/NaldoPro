import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'El email es requerido.',
  EMAIL_INVALID: 'El email no tiene un formato válido.',
  PASSWORD_REQUIRED: 'La contraseña es requerida.',
  GENERIC_AUTH_ERROR: 'Credenciales inválidas o error de autenticación.',
} as const;

const KNOWN_VALIDATION_MESSAGES: Set<string> = new Set([
  VALIDATION_MESSAGES.EMAIL_REQUIRED,
  VALIDATION_MESSAGES.EMAIL_INVALID,
  VALIDATION_MESSAGES.PASSWORD_REQUIRED,
]);

const GENERIC_AUTH_ERROR = VALIDATION_MESSAGES.GENERIC_AUTH_ERROR;

export function resolveAuthDisplayError(error: unknown): string {
  if (
    error instanceof Error &&
    KNOWN_VALIDATION_MESSAGES.has(error.message)
  ) {
    return error.message;
  }
  return GENERIC_AUTH_ERROR;
}

export class AuthService {
  static async login(email: string, password: string) {
    AuthService.validateLoginInput(email, password);
    const trimmedEmail = email.trim();
    return signInWithEmailAndPassword(auth, trimmedEmail, password);
  }

  static async logout() {
    return signOut(auth);
  }

  private static validateLoginInput(email: string, password: string): void {
    const trimmedEmail = email.trim();

    if (trimmedEmail === '') {
      throw new Error(VALIDATION_MESSAGES.EMAIL_REQUIRED);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error(VALIDATION_MESSAGES.EMAIL_INVALID);
    }

    if (password.trim() === '') {
      throw new Error(VALIDATION_MESSAGES.PASSWORD_REQUIRED);
    }
  }
}
