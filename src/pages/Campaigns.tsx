import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CampaignService } from '../services/CampaignService';
import { SettingsService, DEFAULT_CONFIG } from '../services/SettingsService';
import type { Campaña } from '../types';
import { Plus } from 'lucide-react';

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaña[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const data = await CampaignService.getCampaigns();
      setCampaigns(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleCreate = async () => {
    let config = await SettingsService.getConfiguracion();
    if (!config) {
      await SettingsService.initializeDefaultConfig({ ...DEFAULT_CONFIG });
      config = await SettingsService.getConfiguracion();
    }
    const camp = await CampaignService.createCampaign(`Campaña ${new Date().toLocaleDateString()}`, config!.tasa_usd_cup);
    navigate(`/campaigns/${camp.id}`);
  };

  if (loading) return <div className="p-8 text-center">Cargando campañas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
        <button onClick={handleCreate} className="bg-gray-900 text-white min-h-11 px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />
          Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <Link key={c.id} to={`/campaigns/${c.id}`} className="block bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
            <h3 className="font-semibold text-lg text-gray-900">{c.nombre}</h3>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-gray-600">
                Estado: <span className={`font-medium capitalize ${c.estado === 'compartida' ? 'text-blue-600' : c.estado === 'generada' ? 'text-green-600' : 'text-amber-600'}`}>
                  {c.estado === 'compartida' ? 'Enviada' : c.estado}
                </span>
              </p>
              <p className="text-sm text-gray-600">Tasa usada: ${c.tasa_usada} CUP</p>
              <p className="text-xs text-gray-400 pt-2">{c.fecha_creacion.toLocaleDateString()}</p>
            </div>
          </Link>
        ))}
        {campaigns.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 border-dashed rounded-lg">
            No hay campañas creadas aún.
          </div>
        )}
      </div>
    </div>
  );
}
