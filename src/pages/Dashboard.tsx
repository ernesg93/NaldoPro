import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SettingsService, DEFAULT_CONFIG } from '../services/SettingsService';
import { ProductService } from '../services/ProductService';
import { CampaignService } from '../services/CampaignService';
import type { Configuracion, Campaña } from '../types';
import { Package, Megaphone, Settings, FileText, Plus } from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [config, setConfig] = useState<Configuracion | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaña[]>([]);

  useEffect(() => {
    async function load() {
      try {
        let cfg = await SettingsService.getConfiguracion();
        if (!cfg) {
          await SettingsService.initializeDefaultConfig({ ...DEFAULT_CONFIG });
          cfg = await SettingsService.getConfiguracion();
        }
        setConfig(cfg);

        const [products, campaigns] = await Promise.all([
          ProductService.getProducts(),
          CampaignService.getCampaigns(),
        ]);

        setProductCount(products.length);
        setCampaignCount(campaigns.length);
        setRecentCampaigns(campaigns.filter(c => c.estado !== 'borrador').slice(0, 5));
      } catch (err) {
        setError('Error al cargar el resumen del dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleNewCampaign = async () => {
    try {
      let cfg = config;
      if (!cfg) {
        await SettingsService.initializeDefaultConfig({ ...DEFAULT_CONFIG });
        cfg = await SettingsService.getConfiguracion();
      }
      const camp = await CampaignService.createCampaign(
        `Campaña ${new Date().toLocaleDateString()}`,
        cfg!.tasa_usd_cup,
      );
      navigate(`/campaigns/${camp.id}`);
    } catch (err) {
      setError('Error al crear campaña.');
    }
  };

  if (loading) {
    return <div className="text-center py-10">Cargando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen operativo del sistema</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Tasa USD → CUP</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            ${config?.tasa_usd_cup ?? DEFAULT_CONFIG.tasa_usd_cup}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Redondeo: múltiplo de {config?.redondeo_multiplo ?? DEFAULT_CONFIG.redondeo_multiplo}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Productos</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {productCount}
          </p>
          <Link
            to="/catalog"
            className="text-xs text-gray-500 hover:text-gray-900 mt-1 inline-block"
          >
            Ver catálogo &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Campañas</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {campaignCount}
          </p>
          <Link
            to="/campaigns"
            className="text-xs text-gray-500 hover:text-gray-900 mt-1 inline-block"
          >
            Ver campañas &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">WhatsApp</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">
            {config?.whatsapp_numero || '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Número destino</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/catalog"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Package className="w-6 h-6 text-gray-700" />
            <span className="text-sm font-medium text-gray-900">Catálogo</span>
          </Link>

          <button
            onClick={handleNewCampaign}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Megaphone className="w-6 h-6 text-gray-700" />
            <span className="text-sm font-medium text-gray-900">Nueva campaña</span>
          </button>

          <Link
            to="/settings"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-6 h-6 text-gray-700" />
            <span className="text-sm font-medium text-gray-900">Configuración</span>
          </Link>

          <Link
            to="/template"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-6 h-6 text-gray-700" />
            <span className="text-sm font-medium text-gray-900">Plantilla</span>
          </Link>
        </div>
      </div>

      {/* Recent campaigns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Campañas recientes</h2>
          <Link
            to="/campaigns"
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
          >
            Ver todas &rarr;
          </Link>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No hay campañas creadas aún.</p>
            <button
              onClick={handleNewCampaign}
              className="mt-3 inline-flex items-center gap-1 text-sm text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear primera campaña
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {recentCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/campaigns/${c.id}`}
                    className="block hover:bg-gray-50 transition-colors p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tasa: ${c.tasa_usada} CUP &middot;{' '}
                          {c.fecha_creacion.toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                          ${c.estado === 'compartida' ? 'bg-blue-100 text-blue-800' : ''}
                          ${c.estado === 'generada' ? 'bg-green-100 text-green-800' : ''}
                          ${c.estado === 'borrador' ? 'bg-amber-100 text-amber-800' : ''}`}
                      >
                        {c.estado === 'compartida' ? 'Enviada' : c.estado}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
