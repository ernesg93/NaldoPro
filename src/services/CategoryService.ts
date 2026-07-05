import { collection, doc, getDocs, setDoc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Categoria } from '../types';

const CATEGORIES_COLLECTION = 'categories';

export class CategoryService {
  static async getCategories(): Promise<Categoria[]> {
    const q = query(collection(db, CATEGORIES_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Categoria[];
  }

  static async seedInitialCategories(): Promise<void> {
    const currentCategories = await this.getCategories();
    if (currentCategories.length === 0) {
      const initialCategories = [
        { id: 'cat-bebidas', nombre: 'Bebidas' },
        { id: 'cat-aseo', nombre: 'Aseo' },
        { id: 'cat-lacteos', nombre: 'Lácteos' },
        { id: 'cat-galletas', nombre: 'Galletas' }
      ];
      
      for (const cat of initialCategories) {
        await setDoc(doc(db, CATEGORIES_COLLECTION, cat.id), cat);
      }
    }
  }
}
