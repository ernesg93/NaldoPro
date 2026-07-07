import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

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
      throw new Error('El email es requerido.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error('El email no tiene un formato válido.');
    }

    if (password.trim() === '') {
      throw new Error('La contraseña es requerida.');
    }
  }
}
