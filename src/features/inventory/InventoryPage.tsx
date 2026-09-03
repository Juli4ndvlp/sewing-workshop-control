import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, X, Save } from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import type { InventoryItem } from '../../models/types';

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario de insumo
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tela');
  const [stock, setStock] = useState<number | ''>('');
  const [unit, setUnit] = useState('Metros');
  const [unitCost, setUnitCost] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await db.inventory.toArray();
      setItems(data);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const resetForm = () => {
    setName('');
    setCategory('Tela');
    setStock('');
    setUnit('Metros');
    setUnitCost('');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      stock === '' ||
      unitCost === '' ||
      !Number.isFinite(stock) ||
      !Number.isFinite(unitCost) ||
      stock < 0 ||
      unitCost < 0
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const newItem = {
        name: name.trim(),
        category,
        stock: Number(stock),
        unit,
        unitCost: Number(unitCost),
        updatedAt: new Date().toISOString()
      };

      await db.inventory.add({ ...newItem, id: crypto.randomUUID() });
      resetForm();
      setIsModalOpen(false);
      await loadInventory();
    } catch (error) {
      console.error('Error al guardar insumo:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(normalizedSearchTerm) ||
    item.category.toLowerCase().includes(normalizedSearchTerm)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control de Inventario</h1>
          <p className="text-sm text-slate-500">Gestión de telas, hilos, botones y materiales del taller.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus size={18} />
          Nuevo Insumo
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar insumo o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No hay insumos registrados en el inventario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Insumo</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Stock Actual</th>
                  <th className="py-3 px-4">Costo Unitario</th>
                  <th className="py-3 px-4 text-right">Valor Total en Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map(item => {
                  const totalValue = item.stock * item.unitCost;
                  const isLowStock = item.stock <= 3; // Alerta simple de stock bajo

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                        <Package size={16} className="text-slate-400" />
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-slate-700'}`}>
                            {item.stock} {item.unit}
                          </span>
                          {isLowStock && (
                            <span title="Stock bajo" className="text-amber-500">
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        ${item.unitCost.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        ${totalValue.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nuevo Insumo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800">Registrar Nuevo Insumo</h3>
              <button onClick={() => {
                resetForm();
                setIsModalOpen(false);
              }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Nombre del Insumo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Seda satín negra, Hilo nylon..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="Tela">Tela</option>
                    <option value="Hilo">Hilo</option>
                    <option value="Botón/Cierre">Botón / Cierre</option>
                    <option value="Accesorios">Accesorios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Unidad de Medida</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="Metros">Metros</option>
                    <option value="Unidades">Unidades</option>
                    <option value="Rollos">Rollos</option>
                    <option value="Yardas">Yardas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Stock Inicial *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Costo Unitario ($) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0.00"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Save size={15} /> Guardar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};