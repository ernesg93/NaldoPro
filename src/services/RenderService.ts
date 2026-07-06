import type { Producto, CampañaProducto, PlantillaBloque, PublicacionGenerada } from '../types';
import { PricingService } from './PricingService';

/**
 * Shape of variant data passed to the renderer per product.
 * Each entry groups one variant type name with its selected values.
 */
export interface ProductVariantGroup {
  tipo: string;
  valores: string[];
}

/**
 * Shape of structured content block data per product.
 * Mirrors the product-level content blocks (text, list, separator).
 */
export interface ProductContentBlock {
  tipo: string;
  titulo: string;
  items: { valor: string }[];
}

export class RenderService {
  static generatePublications(
    campaignId: string,
    campaignProducts: CampañaProducto[],
    products: Producto[],
    blocks: PlantillaBloque[],
    tasa: number,
    multiplo: number,
    /** Optional map of product_id → variant groups. Used by 'variantes' template blocks. */
    productVariantsMap?: Record<string, ProductVariantGroup[]>,
    /** Optional map of product_id → structured content blocks. Rendered inside 'lista' blocks. */
    productContentBlocksMap?: Record<string, ProductContentBlock[]>
  ): Omit<PublicacionGenerada, 'id'>[] {
    const publications: Omit<PublicacionGenerada, 'id'>[] = [];

    const sortedBlocks = [...blocks].sort((a, b) => a.orden - b.orden);

    for (const cp of campaignProducts) {
      const product = products.find(p => p.id === cp.producto_id);
      if (!product) {
        throw new Error(`Producto referenciado no encontrado para el ítem de campaña ${cp.id}.`);
      }

      if (cp.usar_precio_manual && (cp.precio_manual_cup === null || cp.precio_manual_cup === undefined)) {
        throw new Error(`Precio manual inválido (null o undefined) para el producto ${product.nombre}.`);
      }

      const precios = PricingService.calcularPrecios(
        product.precio_usd,
        product.cantidad_por_caja || 1,
        tasa,
        multiplo,
        cp.usar_precio_manual,
        cp.precio_manual_cup
      );

      // Pre-compute backward-compat flags from the template blocks
      // If ANY bloque precio exists (visible or hidden), that block type
      // controls price rendering — lista must NOT include the price line.
      // Same for caja.
      const hasAnyPrecio = blocks.some(b => b.tipo === 'precio');
      const hasAnyCaja = blocks.some(b => b.tipo === 'caja');
      const hasImagenBlocks = blocks.some(b => b.tipo === 'imagen');
      const hasVisibleImagen = blocks.some(b => b.tipo === 'imagen' && b.visible);

      let texto = '';

      for (const block of sortedBlocks) {
        if (!block.visible) continue;

        if (block.tipo === 'texto') {
          if (block.titulo) texto += `*${block.titulo}*\n`;
          if (block.contenido) texto += `${block.contenido}\n\n`;
        } else if (block.tipo === 'separador') {
          texto += `------------------------\n\n`;
        } else if (block.tipo === 'lista') {
          texto += `📦 *${product.nombre}*\n`;
          if (product.marca) texto += `🔖 Marca: ${product.marca}\n`;

          // Backward compat: lista includes price/caja lines only when no
          // explicit block of that type exists at all in the template.
          // If ANY precio/caja block exists (even hidden), the explicit block
          // type controls rendering — lista must not duplicate it.
          let priceLines = '';
          if (!hasAnyPrecio) {
            priceLines += `💰 Precio: $${precios.precio_unitario_final_cup} CUP\n`;
          }
          if (!hasAnyCaja) {
            priceLines += `📦 Caja (${product.cantidad_por_caja} uds): $${precios.precio_caja_cup} CUP\n`;
          }
          if (priceLines) {
            texto += priceLines + '\n';
          }

          // Render per-product structured content blocks inside the detail section
          const contentBlocks = productContentBlocksMap?.[product.id];
          if (contentBlocks && contentBlocks.length > 0) {
            for (const cb of contentBlocks) {
              if (cb.tipo === 'texto') {
                if (cb.titulo) texto += `*${cb.titulo}*\n`;
                const firstItem = cb.items?.[0];
                if (firstItem?.valor) texto += `${firstItem.valor}\n`;
                texto += '\n';
              } else if (cb.tipo === 'lista') {
                if (cb.titulo) texto += `*${cb.titulo}*\n`;
                for (const item of cb.items) {
                  if (item.valor) texto += `• ${item.valor}\n`;
                }
                texto += '\n';
              } else if (cb.tipo === 'separador') {
                texto += `------------------------\n\n`;
              }
            }
          }
        } else if (block.tipo === 'variantes') {
          const variants = productVariantsMap?.[product.id];
          if (variants && variants.length > 0) {
            if (block.titulo) texto += `*${block.titulo}*\n`;
            for (const v of variants) {
              texto += `${v.tipo}\n`;
              for (const val of v.valores) {
                texto += `• ${val}\n`;
              }
            }
            texto += '\n';
          }
        } else if (block.tipo === 'precio') {
          texto += `💰 Precio: $${precios.precio_unitario_final_cup} CUP\n\n`;
        } else if (block.tipo === 'caja') {
          texto += `📦 Caja (${product.cantidad_por_caja} uds): $${precios.precio_caja_cup} CUP\n\n`;
        }
        // 'imagen' block produces no text output; it controls imagen_url below
      }

      publications.push({
        campaña_id: campaignId,
        campaña_producto_id: cp.id,
        texto_generado: texto.trim(),
        // If the template has no imagen block → legacy (always keep product image)
        // If it has one, use product.imagen_url only when at least one is visible
        imagen_url: hasImagenBlocks
          ? (hasVisibleImagen ? product.imagen_url : '')
          : product.imagen_url,
        precio_unitario_final_cup: precios.precio_unitario_final_cup,
        precio_caja_cup: precios.precio_caja_cup,
        cantidad_por_caja: product.cantidad_por_caja || 1
      });
    }

    return publications;
  }
}
