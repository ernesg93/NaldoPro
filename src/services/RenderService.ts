import type { Producto, CampañaProducto, PlantillaBloque, PublicacionGenerada } from '../types';
import { PricingService } from './PricingService';

export class RenderService {
  static generatePublications(
    campaignId: string,
    campaignProducts: CampañaProducto[],
    products: Producto[],
    blocks: PlantillaBloque[],
    tasa: number,
    multiplo: number
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
          texto += `💰 Precio: $${precios.precio_unitario_final_cup} CUP\n`;
          texto += `📦 Caja (${product.cantidad_por_caja} uds): $${precios.precio_caja_cup} CUP\n\n`;
        }
      }

      publications.push({
        campaña_id: campaignId,
        campaña_producto_id: cp.id,
        texto_generado: texto.trim(),
        imagen_url: product.imagen_url,
        precio_unitario_final_cup: precios.precio_unitario_final_cup,
        precio_caja_cup: precios.precio_caja_cup,
        cantidad_por_caja: product.cantidad_por_caja || 1
      });
    }

    return publications;
  }
}
