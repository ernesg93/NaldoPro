const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? 'lfv9qink';
const UPLOAD_PRESET = 'naldopro_unsigned';
const UPLOAD_FOLDER = 'naldopro/products';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export class StorageService {
  static async uploadImage(file: File): Promise<string> {
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      throw new Error("Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WEBP.");
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`El archivo es demasiado grande. El máximo permitido es ${MAX_SIZE_MB}MB.`);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', UPLOAD_FOLDER);

    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[Cloudinary upload error]', response.status, errorBody);
      throw new Error(
        `Error al subir la imagen. Intenta de nuevo o contacta al administrador. (${response.status})`
      );
    }

    const data = await response.json();

    if (!data.secure_url || typeof data.secure_url !== 'string') {
      console.error('[Cloudinary upload error] Respuesta inesperada:', data);
      throw new Error(
        'Error al subir la imagen: respuesta inválida del servidor. Intenta de nuevo.'
      );
    }

    return data.secure_url;
  }
}
