import { collection, doc, getDocs, query, writeBatch, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { VarianteTipo, VarianteValor, ProductoVariante, ProductoVarianteValor } from '../types';

const VARIANT_TYPES_COLLECTION = 'variantTypes';
const VARIANT_VALUES_COLLECTION = 'variantValues';
const PRODUCT_VARIANTS_COLLECTION = 'productVariants';
const PRODUCT_VARIANT_VALUES_COLLECTION = 'productVariantValues';

export class VariantService {
  static async getVariantTypes(): Promise<VarianteTipo[]> {
    const q = query(collection(db, VARIANT_TYPES_COLLECTION));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as VarianteTipo[];
  }

  static async getVariantValues(tipoId?: string): Promise<VarianteValor[]> {
    const ref = collection(db, VARIANT_VALUES_COLLECTION);
    const q = tipoId
      ? query(ref, where('variante_tipo_id', '==', tipoId))
      : query(ref);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as VarianteValor[];
  }

  /**
   * Returns the product variants (tipo → values) for a given product.
   * Each entry groups a variant type with its selected values.
   */
  static async getProductVariantsGrouped(productId: string): Promise<
    Array<{ tipo: VarianteTipo; values: VarianteValor[] }>
  > {
    // Load ProductoVariante rows for this product
    const pvQuery = query(
      collection(db, PRODUCT_VARIANTS_COLLECTION),
      where('producto_id', '==', productId)
    );
    const pvSnap = await getDocs(pvQuery);
    const productVariants = pvSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as ProductoVariante[];

    if (productVariants.length === 0) return [];

    // Load all VarianteTipo and VarianteValor for lookup
    const [allTypes, allValues] = await Promise.all([
      this.getVariantTypes(),
      this.getVariantValues()
    ]);

    const typeMap = new Map(allTypes.map(t => [t.id, t]));
    const valueMap = new Map(allValues.map(v => [v.id, v]));

    // Load ProductoVarianteValor entries for each product variant
    const pvvPromises = productVariants.map(pv =>
      this.getProductVariantValues(pv.id)
    );
    const pvvResults = await Promise.all(pvvPromises);

    const result: Array<{ tipo: VarianteTipo; values: VarianteValor[] }> = [];

    for (let i = 0; i < productVariants.length; i++) {
      const pv = productVariants[i];
      const tipo = typeMap.get(pv.variante_tipo_id);
      if (!tipo) continue;

      const values = pvvResults[i]
        .map(pvv => valueMap.get(pvv.variante_valor_id))
        .filter((v): v is VarianteValor => v !== undefined);

      result.push({ tipo, values });
    }

    // Sort deterministically: variant types by nombre, values by valor
    result.sort((a, b) => a.tipo.nombre.localeCompare(b.tipo.nombre));
    for (const group of result) {
      group.values.sort((a, b) => a.valor.localeCompare(b.valor));
    }

    return result;
  }

  private static async getProductVariantValues(
    productVariantId: string
  ): Promise<ProductoVarianteValor[]> {
    const q = query(
      collection(db, PRODUCT_VARIANT_VALUES_COLLECTION),
      where('producto_variante_id', '==', productVariantId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as ProductoVarianteValor[];
  }

  /** Returns a flat list of selected value IDs per variant type for this product. */
  static async getSelectedValueIds(
    productId: string
  ): Promise<Record<string, string[]>> {
    const groups = await this.getProductVariantsGrouped(productId);
    const result: Record<string, string[]> = {};
    for (const g of groups) {
      result[g.tipo.id] = g.values.map(v => v.id);
    }
    return result;
  }

  /**
   * Replaces all product variant associations for a product.
   * Uses a batch write: deletes existing rows, writes new ones.
   *
   * @param productId - The product to associate variants with
   * @param selectedVariants - Map of variante_tipo_id → variante_valor_id[]
   */
  static async saveProductVariants(
    productId: string,
    selectedVariants: Record<string, string[]>
  ): Promise<void> {
    // Load existing product variants
    const pvQuery = query(
      collection(db, PRODUCT_VARIANTS_COLLECTION),
      where('producto_id', '==', productId)
    );
    const pvSnap = await getDocs(pvQuery);
    const existingPVs = pvSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductoVariante[];

    // Load existing product variant values
    const existingPVIds = existingPVs.map(pv => pv.id);
    const existingPVVIds: string[] = [];
    const existingPVVRefs: { ref: any; pvId: string }[] = [];

    for (const pvId of existingPVIds) {
      const pvvQuery = query(
        collection(db, PRODUCT_VARIANT_VALUES_COLLECTION),
        where('producto_variante_id', '==', pvId)
      );
      const pvvSnap = await getDocs(pvvQuery);
      for (const d of pvvSnap.docs) {
        existingPVVIds.push(d.id);
        existingPVVRefs.push({ ref: d.ref, pvId });
      }
    }

    const batch = writeBatch(db);

    // Delete existing product variants and their values
    for (const pv of existingPVs) {
      batch.delete(doc(db, PRODUCT_VARIANTS_COLLECTION, pv.id));
    }
    for (const { ref: pvvRef } of existingPVVRefs) {
      batch.delete(pvvRef);
    }

    // Create new product variants and values
    for (const [tipoId, valorIds] of Object.entries(selectedVariants)) {
      if (!valorIds.length) continue;

      const pvId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const pv: ProductoVariante = {
        id: pvId,
        producto_id: productId,
        variante_tipo_id: tipoId,
      };
      batch.set(doc(db, PRODUCT_VARIANTS_COLLECTION, pvId), pv);

      for (const valorId of valorIds) {
        const pvvId = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const pvv: ProductoVarianteValor = {
          id: pvvId,
          producto_variante_id: pvId,
          variante_valor_id: valorId,
        };
        batch.set(doc(db, PRODUCT_VARIANT_VALUES_COLLECTION, pvvId), pvv);
      }
    }

    await batch.commit();
  }

  /* ───── helpers for dev seeding ───── */

  static async seedInitialVariantData(): Promise<void> {
    const existing = await this.getVariantTypes();
    if (existing.length > 0) return;

    const batch = writeBatch(db);

    const tipos: VarianteTipo[] = [
      { id: 'tipo-sabores', nombre: 'Sabores' },
      { id: 'tipo-colores', nombre: 'Colores' },
      { id: 'tipo-tamanos', nombre: 'Tamaños' },
      { id: 'tipo-presentaciones', nombre: 'Presentaciones' },
    ];

    const valores: Record<string, VarianteValor[]> = {
      'tipo-sabores': [
        { id: 'val-sabor-chocolate', variante_tipo_id: 'tipo-sabores', valor: 'Chocolate' },
        { id: 'val-sabor-fresa', variante_tipo_id: 'tipo-sabores', valor: 'Fresa' },
        { id: 'val-sabor-limon', variante_tipo_id: 'tipo-sabores', valor: 'Limón' },
        { id: 'val-sabor-vainilla', variante_tipo_id: 'tipo-sabores', valor: 'Vainilla' },
        { id: 'val-sabor-coco', variante_tipo_id: 'tipo-sabores', valor: 'Coco' },
      ],
      'tipo-colores': [
        { id: 'val-color-rojo', variante_tipo_id: 'tipo-colores', valor: 'Rojo' },
        { id: 'val-color-azul', variante_tipo_id: 'tipo-colores', valor: 'Azul' },
        { id: 'val-color-verde', variante_tipo_id: 'tipo-colores', valor: 'Verde' },
        { id: 'val-color-negro', variante_tipo_id: 'tipo-colores', valor: 'Negro' },
        { id: 'val-color-blanco', variante_tipo_id: 'tipo-colores', valor: 'Blanco' },
      ],
      'tipo-tamanos': [
        { id: 'val-tamano-100g', variante_tipo_id: 'tipo-tamanos', valor: '100 g' },
        { id: 'val-tamano-200g', variante_tipo_id: 'tipo-tamanos', valor: '200 g' },
        { id: 'val-tamano-300g', variante_tipo_id: 'tipo-tamanos', valor: '300 g' },
        { id: 'val-tamano-500g', variante_tipo_id: 'tipo-tamanos', valor: '500 g' },
        { id: 'val-tamano-1kg', variante_tipo_id: 'tipo-tamanos', valor: '1 kg' },
      ],
      'tipo-presentaciones': [
        { id: 'val-pres-carton', variante_tipo_id: 'tipo-presentaciones', valor: 'Cartón' },
        { id: 'val-pres-plastico', variante_tipo_id: 'tipo-presentaciones', valor: 'Plástico' },
        { id: 'val-pres-vidrio', variante_tipo_id: 'tipo-presentaciones', valor: 'Vidrio' },
      ],
    };

    for (const t of tipos) {
      batch.set(doc(db, VARIANT_TYPES_COLLECTION, t.id), t);
    }

    for (const [tipoId, vals] of Object.entries(valores)) {
      for (const v of vals) {
        batch.set(doc(db, VARIANT_VALUES_COLLECTION, v.id), v);
      }
    }

    await batch.commit();
  }
}
