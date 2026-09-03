import React, { useState, useEffect } from 'react';
import { db } from '../../repositories/dexie/db';
import { GarmentType, Fabric, MeasurementDefinition, AppConfig } from '../../models/types';
import { Plus, Check, Palette, Shirt, Layers, Ruler } from 'lucide-react';
import { injectTestData } from '../../utils/seedData';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [garments, setGarments] = useState<GarmentType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementDefinition[]>([]);

  // Inputs para agregar
  const [newGarment, setNewGarment] = useState('');
  const [newFabric, setNewFabric] = useState('');
  const [newMeasureLabel, setNewMeasureLabel] = useState('');

  const loadData = async () => {
    const cfg = await db.appConfig.get('default');
    if (cfg) setConfig(cfg);
    setGarments(await db.garmentTypes.toArray());
    setFabrics(await db.fabrics.toArray());
    setMeasurements(await db.measurementDefinitions.toArray());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddGarment = async () => {
    if (!newGarment.trim()) return;
    await db.garmentTypes.add({ id: crypto.randomUUID(), name: newGarment, active: true });
    setNewGarment('');
    loadData();
  };

  const handleAddFabric = async () => {
    if (!newFabric.trim()) return;
    await db.fabrics.add({ id: crypto.randomUUID(), name: newFabric, active: true });
    setNewFabric('');
    loadData();
  };

  const handleAddMeasurement = async () => {
    if (!newMeasureLabel.trim()) return;
    const key = newMeasureLabel.toLowerCase().replace(/\s+/g, '');
    await db.measurementDefinitions.add({
      id: crypto.randomUUID(),
      key,
      name: newMeasureLabel,
      label: newMeasureLabel,
      active: true
    });
    setNewMeasureLabel('');
    loadData();
  };

  const handleSaveConfig = async (businessName: string) => {
    await db.appConfig.update('default', { businessName });
    loadData();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Panel de Administración</h2>
        <p className="text-sm text-slate-500">Personaliza la marca y administra los catálogos del taller.</p>
      </div>

      {/* Identidad del Negocio */}
      {config && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Palette className="text-slate-700" size={20} />
            <h3 className="font-semibold text-slate-900">Identidad del Taller</h3>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del Negocio</label>
            <input
              type="text"
              value={config.businessName ?? ''}
              onChange={(e) => handleSaveConfig(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
      )}

      {/* Catálogo de Prendas */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Shirt className="text-slate-700" size={20} />
          <h3 className="font-semibold text-slate-900">Tipos de Prenda</h3>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Ej: Abrigo, Pijama..."
            value={newGarment}
            onChange={(e) => setNewGarment(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <button onClick={handleAddGarment} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg font-medium">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {garments.map(g => (
            <span key={g.id} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
              {g.name}
            </span>
          ))}
        </div>
      </div>

      {/* Catálogo de Telas */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Layers className="text-slate-700" size={20} />
          <h3 className="font-semibold text-slate-900">Catálogo de Telas</h3>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Ej: Chantilly, Popelina..."
            value={newFabric}
            onChange={(e) => setNewFabric(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <button onClick={handleAddFabric} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg font-medium">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {fabrics.map(f => (
            <span key={f.id} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
              {f.name}
            </span>
          ))}
        </div>
      </div>

      {/* Catálogo de Medidas Corporales */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Ruler className="text-slate-700" size={20} />
          <h3 className="font-semibold text-slate-900">Puntos de Medida Personalizados</h3>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Ej: Contorno de Cuello (cm)"
            value={newMeasureLabel}
            onChange={(e) => setNewMeasureLabel(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <button onClick={handleAddMeasurement} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg font-medium">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {measurements.map(m => (
            <span key={m.id} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
    );
};