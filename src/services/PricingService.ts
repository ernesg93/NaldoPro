/**
 * Módulo de Cálculo de Precios (Motor puro, sin persistencia)
 */
export class PricingService {
  /**
   * Calcula el precio unitario y por caja aplicando la tasa, reglas de redondeo y overrides manuales.
   *
   * Reglas documentadas en el PRD:
   * 1. Cálculo estándar (sin manual): (precio_usd * tasa) y redondeo superior al múltiplo configurado.
   * 2. Override manual: precio_manual_cup se usa directamente sin redondeo.
   * 3. Precio caja = precio_unitario_final_cup * cantidad_por_caja.
   */
  static calcularPrecios(
    precio_usd: number,
    cantidad_por_caja: number,
    tasa_usd_cup: number,
    redondeo_multiplo: number,
    usar_precio_manual: boolean,
    precio_manual_cup?: number | null
  ): { precio_unitario_final_cup: number; precio_caja_cup: number } {
    
    if (precio_usd < 0) {
      throw new Error("El precio base en USD no puede ser negativo.");
    }
    if (cantidad_por_caja <= 0) {
      throw new Error("La cantidad por caja debe ser mayor que 0.");
    }
    if (tasa_usd_cup <= 0) {
      throw new Error("La tasa de cambio debe ser mayor que 0.");
    }
    if (redondeo_multiplo < 0) {
      throw new Error("El múltiplo de redondeo no puede ser negativo.");
    }

    // 1. Si existe override manual
    if (usar_precio_manual) {
      if (typeof precio_manual_cup !== 'number' || precio_manual_cup < 0) {
        throw new Error("El precio manual debe ser un número válido mayor o igual a 0 cuando usar_precio_manual es true.");
      }
      return {
        precio_unitario_final_cup: precio_manual_cup,
        precio_caja_cup: precio_manual_cup * cantidad_por_caja,
      };
    }

    // 2. Cálculo estándar
    const precioBrutoCUP = precio_usd * tasa_usd_cup;
    let precio_unitario_final_cup = precioBrutoCUP;

    // Redondeo al múltiplo superior más cercano (si el múltiplo es válido > 0)
    // 0 significa "sin redondeo"
    if (redondeo_multiplo > 0) {
      precio_unitario_final_cup = Math.ceil(precioBrutoCUP / redondeo_multiplo) * redondeo_multiplo;
    }

    return {
      precio_unitario_final_cup,
      precio_caja_cup: precio_unitario_final_cup * cantidad_por_caja,
    };
  }
}
