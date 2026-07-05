import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ProductService } from '../services/ProductService';
import { CategoryService } from '../services/CategoryService';
import { StorageService } from '../services/StorageService';
import type { Categoria } from '../types';
import { ArrowLeft, Upload } from 'lucide-react';

export function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Categoria[]>([]);
  
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [marca, setMarca] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [precioUsd, setPrecioUsd] = useState('0');
  const [cantidadCaja, setCantidadCaja] = useState('1');
  const [estado, setEstado] = useState<'activo'|'oculto'|'agotado'>('activo');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const cats = await CategoryService.getCategories();
        setCategories(cats);
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
        }
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isNew]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setError('');
      const url = await StorageService.uploadImage(file);
      setImagenUrl(url);
    } catch (err: any) {
      setError(err.message || 'Error al subir imagen. ¿Está Firebase Storage configurado correctamente?');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      
      const pUsd = parseFloat(precioUsd);
      const cCaja = parseInt(cantidadCaja, 10);
      
      if (!nombre.trim()) throw new Error("Nombre requerido");
      if (!categoriaId) throw new Error("Debe seleccionar una categoría válida");
      if (!imagenUrl) throw new Error("Imagen requerida (sube una foto)");
      if (isNaN(pUsd) || pUsd < 0) throw new Error("Precio USD inválido (>=0)");
      if (isNaN(cCaja) || cCaja <= 0) throw new Error("Cantidad por caja inválida (>0)");

      const productData = {
        nombre: nombre.trim(),
        categoria_id: categoriaId,
        marca: marca.trim() || null,
        imagen_url: imagenUrl,
        precio_usd: pUsd,
        cantidad_por_caja: cCaja,
        estado
      };

      if (isNew) {
        await ProductService.createProduct(productData);
      } else if (id) {
        await ProductService.updateProduct(id, productData);
      }
      navigate('/catalog');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-500 font-medium">Cargando...</div>;

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
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

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
                <p className="mt-2 text-xs text-gray-500">
                  La imagen es obligatoria.
                </p>
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
