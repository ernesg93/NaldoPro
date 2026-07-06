import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../services/StorageService';

describe('StorageService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validación local', () => {
    it('rechaza tipo de archivo no permitido', async () => {
      const file = new File([''], 'test.gif', { type: 'image/gif' });
      await expect(StorageService.uploadImage(file)).rejects.toThrow(
        /Tipo de archivo no permitido/
      );
    });

    it('rechaza archivo demasiado grande (> 5MB)', async () => {
      // Create a file larger than 5MB
      const largeContent = new Uint8Array(6 * 1024 * 1024);
      const file = new File([largeContent], 'test.jpg', { type: 'image/jpeg' });
      await expect(StorageService.uploadImage(file)).rejects.toThrow(
        /demasiado grande/
      );
    });

    it('acepta tipo JPEG dentro del límite de tamaño', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ secure_url: 'https://res.cloudinary.com/xxx/image/upload/test.jpg' }),
      } as any);

      const file = new File(['fake-jpeg-content'], 'test.jpg', { type: 'image/jpeg' });
      await expect(StorageService.uploadImage(file)).resolves.toBe(
        'https://res.cloudinary.com/xxx/image/upload/test.jpg'
      );
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload a Cloudinary', () => {
    it('envía FormData al endpoint correcto y retorna secure_url en éxito', async () => {
      const mockJson = vi.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.com/xxx/image/upload/v1/naldopro/products/abc.jpg' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: mockJson,
      } as any);

      const file = new File(['fake-content'], 'test.webp', { type: 'image/webp' });
      const url = await StorageService.uploadImage(file);

      expect(url).toBe('https://res.cloudinary.com/xxx/image/upload/v1/naldopro/products/abc.jpg');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const callArgs = (globalThis.fetch as any).mock.calls[0];
      const [endpoint, options] = callArgs;

      // Verify endpoint
      expect(endpoint).toContain('api.cloudinary.com/v1_1');
      expect(endpoint).toContain('/image/upload');

      // Verify it's a FormData POST
      expect(options.method).toBe('POST');
      expect(options.body).toBeInstanceOf(FormData);

      // Verify FormData contains the file, upload_preset, and folder
      const formData = options.body as FormData;
      expect(formData.get('upload_preset')).toBe('naldopro_unsigned');
      expect(formData.get('folder')).toBe('naldopro/products');
      expect(formData.get('file')).toBe(file);
    });

    it('lanza error si Cloudinary devuelve error HTTP', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"Upload preset not found"}}',
      } as any);

      const file = new File(['fake'], 'test.png', { type: 'image/png' });
      await expect(StorageService.uploadImage(file)).rejects.toThrow(
        /Error al subir la imagen/
      );
    });

    it('lanza error si Cloudinary responde 200 sin secure_url', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ public_id: 'abc123', format: 'png' }),
      } as any);

      const file = new File(['fake'], 'test.png', { type: 'image/png' });
      await expect(StorageService.uploadImage(file)).rejects.toThrow(
        /respuesta inválida del servidor/
      );
    });

    it('lanza error si Cloudinary responde 200 con secure_url no string', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ secure_url: null }),
      } as any);

      const file = new File(['fake'], 'test.jpg', { type: 'image/jpeg' });
      await expect(StorageService.uploadImage(file)).rejects.toThrow(
        /respuesta inválida del servidor/
      );
    });
  });
});
