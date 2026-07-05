import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../lib/firebase';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export class StorageService {
  static async uploadImage(file: File): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No hay un usuario autenticado para subir la imagen.");
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      throw new Error("Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WEBP.");
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`El archivo es demasiado grande. El máximo permitido es ${MAX_SIZE_MB}MB.`);
    }

    const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const path = `products/${user.uid}/${uuid}.${ext}`;

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
}
