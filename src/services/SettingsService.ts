import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Configuracion } from '../types';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'global'; // Singleton global configuration for MVP

/** Shared default configuration values used across components. */
export const DEFAULT_CONFIG: Omit<Configuracion, 'id' | 'updated_at'> = {
  tasa_usd_cup: 350,
  redondeo_multiplo: 5,
  whatsapp_numero: '',
  plantilla_default_id: 'default-template',
};

export class SettingsService {
  /**
   * Obtiene la configuración global activa.
   */
  static async getConfiguracion(): Promise<Configuracion | null> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return { 
        id: docSnap.id, 
        ...data,
        updated_at: data.updated_at instanceof Timestamp ? data.updated_at.toDate() : new Date(data.updated_at)
      } as Configuracion;
    }
    return null;
  }

  /**
   * Inicializa la configuración por defecto de forma segura (solo si no existe).
   */
  static async initializeDefaultConfig(
    config: Omit<Configuracion, 'id' | 'updated_at'>
  ): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        ...config,
        updated_at: new Date()
      });
    }
  }

  /**
   * Actualiza la configuración global.
   * Restringe la actualización de id y updated_at desde fuera.
   */
  static async updateConfiguracion(updates: Partial<Omit<Configuracion, 'id' | 'updated_at'>>): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date()
    });
  }
}
