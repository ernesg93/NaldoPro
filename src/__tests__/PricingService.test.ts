import { describe, it, expect } from 'vitest';
import { PricingService } from '../services/PricingService';

describe('PricingService', () => {
  it('calcula precios estándar y redondea al múltiplo de 5 superior (Ejemplo del PRD)', () => {
    // Ejemplo PRD: precio_usd = 2.10, tasa = 405, redondeo = 5
    // Bruto = 2.10 * 405 = 850.50 -> Redondeo superior al 5 = 855
    const result = PricingService.calcularPrecios(2.10, 20, 405, 5, false);
    
    expect(result.precio_unitario_final_cup).toBe(855);
    expect(result.precio_caja_cup).toBe(17100); // 855 * 20
  });

  it('no altera el precio si ya es un múltiplo exacto del redondeo', () => {
    // 2.00 * 405 = 810 -> Ya es múltiplo de 5
    const result = PricingService.calcularPrecios(2.00, 10, 405, 5, false);
    
    expect(result.precio_unitario_final_cup).toBe(810);
    expect(result.precio_caja_cup).toBe(8100); // 810 * 10
  });

  it('aplica override manual de precio, ignorando el redondeo', () => {
    // Override con precio manual de 852 (no es múltiplo de 5)
    // cantidad_por_caja = 20
    const result = PricingService.calcularPrecios(2.10, 20, 405, 5, true, 852);
    
    expect(result.precio_unitario_final_cup).toBe(852);
    expect(result.precio_caja_cup).toBe(17040); // 852 * 20
  });

  it('lanza error si usar_precio_manual es true pero precio_manual_cup es nulo', () => {
    expect(() => {
      PricingService.calcularPrecios(2.10, 20, 405, 5, true, null);
    }).toThrow(/precio manual debe ser un número válido/);
  });

  it('calcula correctamente si no hay redondeo configurado (redondeo_multiplo = 0)', () => {
    // 2.10 * 405 = 850.50. Sin redondeo debe devolver eso exacto
    const result = PricingService.calcularPrecios(2.10, 20, 405, 0, false);
    
    expect(result.precio_unitario_final_cup).toBe(850.50);
    expect(result.precio_caja_cup).toBe(17010); // 850.50 * 20
  });

  it('redondea a un múltiplo diferente (ej. 10)', () => {
    // 2.10 * 405 = 850.50 -> Redondeo sup 10 = 860
    const result = PricingService.calcularPrecios(2.10, 20, 405, 10, false);
    
    expect(result.precio_unitario_final_cup).toBe(860);
    expect(result.precio_caja_cup).toBe(17200); // 860 * 20
  });

  it('lanza error si el precio usd es negativo', () => {
    expect(() => {
      PricingService.calcularPrecios(-5, 20, 405, 5, false);
    }).toThrow(/precio base en USD no puede ser negativo/);
  });

  it('lanza error si la cantidad por caja es 0 o menor', () => {
    expect(() => {
      PricingService.calcularPrecios(2.10, 0, 405, 5, false);
    }).toThrow(/cantidad por caja debe ser mayor que 0/);
    
    expect(() => {
      PricingService.calcularPrecios(2.10, -5, 405, 5, false);
    }).toThrow(/cantidad por caja debe ser mayor que 0/);
  });

  it('lanza error si la tasa de cambio es inválida', () => {
    expect(() => {
      PricingService.calcularPrecios(2.10, 20, 0, 5, false);
    }).toThrow(/tasa de cambio debe ser mayor que 0/);
  });

  it('lanza error si el múltiplo de redondeo es negativo', () => {
    expect(() => {
      PricingService.calcularPrecios(2.10, 20, 405, -5, false);
    }).toThrow(/múltiplo de redondeo no puede ser negativo/);
  });
});
