import { collection, doc, getDocs, getDoc, setDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Plantilla, PlantillaBloque } from '../types';

const TEMPLATES_COLLECTION = 'templates';
const TEMPLATE_BLOCKS_COLLECTION = 'templateBlocks';

export const DEFAULT_TEMPLATE_ID = 'default-template';

export class TemplateService {
  static async getDefaultTemplate(): Promise<Plantilla> {
    const docRef = doc(db, TEMPLATES_COLLECTION, DEFAULT_TEMPLATE_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Plantilla;
    }
    
    // Si no existe, la inicializamos
    const newTemplate: Plantilla = {
      id: DEFAULT_TEMPLATE_ID,
      nombre: 'Plantilla Comercial por Defecto',
    };
    
    const batch = writeBatch(db);
    batch.set(docRef, newTemplate);
    
    // Crear bloques iniciales por defecto
    const initialBlocks: PlantillaBloque[] = [
      {
        id: 'block-1',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'texto',
        titulo: 'Saludo',
        contenido: '¡Nuevos productos disponibles!',
        orden: 1,
        visible: true,
      },
      {
        id: 'block-2',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'lista',
        titulo: 'Detalles del producto',
        orden: 2,
        visible: true,
      },
      {
        id: 'block-3',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'precio',
        titulo: 'Precio',
        orden: 3,
        visible: true,
      },
      {
        id: 'block-4',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'caja',
        titulo: 'Caja',
        orden: 4,
        visible: true,
      },
      {
        id: 'block-5',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'imagen',
        titulo: 'Imagen',
        orden: 5,
        visible: true,
      },
      {
        id: 'block-6',
        plantilla_id: DEFAULT_TEMPLATE_ID,
        tipo: 'texto',
        titulo: 'Despedida',
        contenido: 'Contáctanos para más info.',
        orden: 6,
        visible: true,
      }
    ];
    
    for (const block of initialBlocks) {
      const blockRef = doc(db, TEMPLATE_BLOCKS_COLLECTION, block.id);
      batch.set(blockRef, block);
    }
    
    await batch.commit();
    return newTemplate;
  }

  static async getTemplateBlocks(templateId: string): Promise<PlantillaBloque[]> {
    const q = query(
      collection(db, TEMPLATE_BLOCKS_COLLECTION),
      where('plantilla_id', '==', templateId),
      orderBy('orden', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as PlantillaBloque[];
  }

  static async updateTemplateBlocks(templateId: string, blocks: PlantillaBloque[]): Promise<void> {
    const hasVisibleBlock = blocks.some(b => b.visible);
    if (!hasVisibleBlock) {
      throw new Error("La plantilla debe contener al menos un bloque visible.");
    }
    
    const currentBlocks = await this.getTemplateBlocks(templateId);
    const blocksToKeep = blocks.map(b => b.id);
    const blocksToDelete = currentBlocks.filter(b => !blocksToKeep.includes(b.id));
    
    const batch = writeBatch(db);
    
    for (const block of blocksToDelete) {
      const ref = doc(db, TEMPLATE_BLOCKS_COLLECTION, block.id);
      batch.delete(ref);
    }
    
    for (const block of blocks) {
      if (!block.titulo || !block.titulo.trim()) {
        throw new Error("El título del bloque es requerido.");
      }
      if (block.tipo === 'texto' && (!block.contenido || !block.contenido.trim())) {
        throw new Error("El contenido del bloque de texto no puede estar vacío.");
      }
      
      const ref = doc(db, TEMPLATE_BLOCKS_COLLECTION, block.id);
      batch.set(ref, block);
    }

    await batch.commit();
  }
}
