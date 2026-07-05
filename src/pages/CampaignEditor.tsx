import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CampaignService } from '../services/CampaignService';
import { ProductService } from '../services/ProductService';
import { TemplateService } from '../services/TemplateService';
import { SettingsService } from '../services/SettingsService';
import { RenderService } from '../services/RenderService';
import type { Campaña, CampañaProducto, Producto } from '../types';
import { Save, Play, GripVertical, Trash2, Plus, Share2 } from 'lucide-react';

export function CampaignEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState<Campaña | null>(null);
  const [campaignProducts, setCampaignProducts] = useState<CampañaProducto[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [camp, cProducts, allProds] = await Promise.all([
        CampaignService.getCampaign(id),
        CampaignService.getCampaignProducts(id),
        ProductService.getProducts()
      ]);
      setCampaign(camp);
      setCampaignProducts(cProducts.sort((a,b) => a.orden - b.orden));
      setAvailableProducts(allProds.filter(p => p.estado === 'activo'));
      setLoading(false);
    }
    load();
  }, [id]);

  const handleAddProduct = (prodId: string) => {
    const newCp: CampañaProducto = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      campaña_id: campaign!.id,
      producto_id: prodId,
      orden: campaignProducts.length + 1,
      usar_precio_manual: false,
      estado_envio: 'pendiente'
    };
    setCampaignProducts([...campaignProducts, newCp]);
  };

  const handleRemoveProduct = (cpId: string) => {
    setCampaignProducts(campaignProducts.filter(cp => cp.id !== cpId));
  };

  const handleUpdateProduct = (cpId: string, field: keyof CampañaProducto, value: any) => {
    setCampaignProducts(campaignProducts.map(cp => cp.id === cpId ? { ...cp, [field]: value } : cp));
  };

  const moveProduct = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === campaignProducts.length - 1) return;
    
    const newArr = [...campaignProducts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
    
    setCampaignProducts(newArr.map((cp, i) => ({ ...cp, orden: i + 1 })));
  };

  const handleSave = async () => {
    if (!campaign) return;
    setSaving(true);
    const finalProds = campaignProducts.map((cp, i) => ({ ...cp, orden: i + 1 }));
    await CampaignService.updateCampaignProducts(campaign.id, finalProds);
    setCampaignProducts(finalProds);
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!campaign) return;
    if (campaignProducts.length === 0) {
      alert("Debes agregar al menos un producto a la campaña.");
      return;
    }
    
    setGenerating(true);
    try {
      const finalProds = campaignProducts.map((cp, i) => ({ ...cp, orden: i + 1 }));
      await CampaignService.updateCampaignProducts(campaign.id, finalProds);

      const [config, templateBlocks] = await Promise.all([
        SettingsService.getConfiguracion(),
        TemplateService.getTemplateBlocks('default-template')
      ]);

      if (!config) throw new Error("Falta configuración global");

      const publications = RenderService.generatePublications(
        campaign.id,
        finalProds,
        availableProducts,
        templateBlocks,
        campaign.tasa_usada,
        config.redondeo_multiplo
      );

      await CampaignService.saveGeneration(campaign.id, campaign.tasa_usada, publications);
      
      const updatedCamp = await CampaignService.getCampaign(campaign.id);
      setCampaign(updatedCamp);
      
      alert('Campaña generada exitosamente.');
    } catch (e: any) {
      alert("Error al generar: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando campaña...</div>;
  if (!campaign) return <div className="p-8 text-center text-red-500">Campaña no encontrada</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado: <span className={`font-semibold ${campaign.estado === 'generada' ? 'text-green-600' : campaign.estado === 'compartida' ? 'text-blue-600' : 'text-amber-600'}`}>
              {campaign.estado === 'compartida' ? 'Enviada' : campaign.estado}
            </span>
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {campaign.estado !== 'borrador' && (
            <button onClick={() => navigate(`/campaigns/${campaign.id}/share`)} className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
              <Share2 className="w-4 h-4" /> Compartir
            </button>
          )}
          <button onClick={handleSave} disabled={saving || generating} className="flex-1 sm:flex-none justify-center bg-gray-100 text-gray-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors">
            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={handleGenerate} disabled={saving || generating} className="flex-1 sm:flex-none justify-center bg-gray-900 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors">
            <Play className="w-4 h-4" /> {generating ? 'Generando...' : 'Generar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-lg text-gray-900">Productos seleccionados</h2>
          {campaignProducts.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
              No hay productos. Agrega desde el catálogo.
            </div>
          )}
          <div className="space-y-3">
            {campaignProducts.map((cp, index) => {
              const product = availableProducts.find(p => p.id === cp.producto_id);
              if (!product) return null;
              return (
                <div key={cp.id} className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 group">
                  <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveProduct(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><GripVertical className="w-4 h-4" /></button>
                    <button onClick={() => moveProduct(index, 'down')} disabled={index === campaignProducts.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><GripVertical className="w-4 h-4 rotate-180" /></button>
                  </div>
                  
                  <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.nombre}</p>
                    <p className="text-sm text-gray-500">${product.precio_usd} USD</p>
                  </div>
                  
                  <div className="w-40 flex-shrink-0 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={cp.usar_precio_manual} 
                        onChange={(e) => handleUpdateProduct(cp.id, 'usar_precio_manual', e.target.checked)} 
                        className="rounded text-gray-900 focus:ring-gray-900"
                      />
                      Precio manual (CUP)
                    </label>
                    {cp.usar_precio_manual && (
                      <input 
                        type="number" 
                        value={cp.precio_manual_cup || ''} 
                        onChange={(e) => handleUpdateProduct(cp.id, 'precio_manual_cup', Number(e.target.value))}
                        placeholder="Ej. 1500" 
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    )}
                  </div>
                  
                  <button onClick={() => handleRemoveProduct(cp.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 lg:sticky lg:top-6 self-start">
          <h2 className="font-semibold text-lg text-gray-900 mb-4">Catálogo</h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {availableProducts.map(p => {
              const countAdded = campaignProducts.filter(cp => cp.producto_id === p.id).length;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2 border border-gray-100 rounded-md hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      <img src={p.imagen_url} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                      <p className="text-xs text-gray-500">${p.precio_usd} USD</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAddProduct(p.id)}
                    className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0"
                    title="Agregar a campaña"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {countAdded > 0 && (
                    <span className="absolute right-12 text-[10px] bg-gray-900 text-white w-4 h-4 flex items-center justify-center rounded-full">
                      {countAdded}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
