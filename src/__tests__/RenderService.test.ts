import { describe, it, expect } from 'vitest';
import { RenderService } from '../services/RenderService';
import type { CampañaProducto, Producto, PlantillaBloque } from '../types';

describe('RenderService', () => {
  const dummyProducts: Producto[] = [
    {
      id: 'prod1',
      nombre: 'Producto 1',
      categoria_id: 'cat1',
      imagen_url: 'img1.jpg',
      precio_usd: 10,
      cantidad_por_caja: 5,
      estado: 'activo',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'prod2',
      nombre: 'Producto 2',
      categoria_id: 'cat1',
      marca: 'Marca 2',
      imagen_url: 'img2.jpg',
      precio_usd: 20,
      cantidad_por_caja: 10,
      estado: 'activo',
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  const dummyBlocks: PlantillaBloque[] = [
    { id: 'b1', plantilla_id: 't1', tipo: 'texto', titulo: 'Saludo', contenido: 'Hola mundo', orden: 1, visible: true },
    { id: 'b2', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 2, visible: true },
    { id: 'b3', plantilla_id: 't1', tipo: 'separador', titulo: '', orden: 3, visible: true },
    { id: 'b4', plantilla_id: 't1', tipo: 'texto', titulo: 'Invisible', contenido: 'No debe verse', orden: 4, visible: false }
  ];

  it('debe generar publicación con cálculo de precios estándar', () => {
    const cp: CampañaProducto = {
      id: 'cp1',
      campaña_id: 'camp1',
      producto_id: 'prod1',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50);
    
    expect(pubs.length).toBe(1);
    expect(pubs[0].campaña_id).toBe('camp1');
    expect(pubs[0].precio_unitario_final_cup).toBe(3500); // 10 * 350
    expect(pubs[0].precio_caja_cup).toBe(17500); // 3500 * 5
    expect(pubs[0].cantidad_por_caja).toBe(5);
    
    // Verificamos que contenga bloques de texto, lista y separador, omitiendo el invisible
    expect(pubs[0].texto_generado).toContain('*Saludo*');
    expect(pubs[0].texto_generado).toContain('Hola mundo');
    expect(pubs[0].texto_generado).toContain('📦 *Producto 1*');
    expect(pubs[0].texto_generado).toContain('💰 Precio: $3500 CUP');
    expect(pubs[0].texto_generado).toContain('📦 Caja (5 uds): $17500 CUP');
    expect(pubs[0].texto_generado).toContain('------------------------');
    expect(pubs[0].texto_generado).not.toContain('Invisible');
  });

  it('debe respetar el orden de los bloques', () => {
    const cp: CampañaProducto = { id: 'cp1', campaña_id: 'camp1', producto_id: 'prod1', orden: 1, usar_precio_manual: false, estado_envio: 'pendiente' };
    
    const outOfOrderBlocks: PlantillaBloque[] = [
      { id: 'b2', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 2, visible: true },
      { id: 'b1', plantilla_id: 't1', tipo: 'texto', titulo: 'Primero', contenido: 'Contenido 1', orden: 1, visible: true }
    ];

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, outOfOrderBlocks, 350, 50);
    
    const indexOfText = pubs[0].texto_generado.indexOf('Primero');
    const indexOfList = pubs[0].texto_generado.indexOf('Producto 1');
    
    expect(indexOfText).toBeLessThan(indexOfList);
  });

  it('debe usar precio manual si está configurado y no aplicar redondeo a este', () => {
    const cp: CampañaProducto = {
      id: 'cp2',
      campaña_id: 'camp1',
      producto_id: 'prod2',
      orden: 1,
      usar_precio_manual: true,
      precio_manual_cup: 8000.5,
      estado_envio: 'pendiente'
    };

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50);
    
    expect(pubs.length).toBe(1);
    expect(pubs[0].precio_unitario_final_cup).toBe(8000.5);
    expect(pubs[0].precio_caja_cup).toBe(80005); // 8000.5 * 10
    expect(pubs[0].cantidad_por_caja).toBe(10);
    expect(pubs[0].texto_generado).toContain('💰 Precio: $8000.5 CUP');
  });

  it('debe lanzar error si usar_precio_manual es true pero precio_manual_cup no está definido', () => {
    const cp: CampañaProducto = {
      id: 'cp2',
      campaña_id: 'camp1',
      producto_id: 'prod2',
      orden: 1,
      usar_precio_manual: true,
      // precio_manual_cup is undefined
      estado_envio: 'pendiente'
    };

    expect(() => {
      RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50);
    }).toThrow(/Precio manual inválido/);
  });

  it('debe lanzar error si el producto referenciado no existe', () => {
    const cp: CampañaProducto = {
      id: 'cp_invalid',
      campaña_id: 'camp1',
      producto_id: 'prod_inexistente',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };

    expect(() => {
      RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50);
    }).toThrow(/Producto referenciado no encontrado/);
  });
});
