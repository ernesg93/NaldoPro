import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductService } from '../services/ProductService';
import { CategoryService } from '../services/CategoryService';
import type { Producto, Categoria } from '../types';
import { Search, Plus } from 'lucide-react';

export function Catalog() {
  const [products, setProducts] = useState<Producto[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const cats = await CategoryService.getCategories();
        setCategories(cats);
        
        const prods = await ProductService.getProducts();
        setProducts(prods);
      } catch (err) {
        console.error("Error cargando catálogo", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSeedCategories = async () => {
    if (window.confirm('¿Sembrar categorías iniciales (solo desarrollo)?')) {
      await CategoryService.seedInitialCategories();
      const cats = await CategoryService.getCategories();
      setCategories(cats);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory ? p.categoria_id === filterCategory : true;
    const matchesStatus = filterStatus ? p.estado === filterStatus : true;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-10">Cargando catálogo...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          {categories.length === 0 && import.meta.env.DEV && (
            <button 
              onClick={handleSeedCategories}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
            >
              Sembrar Categorías (Dev)
            </button>
          )}
        </div>
        <Link
          to="/product/new"
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="oculto">Ocultos</option>
          <option value="agotado">Agotados</option>
        </select>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No se encontraron productos.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredProducts.map(product => (
              <li key={product.id}>
                <Link to={`/product/${product.id}`} className="block hover:bg-gray-50 transition-colors p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                    <img 
                      src={product.imagen_url || 'https://via.placeholder.com/64?text=Foto'} 
                      alt={product.nombre} 
                      className="w-16 h-16 object-cover rounded-md border border-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.nombre}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {categories.find(c => c.id === product.categoria_id)?.nombre || 'Sin categoría'}
                        {product.marca ? ` • ${product.marca}` : ''}
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-sm font-medium text-gray-900">${product.precio_usd.toFixed(2)} USD</p>
                      <p className="text-xs text-gray-500">Caja: {product.cantidad_por_caja} ud</p>
                    </div>
                    <div className="sm:text-right min-w-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${product.estado === 'activo' ? 'bg-green-100 text-green-800' : 
                          product.estado === 'agotado' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {product.estado}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
