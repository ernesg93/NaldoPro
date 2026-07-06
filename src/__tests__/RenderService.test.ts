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

  it('debe renderizar variantes cuando existe un bloque variantes y el mapa es provisto', () => {
    const cp: CampañaProducto = {
      id: 'cp1',
      campaña_id: 'camp1',
      producto_id: 'prod1',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };

    const blocksWithVariants: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'texto', titulo: 'Saludo', contenido: 'Hola mundo', orden: 1, visible: true },
      { id: 'b2', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 2, visible: true },
      { id: 'b3', plantilla_id: 't1', tipo: 'variantes', titulo: 'Variantes disponibles', orden: 3, visible: true },
    ];

    const variantMap: Record<string, import('../services/RenderService').ProductVariantGroup[]> = {
      prod1: [
        { tipo: 'Sabores', valores: ['Chocolate', 'Vainilla'] },
        { tipo: 'Tamaños', valores: ['200 g', '500 g'] },
      ],
    };

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, blocksWithVariants, 350, 50, variantMap);

    expect(pubs.length).toBe(1);
    expect(pubs[0].texto_generado).toContain('*Variantes disponibles*');
    expect(pubs[0].texto_generado).toContain('Sabores');
    expect(pubs[0].texto_generado).toContain('• Chocolate');
    expect(pubs[0].texto_generado).toContain('• Vainilla');
    expect(pubs[0].texto_generado).toContain('Tamaños');
    expect(pubs[0].texto_generado).toContain('• 200 g');
    expect(pubs[0].texto_generado).toContain('• 500 g');
  });

  it('debe renderizar bloques de contenido estructurado dentro del bloque lista', () => {
    const cp: CampañaProducto = {
      id: 'cp1',
      campaña_id: 'camp1',
      producto_id: 'prod1',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };

    const contentBlocksMap: Record<string, import('../services/RenderService').ProductContentBlock[]> = {
      prod1: [
        { tipo: 'texto', titulo: 'Descripción', items: [{ valor: 'Producto de alta calidad' }] },
        { tipo: 'lista', titulo: 'Características', items: [{ valor: 'Ligero' }, { valor: 'Durable' }] },
        { tipo: 'separador', titulo: '', items: [] },
      ],
    };

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50, undefined, contentBlocksMap);

    expect(pubs.length).toBe(1);
    // Content blocks appear after the product detail section (inside lista block)
    expect(pubs[0].texto_generado).toContain('*Descripción*');
    expect(pubs[0].texto_generado).toContain('Producto de alta calidad');
    expect(pubs[0].texto_generado).toContain('*Características*');
    expect(pubs[0].texto_generado).toContain('• Ligero');
    expect(pubs[0].texto_generado).toContain('• Durable');
    // Still contains normal precio and caja (unchanged by content blocks)
    expect(pubs[0].texto_generado).toContain('💰 Precio: $3500 CUP');
    expect(pubs[0].texto_generado).toContain('📦 Caja (5 uds): $17500 CUP');
  });

  it('debe mantener compatibilidad hacia atrás cuando los mapas opcionales se omiten', () => {
    const cp: CampañaProducto = {
      id: 'cp1',
      campaña_id: 'camp1',
      producto_id: 'prod1',
      orden: 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };

    // Both old 6-arg and new 8-arg signatures without extra maps
    const pubs6 = RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50);
    const pubs8 = RenderService.generatePublications('camp1', [cp], dummyProducts, dummyBlocks, 350, 50, undefined, undefined);

    expect(pubs6.length).toBe(1);
    expect(pubs8.length).toBe(1);
    expect(pubs6[0].texto_generado).toEqual(pubs8[0].texto_generado);
    expect(pubs6[0].precio_unitario_final_cup).toBe(pubs8[0].precio_unitario_final_cup);
    expect(pubs6[0].texto_generado).toContain('Hola mundo');
    expect(pubs6[0].texto_generado).toContain('📦 *Producto 1*');
  });

  it('debe renderizar bloque precio explícito sin duplicación desde lista', () => {
    const cp: CampañaProducto = {
      id: 'cp1', campaña_id: 'camp1', producto_id: 'prod1', orden: 1,
      usar_precio_manual: false, estado_envio: 'pendiente'
    };

    const blocks: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 1, visible: true },
      { id: 'b2', plantilla_id: 't1', tipo: 'precio', titulo: 'Precio', orden: 2, visible: true },
      { id: 'b3', plantilla_id: 't1', tipo: 'caja', titulo: 'Caja', orden: 3, visible: true },
    ];

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, blocks, 350, 50);

    // precio and caja appear exactly once (from the explicit blocks, not duplicated from lista)
    const matchesPrecio = (pubs[0].texto_generado.match(/💰 Precio:/g) || []).length;
    const matchesCaja = (pubs[0].texto_generado.match(/📦 Caja \(/g) || []).length;
    expect(matchesPrecio).toBe(1);
    expect(matchesCaja).toBe(1);

    // Verify the content from the explicit blocks
    expect(pubs[0].texto_generado).toContain('💰 Precio: $3500 CUP');
    expect(pubs[0].texto_generado).toContain('📦 Caja (5 uds): $17500 CUP');

    // Verify the product name line from lista is still there
    expect(pubs[0].texto_generado).toContain('📦 *Producto 1*');
  });

  it('debe mantener compatibilidad con lista-sin-explicitos (precio/caja desde lista)', () => {
    const cp: CampañaProducto = {
      id: 'cp1', campaña_id: 'camp1', producto_id: 'prod1', orden: 1,
      usar_precio_manual: false, estado_envio: 'pendiente'
    };

    // Template with only lista — should include price/caja inside lista (legacy compat)
    const blocks: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 1, visible: true },
    ];

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, blocks, 350, 50);

    expect(pubs[0].texto_generado).toContain('💰 Precio: $3500 CUP');
    expect(pubs[0].texto_generado).toContain('📦 Caja (5 uds): $17500 CUP');
    expect(pubs[0].texto_generado).toContain('📦 *Producto 1*');
  });

  it('debe suprimir precio y caja de lista cuando existen bloques explícitos ocultos', () => {
    const cp: CampañaProducto = {
      id: 'cp1', campaña_id: 'camp1', producto_id: 'prod1', orden: 1,
      usar_precio_manual: false, estado_envio: 'pendiente'
    };

    // Template with lista + hidden precio + hidden caja
    const blocks: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'lista', titulo: '', orden: 1, visible: true },
      { id: 'b2', plantilla_id: 't1', tipo: 'precio', titulo: 'Precio', orden: 2, visible: false },
      { id: 'b3', plantilla_id: 't1', tipo: 'caja', titulo: 'Caja', orden: 3, visible: false },
    ];

    const pubs = RenderService.generatePublications('camp1', [cp], dummyProducts, blocks, 350, 50);

    // Product name from lista should still render
    expect(pubs[0].texto_generado).toContain('📦 *Producto 1*');

    // Since explicit precio/caja blocks exist (even hidden), lista must NOT
    // render those lines — and the hidden blocks don't render either.
    expect(pubs[0].texto_generado).not.toContain('💰 Precio:');
    expect(pubs[0].texto_generado).not.toContain('📦 Caja (');
  });

  it('debe controlar imagen_url según presencia/visibilidad del bloque imagen', () => {
    const cp: CampañaProducto = {
      id: 'cp1', campaña_id: 'camp1', producto_id: 'prod1', orden: 1,
      usar_precio_manual: false, estado_envio: 'pendiente'
    };

    // Test 1: sin bloque imagen → imagen_url hereda de producto (legacy)
    const blocksNoImagen: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'texto', titulo: 'T', contenido: 'C', orden: 1, visible: true },
    ];
    const pubs1 = RenderService.generatePublications('camp1', [cp], dummyProducts, blocksNoImagen, 350, 50);
    expect(pubs1[0].imagen_url).toBe('img1.jpg');

    // Test 2: bloque imagen visible → imagen_url = product.imagen_url
    const blocksVisible: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'imagen', titulo: 'Img', orden: 1, visible: true },
    ];
    const pubs2 = RenderService.generatePublications('camp1', [cp], dummyProducts, blocksVisible, 350, 50);
    expect(pubs2[0].imagen_url).toBe('img1.jpg');

    // Test 3: bloque imagen oculto → imagen_url = ''
    const blocksHidden: PlantillaBloque[] = [
      { id: 'b1', plantilla_id: 't1', tipo: 'imagen', titulo: 'Img', orden: 1, visible: false },
    ];
    const pubs3 = RenderService.generatePublications('camp1', [cp], dummyProducts, blocksHidden, 350, 50);
    expect(pubs3[0].imagen_url).toBe('');
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
