import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export class AuthService {
  static async login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  static async logout() {
    return signOut(auth);
  }
}
