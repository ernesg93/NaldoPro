import { collection, doc, getDocs, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { BloqueContenido, BloqueItem } from '../types';

const CONTENT_BLOCKS_COLLECTION = 'contentBlocks';
const BLOCK_ITEMS_COLLECTION = 'blockItems';

export interface ContentBlockWithItems {
  block: BloqueContenido;
  items: BloqueItem[];
}

export class ContentBlockService {
  /** Loads all content blocks for a product, ordered by `orden`. */
  static async getContentBlocks(productId: string): Promise<BloqueContenido[]> {
    const q = query(
      collection(db, CONTENT_BLOCKS_COLLECTION),
      where('producto_id', '==', productId),
      orderBy('orden', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BloqueContenido[];
  }

  /** Loads the items for a single block, ordered by `orden`. */
  static async getBlockItems(bloqueId: string): Promise<BloqueItem[]> {
    const q = query(
      collection(db, BLOCK_ITEMS_COLLECTION),
      where('bloque_id', '==', bloqueId),
      orderBy('orden', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BloqueItem[];
  }

  /** Loads all blocks with items for a product in one go. */
  static async getContentBlocksWithItems(
    productId: string
  ): Promise<ContentBlockWithItems[]> {
    const blocks = await this.getContentBlocks(productId);
    if (blocks.length === 0) return [];

    const itemPromises = blocks.map(b => this.getBlockItems(b.id));
    const itemsArrays = await Promise.all(itemPromises);

    return blocks.map((block, i) => ({
      block,
      items: itemsArrays[i],
    }));
  }

  /**
   * Replaces all content blocks (and their items) for a product.
   * Uses a batch write: deletes existing data, writes new records.
   *
   * @param blocks - Array of block data (without ids — they are generated).
   *   Each block can optionally include `items` (for list/text blocks).
   */
  static async saveContentBlocks(
    productId: string,
    blocks: Array<{
      tipo: 'texto' | 'lista' | 'separador';
      titulo: string;
      orden: number;
      items?: Array<{ valor: string; orden: number }>;
    }>
  ): Promise<void> {
    // Load existing blocks for cleanup
    const existingBlocks = await this.getContentBlocks(productId);
    const existingBlockIds = existingBlocks.map(b => b.id);

    // Load existing items for cleanup
    const existingItemRefs: { ref: any }[] = [];
    for (const blockId of existingBlockIds) {
      const itemSnap = await getDocs(
        query(
          collection(db, BLOCK_ITEMS_COLLECTION),
          where('bloque_id', '==', blockId)
        )
      );
      for (const d of itemSnap.docs) {
        existingItemRefs.push({ ref: d.ref });
      }
    }

    const batch = writeBatch(db);

    // Delete existing blocks and items
    for (const blockId of existingBlockIds) {
      batch.delete(doc(db, CONTENT_BLOCKS_COLLECTION, blockId));
    }
    for (const { ref } of existingItemRefs) {
      batch.delete(ref);
    }

    // Create new blocks and items
    for (const blockData of blocks) {
      const blockId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const block: BloqueContenido = {
        id: blockId,
        producto_id: productId,
        tipo: blockData.tipo,
        titulo: blockData.titulo,
        orden: blockData.orden,
      };
      batch.set(doc(db, CONTENT_BLOCKS_COLLECTION, blockId), block);

      // Persist items only for texto (one item) or lista (multiple items)
      if (blockData.items && blockData.items.length > 0) {
        for (const itemData of blockData.items) {
          const itemId = crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).substring(7)}`;

          const item: BloqueItem = {
            id: itemId,
            bloque_id: blockId,
            valor: itemData.valor,
            orden: itemData.orden,
          };
          batch.set(doc(db, BLOCK_ITEMS_COLLECTION, itemId), item);
        }
      }
    }

    await batch.commit();
  }
}
