import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Phone, Mail, Ruler, Scissors, X, Save } from 'lucide-react';
import { Customer } from '../../models/types';
import { DexieCustomerRepository } from '../../repositories/dexie/DexieCustomerRepository';

const customerRepo = new DexieCustomerRepository();

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados del formulario de cliente
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [measurements, setMeasurements] = useState({
    busto: '',
    cintura: '',
    cadera: '',
    largo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerRepo.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const newCustomer = {
        fullName: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        measurements: Object.fromEntries(
          Object.entries(measurements)
            .filter(([, value]) => value !== '')
            .map(([key, value]) => [key, Number(value)])
        )
      };

      await customerRepo.create(newCustomer);
      setName('');
      setPhone('');
      setEmail('');
      setMeasurements({ busto: '', cintura: '', cadera: '', largo: '' });
      setIsModalOpen(false);
      loadCustomers();
    } catch (error) {
      console.error('Error al crear cliente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const query = searchTerm.toLowerCase();
    const customerName = c.fullName.toLowerCase();
    const customerPhone = (c.phone ?? '').toLowerCase();
    return customerName.includes(query) || customerPhone.includes(query);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Clientes</h1>
          <p className="text-sm text-slate-500">Directorio de clientes y registro de medidas corporales.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus size={18} />
          Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Grid de Clientes */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl text-slate-400 text-sm">
          No hay clientes registrados o que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{customer.fullName}</h3>
                    <p className="text-xs text-slate-400">ID: #{customer.id?.slice(0, 6)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  <span>{customer.phone || 'Sin teléfono registrado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" />
                  <span>{customer.email || 'Sin correo electrónico'}</span>
                </div>
              </div>

              {/* Medidas rápidas si existen */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Ruler size={12} /> Medidas de referencia (cm)
                </span>
                <div className="grid grid-cols-4 gap-1 text-center pt-1 text-xs font-medium text-slate-700">
                  <div className="bg-white p-1 rounded border border-slate-100">
                    <span className="block text-[9px] text-slate-400">Busto</span>
                    {customer.measurements?.busto || '-'}
                  </div>
                  <div className="bg-white p-1 rounded border border-slate-100">
                    <span className="block text-[9px] text-slate-400">Cintura</span>
                    {customer.measurements?.cintura || '-'}
                  </div>
                  <div className="bg-white p-1 rounded border border-slate-100">
                    <span className="block text-[9px] text-slate-400">Cadera</span>
                    {customer.measurements?.cadera || '-'}
                  </div>
                  <div className="bg-white p-1 rounded border border-slate-100">
                    <span className="block text-[9px] text-slate-400">Largo</span>
                    {customer.measurements?.largo || '-'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Nuevo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800">Registrar Nuevo Cliente</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. María Fernanda Gómez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej. 310 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Medidas */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Ruler size={14} /> Medidas Corporales (cm)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Busto</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={measurements.busto}
                      onChange={(e) => setMeasurements({ ...measurements, busto: e.target.value })}
                      className="w-full px-2 py-1.5 text-center text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Cintura</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={measurements.cintura}
                      onChange={(e) => setMeasurements({ ...measurements, cintura: e.target.value })}
                      className="w-full px-2 py-1.5 text-center text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Cadera</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={measurements.cadera}
                      onChange={(e) => setMeasurements({ ...measurements, cadera: e.target.value })}
                      className="w-full px-2 py-1.5 text-center text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Largo</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={measurements.largo}
                      onChange={(e) => setMeasurements({ ...measurements, largo: e.target.value })}
                      className="w-full px-2 py-1.5 text-center text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Save size={15} /> Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};