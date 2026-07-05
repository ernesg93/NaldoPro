import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ProductService } from '../services/ProductService';
import { CategoryService } from '../services/CategoryService';
import { VariantService } from '../services/VariantService';
import { ContentBlockService } from '../services/ContentBlockService';
import { StorageService } from '../services/StorageService';
import type { Categoria, VarianteTipo, VarianteValor } from '../types';
import {
  ArrowLeft, Upload, Plus, Trash2, GripVertical, Info
} from 'lucide-react';

/* ───── local draft types ───── */

interface ContentBlockDraft {
  tempId: string;
  tipo: 'texto' | 'lista' | 'separador';
  titulo: string;
  orden: number;
  items: BlockItemDraft[];
}

interface BlockItemDraft {
  tempId: string;
  valor: string;
  orden: number;
}

/* ───── helpers ───── */

let _tempIdCounter = 0;
function nextTempId(): string {
  _tempIdCounter += 1;
  return `tmp-${_tempIdCounter}-${Date.now()}`;
}

/* ───── component ───── */

export function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();

  /* basic fields */
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [marca, setMarca] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [precioUsd, setPrecioUsd] = useState('0');
  const [cantidadCaja, setCantidadCaja] = useState('1');
  const [estado, setEstado] = useState<'activo' | 'oculto' | 'agotado'>('activo');

  /* variant state */
  const [variantTypes, setVariantTypes] = useState<VarianteTipo[]>([]);
  const [variantValues, setVariantValues] = useState<VarianteValor[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string[]>>({});

  /* content block state */
  const [contentBlocks, setContentBlocks] = useState<ContentBlockDraft[]>([]);

  /* ui */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ───── load ───── */

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, vTypes, vValues] = await Promise.all([
          CategoryService.getCategories(),
          VariantService.getVariantTypes(),
          VariantService.getVariantValues(),
        ]);
        setCategories(cats);
        setVariantTypes(vTypes);
        setVariantValues(vValues);

        if (cats.length > 0 && isNew) {
          setCategoriaId(cats[0].id);
        }

        if (!isNew && id) {
          const prod = await ProductService.getProduct(id);
          if (prod) {
            setNombre(prod.nombre);
            setCategoriaId(prod.categoria_id);
            setMarca(prod.marca || '');
            setImagenUrl(prod.imagen_url);
            setPrecioUsd(prod.precio_usd.toString());
            setCantidadCaja(prod.cantidad_por_caja.toString());
            setEstado(prod.estado);
          } else {
            setError('Producto no encontrado');
          }

          // Load existing variant selections
          const existingVariants = await VariantService.getSelectedValueIds(id);
          setSelectedVariants(existingVariants);

          // Load existing content blocks with items
          const existingBlocks = await ContentBlockService.getContentBlocksWithItems(id);
          const drafts: ContentBlockDraft[] = existingBlocks.map(({ block, items }) => ({
            tempId: nextTempId(),
            tipo: block.tipo,
            titulo: block.titulo,
            orden: block.orden,
            items: items.map(item => ({
              tempId: nextTempId(),
              valor: item.valor,
              orden: item.orden,
            })),
          }));
          setContentBlocks(drafts);
        }
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isNew]);

  /* ───── helpers: seed ───── */

  const handleSeedVariants = useCallback(async () => {
    try {
      await VariantService.seedInitialVariantData();
      const [vTypes, vValues] = await Promise.all([
        VariantService.getVariantTypes(),
        VariantService.getVariantValues(),
      ]);
      setVariantTypes(vTypes);
      setVariantValues(vValues);
    } catch (err: any) {
      setError(err.message || 'Error al sembrar variantes.');
    }
  }, []);

  /* ───── handlers: image ───── */

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const url = await StorageService.uploadImage(file);
      setImagenUrl(url);
    } catch (err: any) {
      setError(err.message || 'Error al subir imagen.');
    } finally {
      setUploading(false);
    }
  };

  /* ───── handlers: variants ───── */

  const toggleVariantValue = (tipoId: string, valorId: string) => {
    setSelectedVariants(prev => {
      const current = prev[tipoId] ?? [];
      const next = current.includes(valorId)
        ? current.filter(v => v !== valorId)
        : [...current, valorId];
      return { ...prev, [tipoId]: next };
    });
  };

  /* ───── helpers: variant values lookup ───── */

  const valuesForType = useCallback(
    (tipoId: string): VarianteValor[] =>
      variantValues.filter(v => v.variante_tipo_id === tipoId),
    [variantValues]
  );

  /* ───── handlers: content blocks ───── */

  const addContentBlock = () => {
    const newBlock: ContentBlockDraft = {
      tempId: nextTempId(),
      tipo: 'texto',
      titulo: '',
      orden: contentBlocks.length + 1,
      items: [{ tempId: nextTempId(), valor: '', orden: 1 }],
    };
    setContentBlocks([...contentBlocks, newBlock]);
  };

  const removeContentBlock = (tempId: string) => {
    setContentBlocks(prev =>
      prev.filter(b => b.tempId !== tempId).map((b, i) => ({ ...b, orden: i + 1 }))
    );
  };

  const updateBlockField = (
    tempId: string,
    field: keyof Pick<ContentBlockDraft, 'tipo' | 'titulo'>,
    value: any
  ) => {
    setContentBlocks(prev =>
      prev.map(b => {
        if (b.tempId !== tempId) return b;
        const updated = { ...b, [field]: value };
        // When switching to texto ensure at least one item; for separador clear items
        if (field === 'tipo') {
          if (value === 'separador') {
            updated.items = [];
          } else if (value === 'texto' && updated.items.length === 0) {
            updated.items = [{ tempId: nextTempId(), valor: '', orden: 1 }];
          } else if (value === 'lista' && updated.items.length === 0) {
            updated.items = [{ tempId: nextTempId(), valor: '', orden: 1 }];
          }
        }
        return updated;
      })
    );
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === contentBlocks.length - 1) return;
    const next = [...contentBlocks];
    const target = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[target]] = [next[target], next[index]];
    setContentBlocks(next.map((b, i) => ({ ...b, orden: i + 1 })));
  };

  /* ───── block items ───── */

  const addBlockItem = (blockTempId: string) => {
    setContentBlocks(prev =>
      prev.map(b => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          items: [...b.items, { tempId: nextTempId(), valor: '', orden: b.items.length + 1 }],
        };
      })
    );
  };

  const removeBlockItem = (blockTempId: string, itemTempId: string) => {
    setContentBlocks(prev =>
      prev.map(b => {
        if (b.tempId !== blockTempId) return b;
        const items = b.items
          .filter(i => i.tempId !== itemTempId)
          .map((i, idx) => ({ ...i, orden: idx + 1 }));
        return { ...b, items };
      })
    );
  };

  const updateBlockItem = (blockTempId: string, itemTempId: string, valor: string) => {
    setContentBlocks(prev =>
      prev.map(b => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          items: b.items.map(i => (i.tempId === itemTempId ? { ...i, valor } : i)),
        };
      })
    );
  };

  /* ───── submit ───── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');

      const pUsd = parseFloat(precioUsd);
      const cCaja = parseInt(cantidadCaja, 10);

      if (!nombre.trim()) throw new Error('Nombre requerido');
      if (!categoriaId) throw new Error('Debe seleccionar una categoría válida');
      if (!imagenUrl) throw new Error('Imagen requerida (sube una foto)');
      if (isNaN(pUsd) || pUsd < 0) throw new Error('Precio USD inválido (>=0)');
      if (isNaN(cCaja) || cCaja <= 0) throw new Error('Cantidad por caja inválida (>0)');

      const productData = {
        nombre: nombre.trim(),
        categoria_id: categoriaId,
        marca: marca.trim() || null,
        imagen_url: imagenUrl,
        precio_usd: pUsd,
        cantidad_por_caja: cCaja,
        estado,
      };

      let productId: string;

      if (isNew) {
        productId = await ProductService.createProduct(productData);
      } else if (id) {
        productId = id;
        await ProductService.updateProduct(productId, productData);
      } else {
        throw new Error('Estado de edición inválido');
      }

      // Save variants in a batch
      await VariantService.saveProductVariants(productId, selectedVariants);

      // Save content blocks in a batch
      const blocksForSave = contentBlocks.map(b => ({
        tipo: b.tipo,
        titulo: b.titulo,
        orden: b.orden,
        items: b.items.length > 0
          ? b.items.map(i => ({ valor: i.valor, orden: i.orden }))
          : undefined,
      }));
      await ContentBlockService.saveContentBlocks(productId, blocksForSave);

      navigate('/catalog');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /* ───── render ───── */

  if (loading) {
    return <div className="text-center py-10 text-gray-500 font-medium">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/catalog" className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Nuevo producto' : 'Editar producto'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
        )}

        {/* ──── basic fields ──── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2 space-y-4">
            <label className="block text-sm font-medium text-gray-700">Imagen del producto</label>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50 overflow-hidden">
                {imagenUrl ? (
                  <img src={imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm px-2 text-center">Sin imagen</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                </button>
                <p className="mt-2 text-xs text-gray-500">La imagen es obligatoria.</p>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca (Opcional)</label>
            <input
              type="text"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio USD</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={precioUsd}
              onChange={(e) => setPrecioUsd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad por caja</label>
            <input
              type="number"
              min="1"
              required
              value={cantidadCaja}
              onChange={(e) => setCantidadCaja(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <div className="flex gap-4">
              {['activo', 'oculto', 'agotado'].map((st) => (
                <label key={st} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="estado"
                    value={st}
                    checked={estado === st}
                    onChange={(e) => setEstado(e.target.value as any)}
                    className="text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-900 capitalize">{st}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ──── VARIANTES ──── */}
        <div className="pt-6 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Variantes</h2>

          {variantTypes.length === 0 && import.meta.env.DEV && (
            <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-800 flex items-center justify-between">
              <span>No hay tipos de variante definidos.</span>
              <button
                type="button"
                onClick={handleSeedVariants}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
              >
                Sembrar datos de ejemplo (Dev)
              </button>
            </div>
          )}

          {variantTypes.length === 0 && !import.meta.env.DEV && (
            <p className="text-sm text-gray-500 italic">
              No hay variantes configuradas. Agrega tipos de variante desde Configuración.
            </p>
          )}

          {variantTypes.length > 0 && (
            <div className="space-y-4">
              {variantTypes.map(tipo => {
                const values = valuesForType(tipo.id);
                const selected = selectedVariants[tipo.id] ?? [];
                return (
                  <fieldset key={tipo.id} className="border border-gray-200 rounded-md p-3">
                    <legend className="text-sm font-medium text-gray-700 px-1">{tipo.nombre}</legend>
                    {values.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin valores definidos</p>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {values.map(valor => {
                          const isChecked = selected.includes(valor.id);
                          return (
                            <label key={valor.id} className="flex items-center gap-1.5 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleVariantValue(tipo.id, valor.id)}
                                className="rounded text-gray-900 focus:ring-gray-900"
                              />
                              {valor.valor}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
          )}
        </div>

        {/* ──── BLOQUES DE CONTENIDO ──── */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Bloques de contenido</h2>
            <button
              type="button"
              onClick={addContentBlock}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir bloque
            </button>
          </div>

          {contentBlocks.length === 0 && (
            <p className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-md">
              Aún no hay bloques de contenido. Presiona "Añadir bloque" para comenzar.
            </p>
          )}

          <div className="space-y-3">
            {contentBlocks.map((block, index) => (
              <div
                key={block.tempId}
                className="flex items-start gap-3 bg-gray-50 p-4 rounded-md border border-gray-200 group"
              >
                {/* reorder */}
                <div className="flex flex-col gap-1 mt-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 'down')}
                    disabled={index === contentBlocks.length - 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <GripVertical className="w-4 h-4 rotate-180" />
                  </button>
                </div>

                {/* block body */}
                <div className="flex-1 space-y-3">
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                      <select
                        value={block.tipo}
                        onChange={(e) => updateBlockField(block.tempId, 'tipo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                      >
                        <option value="texto">Texto</option>
                        <option value="lista">Lista</option>
                        <option value="separador">Separador</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
                      <input
                        type="text"
                        value={block.titulo}
                        onChange={(e) => updateBlockField(block.tempId, 'titulo', e.target.value)}
                        placeholder={
                          block.tipo === 'separador'
                            ? 'Referencia del separador'
                            : block.tipo === 'lista'
                              ? 'Ej. Sabores disponibles'
                              : 'Título del bloque'
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  {/* block items */}
                  {block.tipo === 'texto' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Contenido</label>
                      <textarea
                        value={block.items[0]?.valor ?? ''}
                        onChange={(e) => {
                          if (block.items.length > 0) {
                            updateBlockItem(block.tempId, block.items[0].tempId, e.target.value);
                          }
                        }}
                        placeholder="Escribe el texto aquí..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
                      />
                    </div>
                  )}

                  {block.tipo === 'lista' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-500">Elementos de la lista</label>
                      {block.items.map((item) => (
                        <div key={item.tempId} className="flex items-center gap-2">
                          <span className="text-gray-400">•</span>
                          <input
                            type="text"
                            value={item.valor}
                            onChange={(e) => updateBlockItem(block.tempId, item.tempId, e.target.value)}
                            placeholder="Valor del elemento"
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => removeBlockItem(block.tempId, item.tempId)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar elemento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBlockItem(block.tempId)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Agregar elemento
                      </button>
                    </div>
                  )}

                  {block.tipo === 'separador' && (
                    <div className="border-t border-dashed border-gray-300 pt-2 text-xs text-gray-400 italic">
                      Separador visual
                    </div>
                  )}
                </div>

                {/* delete */}
                <button
                  type="button"
                  onClick={() => removeContentBlock(block.tempId)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar bloque"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ──── action buttons ──── */}
        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
          <Link
            to="/catalog"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
