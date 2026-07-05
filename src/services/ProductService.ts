import { collection, doc, getDocs, getDoc, addDoc, updateDoc, query, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Producto } from '../types';

const PRODUCTS_COLLECTION = 'products';

export class ProductService {
  static async getProducts(): Promise<Producto[]> {
    const q = query(collection(db, PRODUCTS_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        created_at: data.created_at instanceof Timestamp ? data.created_at.toDate() : new Date(data.created_at),
        updated_at: data.updated_at instanceof Timestamp ? data.updated_at.toDate() : new Date(data.updated_at)
      };
    }) as Producto[];
  }

  static async getProduct(id: string): Promise<Producto | null> {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        created_at: data.created_at instanceof Timestamp ? data.created_at.toDate() : new Date(data.created_at),
        updated_at: data.updated_at instanceof Timestamp ? data.updated_at.toDate() : new Date(data.updated_at)
      } as Producto;
    }
    return null;
  }

  static async createProduct(productData: Omit<Producto, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    this.validateProductData(productData);
    
    const now = new Date();
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...productData,
      created_at: now,
      updated_at: now
    });
    return docRef.id;
  }

  static async updateProduct(id: string, updates: Partial<Omit<Producto, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    if (updates.precio_usd !== undefined || updates.cantidad_por_caja !== undefined || updates.nombre !== undefined || updates.imagen_url !== undefined || updates.categoria_id !== undefined) {
      if (updates.precio_usd !== undefined && updates.precio_usd < 0) throw new Error("precio_usd >= 0");
      if (updates.cantidad_por_caja !== undefined && updates.cantidad_por_caja <= 0) throw new Error("cantidad_por_caja > 0");
      if (updates.nombre !== undefined && !updates.nombre.trim()) throw new Error("nombre requerido");
      if (updates.imagen_url !== undefined && !updates.imagen_url.trim()) throw new Error("imagen_url requerida");
      if (updates.categoria_id !== undefined && !updates.categoria_id.trim()) throw new Error("categoria_id requerida");
    }

    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date()
    });
  }

  private static validateProductData(productData: Omit<Producto, 'id' | 'created_at' | 'updated_at'>) {
    if (!productData.nombre || !productData.nombre.trim()) {
      throw new Error("El nombre es requerido.");
    }
    if (!productData.categoria_id || !productData.categoria_id.trim()) {
      throw new Error("La categoría es requerida.");
    }
    if (!productData.imagen_url || !productData.imagen_url.trim()) {
      throw new Error("La imagen es requerida.");
    }
    if (productData.precio_usd < 0) {
      throw new Error("El precio USD no puede ser negativo.");
    }
    if (productData.cantidad_por_caja <= 0) {
      throw new Error("La cantidad por caja debe ser mayor a 0.");
    }
  }
}
