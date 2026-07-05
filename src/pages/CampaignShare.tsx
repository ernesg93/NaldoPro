import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CampaignService } from '../services/CampaignService';
import { ProductService } from '../services/ProductService';
import type { Campaña, CampañaProducto, Producto, PublicacionGenerada } from '../types';
import { ArrowLeft, Check, CheckCircle2, MessageCircle } from 'lucide-react';

export function CampaignShare() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaña | null>(null);
  const [campaignProducts, setCampaignProducts] = useState<CampañaProducto[]>([]);
  const [publications, setPublications] = useState<PublicacionGenerada[]>([]);
  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [camp, cProducts, pubs, allProds] = await Promise.all([
        CampaignService.getCampaign(id),
        CampaignService.getCampaignProducts(id),
        CampaignService.getGeneratedPublications(id),
        ProductService.getProducts()
      ]);
      setCampaign(camp);
      setCampaignProducts(cProducts.sort((a,b) => a.orden - b.orden));
      setPublications(pubs);
      setProducts(allProds);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleMarkAsSent = async (cpId: string) => {
    await CampaignService.updateCampaignProductStatus(cpId, 'enviado');
    setCampaignProducts(prev => prev.map(cp => cp.id === cpId ? { ...cp, estado_envio: 'enviado' } : cp));
  };

  const hasInconsistencies = campaignProducts.some(cp => {
    return !publications.find(p => p.campaña_producto_id === cp.id) || !products.find(p => p.id === cp.producto_id);
  });

  const handleFinishCampaign = async () => {
    if (!campaign) return;
    if (hasInconsistencies) {
      alert("No se puede finalizar la campaña porque existen inconsistencias en los datos. Por favor, genera la campaña nuevamente.");
      return;
    }
    const allSent = campaignProducts.every(cp => cp.estado_envio === 'enviado');
    if (!allSent) {
      const confirm = window.confirm("Hay productos pendientes por enviar. ¿Estás seguro de finalizar la campaña?");
      if (!confirm) return;
    }
    await CampaignService.updateCampaignStatus(campaign.id, 'compartida');
    setCampaign({ ...campaign, estado: 'compartida' });
    alert("Campaña finalizada y marcada como Enviada.");
  };

  if (loading) return <div className="p-8 text-center">Cargando modo compartir...</div>;
  if (!campaign) return <div className="p-8 text-center text-red-500">Campaña no encontrada</div>;

  if (publications.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">No hay publicaciones generadas</h2>
        <p className="text-gray-600">Por favor, regresa al editor y genera la campaña primero.</p>
        <Link to={`/campaigns/${campaign.id}`} className="inline-block mt-4 bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors">
          Volver al Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Link to={`/campaigns/${campaign.id}`} className="text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.nombre}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Estado: <span className={`font-semibold ${campaign.estado === 'compartida' ? 'text-blue-600' : 'text-green-600'}`}>
                {campaign.estado === 'compartida' ? 'Enviada' : 'Generada'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {campaign.estado !== 'compartida' && (
            <button onClick={handleFinishCampaign} className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Finalizar Campaña
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {campaignProducts.map((cp, index) => {
          const pub = publications.find(p => p.campaña_producto_id === cp.id);
          const product = products.find(p => p.id === cp.producto_id);
          
          if (!pub || !product) {
            return (
              <div key={cp.id} className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden flex flex-col p-4">
                <p className="text-red-600 font-semibold">Error de inconsistencia</p>
                <p className="text-sm text-gray-600">No se encontró la publicación generada o el producto original para este ítem. Debes generar la campaña nuevamente.</p>
              </div>
            );
          }

          const encodedText = encodeURIComponent(pub.texto_generado);
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

          return (
            <div key={cp.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
              <div className="md:w-1/3 bg-gray-50 p-4 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col items-center justify-center">
                <img src={pub.imagen_url} alt="Producto" className="max-w-full max-h-48 object-contain rounded-md mb-4 shadow-sm" />
                <div className="w-full text-sm space-y-1">
                  <p className="flex justify-between"><span className="text-gray-500">Precio Unitario:</span> <span className="font-semibold">${pub.precio_unitario_final_cup} CUP</span></p>
                  {pub.cantidad_por_caja && (
                    <p className="flex justify-between"><span className="text-gray-500">Caja ({pub.cantidad_por_caja} uds):</span> <span className="font-semibold">${pub.precio_caja_cup} CUP</span></p>
                  )}
                </div>
              </div>
              
              <div className="md:w-2/3 p-4 flex flex-col">
                <div className="flex-1 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 p-3 rounded-md border border-gray-100 font-mono">
                  {pub.texto_generado}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end items-center">
                  <div className="flex-1 flex w-full">
                    {cp.estado_envio === 'enviado' ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                        <Check className="w-4 h-4" /> Enviada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <a 
                    href={whatsappUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none justify-center bg-gray-900 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Compartir WhatsApp
                  </a>

                  {cp.estado_envio !== 'enviado' && (
                    <button 
                      onClick={() => handleMarkAsSent(cp.id)}
                      className="flex-1 sm:flex-none justify-center bg-green-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Marcar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
