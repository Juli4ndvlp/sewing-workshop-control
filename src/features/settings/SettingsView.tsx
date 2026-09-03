import React, { useState, useEffect } from 'react';
import { settingsRepository } from '../../repositories/dexie/settingsRepository';
import { GarmentType, Fabric, MeasurementDefinition, AppConfig } from '../../models/types';
import { Plus, Trash2, Settings, Scissors, Shirt, Ruler, Sliders, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementDefinition[]>([]);

  // Form inputs
  const [newGarment, setNewGarment] = useState('');
  const [newFabric, setNewFabric] = useState('');
  const [newMeasureName, setNewMeasureName] = useState('');
  const [newCategory, setNewCategory] = useState<'superior' | 'inferior' | 'general'>('superior');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cfgData, garmentsData, fabricsData, measuresData] = await Promise.all([
      settingsRepository.getConfig(),
      settingsRepository.getGarmentTypes(),
      settingsRepository.getFabrics(),
      settingsRepository.getMeasurementDefinitions()
    ]);
    setConfig(cfgData);
    setGarmentTypes(garmentsData);
    setFabrics(fabricsData);
    setMeasurements(measuresData);
  };

  const handleUpdateMargin = async (margin: number) => {
    if (!config) return;
    await settingsRepository.updateConfig({ profitMargin: margin });
    setConfig({ ...config, profitMargin: margin });
  };

  const handleAddGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarment.trim()) return;
    await settingsRepository.addGarmentType(newGarment.trim());
    setNewGarment('');
    loadData();
  };

  const handleDeleteGarment = async (id: string) => {
    await settingsRepository.deleteGarmentType(id);
    loadData();
  };

  const handleAddFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFabric.trim()) return;
    await settingsRepository.addFabric(newFabric.trim());
    setNewFabric('');
    loadData();
  };

  const handleDeleteFabric = async (id: string) => {
    await settingsRepository.deleteFabric(id);
    loadData();
  };

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeasureName.trim()) return;
    const key = newMeasureName.toLowerCase().replace(/\s+/g, '_');
    await settingsRepository.addMeasurementDefinition(key, newMeasureName.trim(), newCategory);
    setNewMeasureName('');
    await loadData();
  };

  const handleToggleMeasurementActive = async (id: string, currentActive: boolean) => {
    await settingsRepository.updateMeasurementDefinition(id, { active: !currentActive });
    await loadData();
  };

  const handleDeleteMeasurement = async (id: string) => {
    await settingsRepository.deleteMeasurementDefinition(id);
    await loadData();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Ajustes e Insumos Iniciales
        </h1>
        <p className="text-slate-500 text-sm">Configura los parámetros financieros y catálogos de Edna Atelier.</p>
      </div>

      {/* Margen Financiero y Preferencias Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {config && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" /> Margen de Ganancia General (%)
            </h2>
            <div className="flex items-center gap-4 max-w-xs">
              <input
                type="number"
                value={config.profitMargin}
                onChange={(e) => handleUpdateMargin(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-indigo-500"
                min="0"
                max="100"
              />
              <span className="text-slate-500 font-medium">%</span>
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-700">Unidad de Medida por Defecto</h2>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-indigo-500 bg-white">
            <option value="cm">Centímetros (cm)</option>
            <option value="in">Pulgadas (in)</option>
          </select>
        </div>
      </div>

      {/* Catálogos de Prendas y Telas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tipos de Prendas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Shirt className="w-4 h-4 text-indigo-600" /> Tipos de Prendas
          </h2>
          <form onSubmit={handleAddGarment} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. Vestido de Gala"
              value={newGarment}
              onChange={(e) => setNewGarment(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {garmentTypes.map((g) => (
              <li key={g.id} className="py-2 flex justify-between items-center text-slate-700">
                <span>{g.name}</span>
                <button onClick={() => handleDeleteGarment(g.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Catálogo de Telas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-indigo-600" /> Catálogo de Telas
          </h2>
          <form onSubmit={handleAddFabric} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. Lino Italiano"
              value={newFabric}
              onChange={(e) => setNewFabric(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {fabrics.map((f) => (
              <li key={f.id} className="py-2 flex justify-between items-center text-slate-700">
                <span>{f.name}</span>
                <button onClick={() => handleDeleteFabric(f.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Definición de Medidas Completa */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-indigo-600" /> Catálogo de Medidas Estándar
        </h2>
        
        <form onSubmit={handleAddMeasurement} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Ej. Contorno de Busto"
            value={newMeasureName}
            onChange={(e) => setNewMeasureName(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-indigo-500"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as 'superior' | 'inferior' | 'general')}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-indigo-500"
          >
            <option value="superior">Prenda Superior</option>
            <option value="inferior">Prenda Inferior</option>
            <option value="general">General / Corporal</option>
          </select>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Agregar Medida
          </button>
        </form>

        <ul className="divide-y divide-slate-100 text-sm pt-2">
          {measurements.map((m) => (
            <li key={m.id} className="py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleMeasurementActive(m.id, !!m.active)}
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    m.active !== false
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-400'
                  }`}
                >
                  {m.active !== false && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={`font-medium ${m.active !== false ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {m.name || m.label || m.key}
                </span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                  {m.category || 'general'}
                </span>
              </div>
              <button onClick={() => handleDeleteMeasurement(m.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};