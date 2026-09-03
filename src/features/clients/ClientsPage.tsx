import React, { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  FileText,
  Edit2,
  Trash2,
} from "lucide-react";
import { Customer } from "../../models/types";
import { DexieCustomerRepository } from "../../repositories/dexie/DexieCustomerRepository";

const customerRepo = new DexieCustomerRepository();

export const ClientsPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const loadCustomers = async () => {
    const data = await customerRepo.search(searchQuery);
    setCustomers(data);
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFullName(customer.fullName);
      setPhone(customer.phone ?? "");
      setEmail(customer.email || "");
      setNotes(customer.notes || "");
    } else {
      setEditingCustomer(null);
      setFullName("");
      setPhone("");
      setEmail("");
      setNotes("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    if (editingCustomer) {
      await customerRepo.update(editingCustomer.id, {
        fullName,
        phone,
        email,
        notes,
      });
    } else {
      await customerRepo.create({ fullName, phone, email, notes });
    }

    setIsModalOpen(false);
    loadCustomers();
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este cliente?")) {
      await customerRepo.delete(id);
      loadCustomers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Directorio de Clientes
          </h2>
          <p className="text-sm text-slate-500">
            Gestiona la información de contacto e historial de tus clientes.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
        >
          <UserPlus size={18} />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
        />
      </div>

      {/* Grid de Clientes */}
      {customers.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200/80 rounded-2xl p-8">
          <p className="text-slate-500 font-medium">
            No se encontraron clientes.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Crea tu primer cliente para comenzar a registrar pedidos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-slate-900">{c.fullName}</h3>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenModal(c)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center space-x-2">
                    <Phone size={14} className="text-slate-400" />
                    <span>{c.phone}</span>
                  </p>
                  {c.email && (
                    <p className="flex items-center space-x-2">
                      <Mail size={14} className="text-slate-400" />
                      <span>{c.email}</span>
                    </p>
                  )}
                  {c.notes && (
                    <p className="flex items-center space-x-2 text-slate-500 italic mt-2 pt-2 border-t border-slate-100">
                      <FileText size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{c.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
