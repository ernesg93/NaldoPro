export interface Producto {
  id: string;
  nombre: string;
  categoria_id: string;
  marca?: string | null;
  imagen_url: string;
  precio_usd: number;
  cantidad_por_caja: number;
  estado: 'activo' | 'oculto' | 'agotado';
  created_at: Date;
  updated_at: Date;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string | null;
}

export interface VarianteTipo {
  id: string;
  nombre: string;
}

export interface VarianteValor {
  id: string;
  variante_tipo_id: string;
  valor: string;
}

export interface ProductoVariante {
  id: string;
  producto_id: string;
  variante_tipo_id: string;
}

export interface ProductoVarianteValor {
  id: string;
  producto_variante_id: string;
  variante_valor_id: string;
}

export interface BloqueContenido {
  id: string;
  producto_id: string;
  tipo: 'texto' | 'lista' | 'separador';
  titulo: string;
  orden: number;
}

export interface BloqueItem {
  id: string;
  bloque_id: string;
  valor: string;
  orden: number;
}

export interface Configuracion {
  id: string;
  tasa_usd_cup: number;
  redondeo_multiplo: number;
  whatsapp_numero: string;
  plantilla_default_id: string;
  updated_at: Date;
}

export interface Plantilla {
  id: string;
  nombre: string;
}

export type TipoBloque =
  | 'texto'
  | 'lista'
  | 'separador'
  | 'variantes'
  | 'imagen'
  | 'precio'
  | 'caja';

export interface PlantillaBloque {
  id: string;
  plantilla_id: string;
  tipo: TipoBloque;
  titulo: string; // Titulo descriptivo o titulo de la lista
  contenido?: string; // Contenido libre para bloques tipo texto
  orden: number;
  visible: boolean;
}

export interface Campaña {
  id: string;
  nombre: string;
  fecha_creacion: Date;
  tasa_usada: number;
  estado: 'borrador' | 'generada' | 'compartida';
}

export interface CampañaProducto {
  id: string;
  campaña_id: string;
  producto_id: string;
  orden: number;
  usar_precio_manual: boolean;
  precio_manual_cup?: number | null;
  estado_envio: 'pendiente' | 'enviado';
}

export interface CampañaGeneracion {
  id: string;
  campaña_id: string;
  fecha_generacion: Date;
  tasa_usada: number;
}

export interface PublicacionGenerada {
  id: string;
  campaña_id: string;
  campaña_producto_id: string;
  texto_generado: string;
  imagen_url: string;
  precio_unitario_final_cup: number;
  precio_caja_cup: number;
  cantidad_por_caja: number;
}
