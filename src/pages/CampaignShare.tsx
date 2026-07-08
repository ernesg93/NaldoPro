import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CampaignService } from '../services/CampaignService';
import { ProductService } from '../services/ProductService';
import type { Campaña, CampañaProducto, Producto, PublicacionGenerada } from '../types';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Share2,
  XCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useWebShare } from '../hooks/useWebShare';
import type { ShareResult } from '../hooks/useWebShare';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShareContent = {
  text: string;
  imageUrl: string;
  title?: string;
  fileName?: string;
};

// ---------------------------------------------------------------------------
// Helper — process share result and persist sent status
// ---------------------------------------------------------------------------

async function processShareResult(
  cpId: string,
  result: ShareResult,
): Promise<boolean> {
  if (result.status === 'shared' || (result.status === 'fallback-shared' && result.copied === true)) {
    await CampaignService.updateCampaignProductStatus(cpId, 'enviado');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Platform caveat: when sharing with `files` (Web Share Level 2), receiving
// apps may discard `text` / `title` and show only the image. This is a known
// platform limitation — the app cannot enforce how targets handle the payload.
// See Web Share API spec / MDN notes on `navigator.share({ files })`.
// ---------------------------------------------------------------------------

function FeedbackNotice({
  result,
  onDismiss,
}: {
  result: ShareResult;
  onDismiss: () => void;
}) {
  if (result.status === 'shared') {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
        <span className="flex-1">¡Publicación enviada!</span>
        <button onClick={onDismiss} className="text-green-500 hover:text-green-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (result.status === 'fallback-shared') {
    if (result.copied) {
      return (
        <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
          <span className="flex-1">
            {result.imageAction === 'downloaded'
              ? 'Texto copiado e imagen descargada.'
              : result.imageAction === 'opened'
              ? 'Texto copiado e imagen abierta.'
              : 'Texto copiado, pero no se pudo acceder a la imagen.'}
          </span>
          <button onClick={onDismiss} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
        <span className="flex-1">
          {result.imageAction === 'failed'
            ? 'No se pudo copiar el texto ni acceder a la imagen.'
            : 'No se pudo copiar el texto. Imagen abierta.'}
        </span>
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (result.status === 'canceled') {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
        <span className="flex-1">Compartir cancelado.</span>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        <XCircle className="w-4 h-4 shrink-0 text-red-500" />
        <span className="flex-1">Error al compartir: {result.reason}</span>
        <button onClick={onDismiss} className="text-red-500 hover:text-red-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

export function CampaignShare() {
  const { id } = useParams();

  const [campaign, setCampaign] = useState<Campaña | null>(null);
  const [campaignProducts, setCampaignProducts] = useState<CampañaProducto[]>([]);
  const [publications, setPublications] = useState<PublicacionGenerada[]>([]);
  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, ShareResult>>({});
  const { share, loading: sharing } = useWebShare();

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [camp, cProducts, pubs, allProds] = await Promise.all([
        CampaignService.getCampaign(id),
        CampaignService.getCampaignProducts(id),
        CampaignService.getGeneratedPublications(id),
        ProductService.getProducts(),
      ]);
      setCampaign(camp);
      setCampaignProducts(cProducts.sort((a, b) => a.orden - b.orden));
      setPublications(pubs);
      setProducts(allProds);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleMarkAsSent = useCallback(
    async (cpId: string) => {
      await CampaignService.updateCampaignProductStatus(cpId, 'enviado');
      setCampaignProducts((prev) =>
        prev.map((cp) =>
          cp.id === cpId ? { ...cp, estado_envio: 'enviado' } : cp,
        ),
      );
    },
    [],
  );

  const handleShare = useCallback(
    async (cpId: string, content: ShareContent) => {
      const result = await share(content);
      setFeedback((prev) => ({ ...prev, [cpId]: result }));

      try {
        const saved = await processShareResult(cpId, result);
        if (saved) {
          setCampaignProducts((prev) =>
            prev.map((cp) =>
              cp.id === cpId ? { ...cp, estado_envio: 'enviado' } : cp,
            ),
          );
        }
      } catch (err) {
        console.warn('[CampaignShare] Failed to persist sent status:', err);
        setFeedback((prev) => ({
          ...prev,
          [cpId]: { status: 'failed', reason: 'No se pudo guardar el estado de envío. Marca manualmente.' },
        }));
      }
    },
    [share],
  );

  const dismissFeedback = useCallback((cpId: string) => {
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[cpId];
      return next;
    });
  }, []);

  const hasInconsistencies = campaignProducts.some((cp) => {
    const pub = publications.find((p) => p.campaña_producto_id === cp.id);
    const product = products.find((p) => p.id === cp.producto_id);
    return !pub || !product || product.estado !== 'activo';
  });

  const handleFinishCampaign = async () => {
    if (!campaign) return;
    if (hasInconsistencies) {
      alert(
        'No se puede finalizar la campaña porque existen inconsistencias en los datos. Por favor, genera la campaña nuevamente.',
      );
      return;
    }
    const allSent = campaignProducts.every(
      (cp) => cp.estado_envio === 'enviado',
    );
    if (!allSent) {
      const confirm = window.confirm(
        'Hay productos pendientes por enviar. ¿Estás seguro de finalizar la campaña?',
      );
      if (!confirm) return;
    }
    await CampaignService.updateCampaignStatus(campaign.id, 'compartida');
    setCampaign({ ...campaign, estado: 'compartida' });
    alert('Campaña finalizada y marcada como Enviada.');
  };

  if (loading)
    return <div className="p-8 text-center">Cargando modo compartir...</div>;
  if (!campaign)
    return (
      <div className="p-8 text-center text-red-500">Campaña no encontrada</div>
    );

  if (publications.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">
          No hay publicaciones generadas
        </h2>
        <p className="text-gray-600">
          Por favor, regresa al editor y genera la campaña primero.
        </p>
        <Link
          to={`/campaigns/${campaign.id}`}
          className="inline-block mt-4 bg-gray-900 text-white px-4 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors"
        >
          Volver al Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to={`/campaigns/${campaign.id}`}
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {campaign.nombre}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Estado:{' '}
              <span
                className={`font-semibold ${campaign.estado === 'compartida' ? 'text-blue-600' : 'text-green-600'}`}
              >
                {campaign.estado === 'compartida' ? 'Enviada' : 'Generada'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {campaign.estado !== 'compartida' && (
            <button
              onClick={handleFinishCampaign}
              className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Finalizar Campaña
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {campaignProducts.map((cp) => {
          const pub = publications.find(
            (p) => p.campaña_producto_id === cp.id,
          );
          const product = products.find((p) => p.id === cp.producto_id);

          if (!pub || !product) {
            return (
              <div
                key={cp.id}
                className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden flex flex-col p-4"
              >
                <p className="text-red-600 font-semibold">
                  Error de inconsistencia
                </p>
                <p className="text-sm text-gray-600">
                  No se encontró la publicación generada o el producto original
                  para este ítem. Debes generar la campaña nuevamente.
                </p>
              </div>
            );
          }

          if (product.estado !== 'activo') {
            return (
              <div
                key={cp.id}
                className="bg-white rounded-lg shadow-sm border border-amber-200 overflow-hidden flex flex-col p-4"
              >
                <p className="text-amber-600 font-semibold">
                  Producto no activo
                </p>
                <p className="text-sm text-gray-600">
                  El producto &ldquo;{product.nombre}&rdquo; no está activo
                  (estado: {product.estado}). Debes activarlo en el catálogo o
                  generar la campaña nuevamente.
                </p>
              </div>
            );
          }

          const isSharingThis = feedback[cp.id] !== undefined;

          return (
            <div
              key={cp.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row"
            >
              <div className="md:w-1/3 bg-gray-50 p-4 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col items-center justify-center">
                <img
                  src={pub.imagen_url}
                  alt="Producto"
                  className="max-w-full max-h-48 object-contain rounded-md mb-4 shadow-sm"
                />
                <div className="w-full text-sm space-y-1">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Precio Unitario:</span>{' '}
                    <span className="font-semibold">
                      ${pub.precio_unitario_final_cup} CUP
                    </span>
                  </p>
                  {pub.cantidad_por_caja && (
                    <p className="flex justify-between">
                      <span className="text-gray-500">
                        Caja ({pub.cantidad_por_caja} uds):
                      </span>{' '}
                      <span className="font-semibold">
                        ${pub.precio_caja_cup} CUP
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="md:w-2/3 p-4 flex flex-col">
                <div className="flex-1 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 p-3 rounded-md border border-gray-100 font-mono">
                  {pub.texto_generado}
                </div>

                {isSharingThis && (
                  <div className="mt-3">
                    <FeedbackNotice
                      result={feedback[cp.id]}
                      onDismiss={() => dismissFeedback(cp.id)}
                    />
                  </div>
                )}

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

                  <button
                    onClick={() => {
                      const fileName = pub.imagen_url.split('/').pop() ?? 'publicacion.png';
                      const title = `${campaign?.nombre} - ${product.nombre}`;
                      handleShare(cp.id, { text: pub.texto_generado, imageUrl: pub.imagen_url, title, fileName });
                    }}
                    disabled={sharing}
                    className="flex-1 sm:flex-none justify-center bg-gray-900 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Share2 className="w-4 h-4" />
                    {sharing ? 'Compartiendo...' : 'Compartir'}
                  </button>

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
