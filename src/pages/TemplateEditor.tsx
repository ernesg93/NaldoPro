import React, { useEffect, useState } from 'react';
import { TemplateService } from '../services/TemplateService';
import type { Plantilla, PlantillaBloque } from '../types';
import { Plus, Trash2, GripVertical, Save, Info } from 'lucide-react';

export function TemplateEditor() {
  const [template, setTemplate] = useState<Plantilla | null>(null);
  const [blocks, setBlocks] = useState<PlantillaBloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const defaultTemplate = await TemplateService.getDefaultTemplate();
        setTemplate(defaultTemplate);
        
        const templateBlocks = await TemplateService.getTemplateBlocks(defaultTemplate.id);
        setBlocks(templateBlocks);
      } catch (err) {
        console.error("Error al cargar plantilla", err);
        setError('Error al cargar la plantilla.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAddBlock = () => {
    const newBlock: PlantillaBloque = {
      id: `block-${Date.now()}`,
      plantilla_id: template!.id,
      tipo: 'texto',
      titulo: 'Nuevo texto',
      orden: blocks.length + 1,
      visible: true,
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleRemoveBlock = (id: string) => {
    if (blocks.length <= 1) {
      setError('La plantilla no puede estar vacía.');
      return;
    }
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const handleBlockChange = (id: string, field: keyof PlantillaBloque, value: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;
    
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Intercambiar
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    
    // Reasignar orden
    const orderedBlocks = newBlocks.map((b, i) => ({ ...b, orden: i + 1 }));
    setBlocks(orderedBlocks);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess(false);
      
      // Asegurarse de que el orden sea secuencial
      const finalBlocks = blocks.map((b, index) => ({ ...b, orden: index + 1 }));
      await TemplateService.updateTemplateBlocks(template!.id, finalBlocks);
      setBlocks(finalBlocks);
      setSuccess(true);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Cargando plantilla...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantilla Comercial</h1>
          <p className="text-sm text-gray-500 mt-1">
            Esta plantilla será utilizada por el RenderService en la siguiente fase para generar las publicaciones finales.
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
          Plantilla guardada correctamente.
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800 text-sm">
        <Info className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-1">Acerca de los bloques</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Texto:</strong> Agrega un párrafo de texto libre (ej. saludo, ofertas).</li>
            <li><strong>Lista:</strong> Representa dónde se insertarán los productos cuando se genere la campaña.</li>
            <li><strong>Separador:</strong> Agrega un divisor visual (ej. líneas o emojis).</li>
          </ul>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{template?.nombre}</h2>
        
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="flex items-start gap-3 bg-gray-50 p-4 rounded-md border border-gray-200 group">
              <div className="flex flex-col gap-1 mt-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                  <GripVertical className="w-4 h-4" />
                </button>
                <button onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                  <GripVertical className="w-4 h-4 rotate-180" />
                </button>
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Bloque</label>
                    <select
                      value={block.tipo}
                      onChange={(e) => handleBlockChange(block.id, 'tipo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                    >
                      <option value="texto">Texto</option>
                      <option value="lista">Lista de Productos</option>
                      <option value="separador">Separador</option>
                    </select>
                  </div>
                  
                  <div className="w-2/3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Título {block.tipo === 'texto' && '(Opcional/Referencia)'}
                      </label>
                      <input
                        type="text"
                        value={block.titulo}
                        onChange={(e) => handleBlockChange(block.id, 'titulo', e.target.value)}
                        placeholder={block.tipo === 'lista' ? 'Ej. Productos Destacados' : 'Título del bloque'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                    {block.tipo === 'texto' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Contenido
                        </label>
                        <textarea
                          value={block.contenido || ''}
                          onChange={(e) => handleBlockChange(block.id, 'contenido', e.target.value)}
                          placeholder="Escribe el texto aquí..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`visible-${block.id}`}
                    checked={block.visible}
                    onChange={(e) => handleBlockChange(block.id, 'visible', e.target.checked)}
                    className="rounded text-gray-900 focus:ring-gray-900"
                  />
                  <label htmlFor={`visible-${block.id}`} className="text-sm text-gray-700 cursor-pointer">
                    Bloque visible en la plantilla
                  </label>
                </div>
              </div>

              <button
                onClick={() => handleRemoveBlock(block.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Eliminar bloque"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleAddBlock}
          className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar nuevo bloque
        </button>
      </div>
    </div>
  );
}
