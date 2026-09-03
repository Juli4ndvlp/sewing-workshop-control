import React, { useState, useEffect } from 'react';
import { Customer, MeasurementDefinition } from '../../models/types';
import { DexieCustomerRepository } from '../../repositories/dexie/DexieCustomerRepository';
import { db } from '../../repositories/dexie/db';
import { X, Save, Ruler } from 'lucide-react';

const customerRepo = new DexieCustomerRepository();

interface Props {
  customer?: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerFormModal: React.FC<Props> = ({ customer, isOpen, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  const [activeMeasurements, setActiveMeasurements] = useState<MeasurementDefinition[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadDefinitionsAndData = async () => {
      // Cargar definiciones de medidas activas tipando 'm' explícitamente
      const defs = await db.measurementDefinitions
        .filter((m: MeasurementDefinition) => m.active)
        .toArray();
      setActiveMeasurements(defs);

      if (customer) {
        setFullName(customer.fullName || '');
        setPhone(customer.phone || '');
        setEmail(customer.email || '');
        setAddress(customer.address || '');
        setNotes(customer.notes || '');
        setMeasurements(customer.measurements || {});
      } else {
        setFullName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setNotes('');
        setMeasurements({});
      }
    };

    loadDefinitionsAndData();
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleMeasurementChange = (key: string, val: string) => {
    const num = parseFloat(val);
    setMeasurements(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
        measurements
      };

      if (customer) {
        await customerRepo.update(customer.id, payload);
      } else {
        await customerRepo.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Información Personal</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Sección de Medidas Dinámicas */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Medidas (cm)</h3>
            </div>

            {activeMeasurements.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay medidas activas configuradas en Ajustes.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeMeasurements.map(m => (
                  <div key={m.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <label className="block text-xs font-medium text-slate-600 mb-1 truncate">
                      {m.name || m.label || m.key}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="0.0"
                      value={measurements[m.key] !== undefined ? measurements[m.key] : ''}
                      onChange={e => handleMeasurementChange(m.key, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium text-slate-700">Notas Adicionales</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};