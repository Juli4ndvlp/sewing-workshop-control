import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  X,
  Save,
  Edit2,
  History,
  Trash2
} from 'lucide-react';
import {
  deleteInventoryItemSafely,
  isInventoryItemReferenced,
  listInventoryItems,
  listInventoryMovements,
  saveInventoryItem
} from '../../services/inventoryService';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useToast } from '../../components/ToastProvider';
import type { InventoryItem, InventoryMovement } from '../../models/types';
import { formatCurrency } from '../../utils/money';
import { EmptyState } from '../../components/EmptyState';

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [showMovements, setShowMovements] = useState(false);

  // Formulario de insumo
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tela');
  const [stock, setStock] = useState<number | ''>('');
  const [unit, setUnit] = useState('Metros');
  const [unitCost, setUnitCost] = useState<number | ''>('');
  const [minStock, setMinStock] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await listInventoryItems();
      setItems(data);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
      showToast('No se pudo cargar el inventario.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const data = await listInventoryMovements(50);
      setMovements(data);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
      showToast('No se pudieron cargar los movimientos.', 'error');
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
    setMinStock('');
    setEditingItem(null);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };
  const modalRef = useDialogA11y(isModalOpen, closeModal);
  const movementsRef = useDialogA11y(showMovements, () => setShowMovements(false));

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setStock(item.stock);
    setUnit(item.unit);
    setUnitCost(item.unitCost);
    setMinStock(item.minStock ?? '');
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
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

    const parsedMinStock = minStock === '' ? undefined : Number(minStock);
    if (parsedMinStock !== undefined && (!Number.isFinite(parsedMinStock) || parsedMinStock < 0))
      return;

    setIsSubmitting(true);
    try {
      await saveInventoryItem(
        {
          name,
          category,
          stock: Number(stock),
          unit,
          unitCost: Number(unitCost),
          minStock: parsedMinStock
        },
        editingItem?.id
      );
      resetForm();
      setIsModalOpen(false);
      showToast(editingItem ? 'Insumo actualizado.' : 'Insumo registrado.', 'success');
      await loadInventory();
    } catch (error) {
      console.error('Error al guardar insumo:', error);
      showToast(error instanceof Error ? error.message : 'No se pudo guardar el insumo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string, itemName: string) => {
    try {
      const used = await isInventoryItemReferenced(id);
      if (used) {
        showToast(`No se puede eliminar "${itemName}": está en consumo de pedidos.`, 'error');
        return;
      }
      if (!window.confirm(`¿Seguro que deseas eliminar "${itemName}" del inventario?`)) return;
      setIsDeletingId(id);
      await deleteInventoryItemSafely(id);
      showToast('Insumo eliminado.', 'success');
      await loadInventory();
    } catch (error) {
      console.error('Error al eliminar insumo:', error);
      showToast(error instanceof Error ? error.message : 'No se pudo eliminar el insumo.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(normalizedSearchTerm) ||
      item.category.toLowerCase().includes(normalizedSearchTerm)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Materiales
          </p>
          <h1 className="text-3xl font-semibold text-stone-900">Control de Inventario</h1>
          <p className="text-sm text-stone-500 mt-1">
            Gestión de telas, hilos, botones y materiales del taller.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await loadMovements();
              setShowMovements(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-colors"
          >
            <History size={18} />
            Movimientos
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Plus size={18} />
            Nuevo insumo
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="glass-panel rounded-2xl p-4 border border-white/60 shadow-sm shadow-stone-900/5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input
            type="text"
            placeholder="Buscar insumo o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
          />
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="glass-panel rounded-2xl shadow-sm shadow-stone-900/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 md:p-12">
            <EmptyState
              icon={Package}
              title={searchTerm ? 'Sin insumos coincidentes' : 'No hay insumos registrados'}
              description={
                searchTerm
                  ? 'Prueba buscando por otro nombre o categoría de material.'
                  : 'Agrega telas, hilos, botones y materiales para gestionar tus existencias.'
              }
              actionLabel={searchTerm ? undefined : 'Nuevo insumo'}
              onAction={
                searchTerm
                  ? undefined
                  : () => {
                      resetForm();
                      setIsModalOpen(true);
                    }
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Insumo</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Costo unitario</th>
                  <th className="py-3 px-4 text-right">Valor total</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredItems.map((item) => {
                  const totalValue = item.stock * item.unitCost;
                  const minThreshold = item.minStock ?? 3;
                  const isLowStock = item.stock <= minThreshold;

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-stone-800">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-stone-400" />
                          {item.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-700 rounded-full">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-stone-700'}`}
                          >
                            {item.stock} {item.unit}
                          </span>
                          {isLowStock && (
                            <span
                              title={`Stock bajo (mín. ${minThreshold})`}
                              className="text-amber-500"
                            >
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400">Mín. {minThreshold}</div>
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-stone-900">
                        {formatCurrency(totalValue)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                            aria-label={`Editar ${item.name}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            disabled={isDeletingId === item.id}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                            aria-label={`Eliminar ${item.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
        <div
          ref={modalRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-md outline-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-panel-strong w-full max-w-md rounded-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-base font-bold text-stone-800">
                {editingItem ? 'Editar insumo' : 'Registrar nuevo insumo'}
              </h3>
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                  Nombre del Insumo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Seda satín negra, Hilo nylon..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl"
                  >
                    <option value="Tela">Tela</option>
                    <option value="Hilo">Hilo</option>
                    <option value="Botón/Cierre">Botón / Cierre</option>
                    <option value="Accesorios">Accesorios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl"
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
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                    {editingItem ? 'Stock *' : 'Stock inicial *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                    Costo unitario ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0.00"
                    value={unitCost}
                    onChange={(e) =>
                      setUnitCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                  Stock mínimo (alerta)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej. 3"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Save size={15} /> {editingItem ? 'Guardar cambios' : 'Guardar insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMovements && (
        <div
          ref={movementsRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-stone-900/30 backdrop-blur-md flex items-center justify-center p-4 outline-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-panel-strong rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">Movimientos de inventario</h3>
                <p className="text-sm text-stone-500">
                  Últimos 50 movimientos registrados (automáticos y manuales).
                </p>
              </div>
              <button
                onClick={() => setShowMovements(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                aria-label="Cerrar movimientos"
              >
                <X size={18} />
              </button>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-stone-500">No hay movimientos registrados.</p>
            ) : (
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-left px-3 py-2">Insumo</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-right px-3 py-2">Cambio</th>
                      <th className="text-right px-3 py-2">Stock final</th>
                      <th className="text-left px-3 py-2">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {movements.map((m) => {
                      const item = items.find((i) => i.id === m.inventoryItemId);
                      const typeLabels: Record<string, string> = {
                        manual: 'Manual',
                        order_deduct: 'Consumo pedido',
                        order_return: 'Devolución',
                        adjustment: 'Ajuste'
                      };
                      return (
                        <tr key={m.id}>
                          <td className="px-3 py-2 text-stone-600">
                            {new Date(m.createdAt).toLocaleString('es-CO', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </td>
                          <td className="px-3 py-2 text-stone-800">
                            {item?.name ?? m.inventoryItemId}
                          </td>
                          <td className="px-3 py-2 text-stone-600">
                            {typeLabels[m.type] ?? m.type}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-medium ${m.quantityChange < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                          >
                            {m.quantityChange > 0 ? '+' : ''}
                            {m.quantityChange}
                          </td>
                          <td className="px-3 py-2 text-right text-stone-700">{m.stockAfter}</td>
                          <td className="px-3 py-2 text-stone-500">{m.note ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
