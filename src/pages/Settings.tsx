import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SettingsService } from '../services/SettingsService';
import { Save, Info } from 'lucide-react';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [tasa_usd_cup, setTasa] = useState(350);
  const [redondeo_multiplo, setRedondeo] = useState(5);
  const [whatsapp_numero, setWhatsapp] = useState('');
  const [plantilla_default_id, setPlantilla] = useState('default-template');

  useEffect(() => {
    async function load() {
      try {
        let cfg = await SettingsService.getConfiguracion();
        if (!cfg) {
          await SettingsService.initializeDefaultConfig({
            tasa_usd_cup: 350,
            redondeo_multiplo: 5,
            whatsapp_numero: '',
            plantilla_default_id: 'default-template',
          });
          cfg = await SettingsService.getConfiguracion();
        }
        if (cfg) {
          setTasa(cfg.tasa_usd_cup);
          setRedondeo(cfg.redondeo_multiplo);
          setWhatsapp(cfg.whatsapp_numero);
          setPlantilla(cfg.plantilla_default_id);
        }
      } catch (err) {
        setError('Error al cargar configuración.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess(false);
      await SettingsService.updateConfiguracion({
        tasa_usd_cup,
        redondeo_multiplo,
        whatsapp_numero,
        plantilla_default_id,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control global del sistema
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200">
          Configuración guardada correctamente.
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tasa USD → CUP
          </label>
          <input
            type="number"
            value={tasa_usd_cup}
            onChange={(e) => setTasa(Number(e.target.value))}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Redondeo
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="redondeo"
                value={5}
                checked={redondeo_multiplo === 5}
                onChange={(e) => setRedondeo(Number(e.target.value))}
                className="text-gray-900 focus:ring-gray-900"
              />
              Múltiplo de 5
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="redondeo"
                value={10}
                checked={redondeo_multiplo === 10}
                onChange={(e) => setRedondeo(Number(e.target.value))}
                className="text-gray-900 focus:ring-gray-900"
              />
              Múltiplo de 10
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp destino
          </label>
          <input
            type="text"
            value={whatsapp_numero}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+53 XXXXXXXX"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plantilla por defecto
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={plantilla_default_id}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              readOnly
            />
            <Link
              to="/template"
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              Editar bloques
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
