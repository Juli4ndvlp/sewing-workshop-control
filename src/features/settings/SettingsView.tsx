import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../repositories/dexie/db';
import { settingsRepository } from '../../repositories/dexie/settingsRepository';
import {
  downloadBackup,
  getBackupSummary,
  readBackupPayload,
  restoreBackupPayload
} from '../../services/backupService';
import { useToast } from '../../components/ToastProvider';
import { GarmentType, Fabric, MeasurementDefinition, AppConfig } from '../../models/types';
import {
  Plus,
  Trash2,
  Settings,
  Scissors,
  Shirt,
  Ruler,
  Sliders,
  Check,
  DatabaseBackup,
  Download,
  Upload
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementDefinition[]>([]);

  // Form inputs
  const [newGarment, setNewGarment] = useState('');
  const [newFabric, setNewFabric] = useState('');
  const [newMeasureName, setNewMeasureName] = useState('');
  const [newCategory, setNewCategory] = useState<'superior' | 'inferior' | 'general'>('superior');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState<'export' | 'import' | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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

  const handleUpdateUnit = async (unit: 'cm' | 'in') => {
    if (!config) return;
    await settingsRepository.updateConfig({ defaultMeasurementUnit: unit });
    setConfig({ ...config, defaultMeasurementUnit: unit });
  };

  const handleAddGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarment.trim()) return;
    await settingsRepository.addGarmentType(newGarment.trim());
    setNewGarment('');
    loadData();
  };

  const handleDeleteGarment = async (id: string) => {
    const used = await db.orders.where('garmentTypeId').equals(id).count();
    if (used > 0) {
      window.alert(
        `No se puede eliminar: ${used} pedido(s) usan este tipo de prenda. Puedes desactivarla si no quieres usarla en nuevos pedidos.`
      );
      return;
    }
    if (!window.confirm('¿Eliminar este tipo de prenda?')) return;
    await settingsRepository.deleteGarmentType(id);
    loadData();
  };

  const handleToggleGarmentActive = async (id: string, currentActive: boolean) => {
    await settingsRepository.updateGarmentType(id, { active: !currentActive });
    await loadData();
  };

  const handleAddFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFabric.trim()) return;
    await settingsRepository.addFabric(newFabric.trim());
    setNewFabric('');
    loadData();
  };

  const handleDeleteFabric = async (id: string) => {
    const used = await db.orders.where('fabricId').equals(id).count();
    if (used > 0) {
      window.alert(
        `No se puede eliminar: ${used} pedido(s) usan esta tela. Puedes desactivarla si no quieres usarla en nuevos pedidos.`
      );
      return;
    }
    if (!window.confirm('¿Eliminar esta tela?')) return;
    await settingsRepository.deleteFabric(id);
    loadData();
  };

  const handleToggleFabricActive = async (id: string, currentActive: boolean) => {
    await settingsRepository.updateFabric(id, { active: !currentActive });
    await loadData();
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
    const def = await db.measurementDefinitions.get(id);
    const key = def?.key;
    const used = key
      ? (await db.orders.toArray()).filter(
          (o) => o.measurements && Object.prototype.hasOwnProperty.call(o.measurements, key)
        ).length
      : 0;
    if (used > 0) {
      window.alert(
        `No se puede eliminar: ${used} pedido(s) tienen esta medida. Puedes desactivarla si no quieres usarla en nuevos pedidos.`
      );
      return;
    }
    if (!window.confirm('¿Eliminar esta medida?')) return;
    await settingsRepository.deleteMeasurementDefinition(id);
    await loadData();
  };

  const handleExportBackup = async () => {
    const pwd = window.prompt(
      'Contraseña opcional para cifrar el respaldo (déjalo vacío para no cifrar):'
    );
    if (pwd === null) return;
    setBackupBusy('export');
    setBackupFeedback(null);
    try {
      await downloadBackup(pwd.trim() || undefined);
      setBackupFeedback({
        type: 'success',
        message: pwd.trim()
          ? 'Respaldo cifrado descargado correctamente.'
          : 'Respaldo descargado correctamente.'
      });
      showToast(
        pwd.trim() ? 'Respaldo cifrado descargado.' : 'Respaldo descargado correctamente.',
        'success'
      );
    } catch (error) {
      console.error('Error al exportar el respaldo:', error);
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo generar el respaldo. Intenta de nuevo.';
      setBackupFeedback({ type: 'error', message: msg });
      showToast(msg, 'error');
    } finally {
      setBackupBusy(null);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBackupBusy('import');
    setBackupFeedback(null);
    try {
      let parsed;
      try {
        parsed = await readBackupPayload(file);
      } catch (e) {
        if (e instanceof Error && e.message.includes('cifrado')) {
          const pwd = window.prompt('Este respaldo está cifrado. Ingresa la contraseña:');
          if (pwd === null) {
            setBackupBusy(null);
            return;
          }
          parsed = await readBackupPayload(file, pwd);
        } else {
          throw e;
        }
      }
      const { payload, data } = parsed;
      const summary = getBackupSummary(payload, data);
      const confirmed = window.confirm(
        `Restaurar este respaldo reemplazará TODOS los datos actuales.\n\nResumen del respaldo (v${summary.version}):\n- Clientes: ${summary.customers}\n- Pedidos: ${summary.orders}\n- Pagos: ${summary.payments}\n- Inventario: ${summary.inventory}\n- Prendas: ${summary.garmentTypes}\n- Telas: ${summary.fabrics}\n- Exportado: ${summary.exportedAt}\n\n¿Deseas continuar?`
      );
      if (!confirmed) {
        setBackupBusy(null);
        return;
      }
      await restoreBackupPayload(data);
      setBackupFeedback({
        type: 'success',
        message: 'Respaldo restaurado. Recargando la aplicación...'
      });
      showToast('Respaldo restaurado. Recargando...', 'success');
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Error al restaurar el respaldo:', error);
      const message = error instanceof Error ? error.message : 'No se pudo restaurar el respaldo.';
      setBackupFeedback({ type: 'error', message });
      showToast(message, 'error');
      setBackupBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Configuración
        </p>
        <h1 className="text-3xl font-semibold text-stone-900 flex items-center gap-2 mt-1">
          <Settings className="w-7 h-7 text-stone-700" />
          Ajustes del taller
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Configura parámetros financieros, catálogos y respaldos de Edna Atelier.
        </p>
      </div>

      {/* Respaldo de datos */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-3">
        <div>
          <h2 className="font-semibold text-stone-700 flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4 text-stone-700" /> Respaldo de datos
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Descarga una copia completa de clientes, pedidos, pagos, catálogos e inventario.
            Guárdala fuera del navegador: es la única forma de recuperar la información si se borran
            los datos del sitio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={backupBusy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {backupBusy === 'export' ? 'Generando respaldo...' : 'Descargar respaldo'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={backupBusy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {backupBusy === 'import' ? 'Restaurando...' : 'Restaurar respaldo'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        {backupFeedback && (
          <p
            role="status"
            className={`text-xs font-medium rounded-lg px-3 py-2 ${
              backupFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {backupFeedback.message}
          </p>
        )}
      </div>

      {/* Sincronización */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-2">
        <h2 className="font-semibold text-stone-700">Sincronización multidispositivo</h2>
        <p className="text-xs text-stone-500">
          Actualmente la app funciona solo en este navegador (IndexedDB). Una sincronización
          opcional requeriría backend, autenticación, consentimiento explícito, política de
          privacidad y estrategia de conflictos. Ver <code>docs/SINCRONIZACION.md</code>.
        </p>
      </div>

      {/* Margen Financiero y Preferencias Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {config && (
          <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-3">
            <h2 className="font-semibold text-stone-700 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-stone-700" /> Margen de Ganancia General (%)
            </h2>
            <div className="flex items-center gap-4 max-w-xs">
              <input
                type="number"
                value={config.profitMargin}
                onChange={(e) => handleUpdateMargin(Number(e.target.value))}
                className="glass-input !py-2"
                min="0"
                max="100"
              />
              <span className="text-stone-500 font-medium">%</span>
            </div>
          </div>
        )}

        <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-3">
          <h2 className="font-semibold text-stone-700">Unidad de Medida por Defecto</h2>
          <select
            value={config?.defaultMeasurementUnit || 'cm'}
            onChange={(e) => handleUpdateUnit(e.target.value as 'cm' | 'in')}
            className="w-full bg-white/50 backdrop-blur-md border border-white/70 rounded-xl px-3.5 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20"
          >
            <option value="cm">Centímetros (cm)</option>
            <option value="in">Pulgadas (in)</option>
          </select>
        </div>
      </div>

      {/* Catálogos de Prendas y Telas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tipos de Prendas */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-4">
          <h2 className="font-semibold text-stone-700 flex items-center gap-2">
            <Shirt className="w-4 h-4 text-stone-700" /> Tipos de Prendas
          </h2>
          <form onSubmit={handleAddGarment} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. Vestido de Gala"
              value={newGarment}
              onChange={(e) => setNewGarment(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-stone-400"
            />
            <button
              type="submit"
              className="bg-stone-900 text-white p-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {garmentTypes.map((g) => (
              <li key={g.id} className="py-2 flex justify-between items-center text-stone-700">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleGarmentActive(g.id, g.active !== false)}
                    title={
                      g.active !== false
                        ? 'Activa (clic para desactivar)'
                        : 'Desactivada (clic para activar)'
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      g.active !== false
                        ? 'bg-emerald-500 border-emerald-600 text-white'
                        : 'bg-stone-100 border-stone-300 text-stone-400'
                    }`}
                  >
                    {g.active !== false && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <span
                    className={
                      g.active !== false ? 'text-stone-800' : 'text-stone-400 line-through'
                    }
                  >
                    {g.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteGarment(g.id)}
                  className="text-stone-400 hover:text-rose-600 transition-colors"
                  aria-label={`Eliminar ${g.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Catálogo de Telas */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-4">
          <h2 className="font-semibold text-stone-700 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-stone-700" /> Catálogo de Telas
          </h2>
          <form onSubmit={handleAddFabric} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. Lino Italiano"
              value={newFabric}
              onChange={(e) => setNewFabric(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-stone-400"
            />
            <button
              type="submit"
              className="bg-stone-900 text-white p-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {fabrics.map((f) => (
              <li key={f.id} className="py-2 flex justify-between items-center text-stone-700">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleFabricActive(f.id, f.active !== false)}
                    title={
                      f.active !== false
                        ? 'Activa (clic para desactivar)'
                        : 'Desactivada (clic para activar)'
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      f.active !== false
                        ? 'bg-emerald-500 border-emerald-600 text-white'
                        : 'bg-stone-100 border-stone-300 text-stone-400'
                    }`}
                  >
                    {f.active !== false && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <span
                    className={
                      f.active !== false ? 'text-stone-800' : 'text-stone-400 line-through'
                    }
                  >
                    {f.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteFabric(f.id)}
                  className="text-stone-400 hover:text-rose-600 transition-colors"
                  aria-label={`Eliminar ${f.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Definición de Medidas Completa */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60 shadow-sm shadow-stone-900/5 space-y-4">
        <h2 className="font-semibold text-stone-700 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-stone-700" /> Catálogo de Medidas Estándar
        </h2>

        <form onSubmit={handleAddMeasurement} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Ej. Contorno de Busto"
            value={newMeasureName}
            onChange={(e) => setNewMeasureName(e.target.value)}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-stone-400"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as 'superior' | 'inferior' | 'general')}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-stone-400"
          >
            <option value="superior">Prenda Superior</option>
            <option value="inferior">Prenda Inferior</option>
            <option value="general">General / Corporal</option>
          </select>
          <button
            type="submit"
            className="bg-stone-900 text-white px-4 py-1.5 rounded-lg hover:bg-stone-800 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
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
                      : 'bg-stone-100 border-stone-300 text-stone-400'
                  }`}
                >
                  {m.active !== false && <Check className="w-3.5 h-3.5" />}
                </button>
                <span
                  className={`font-medium ${m.active !== false ? 'text-stone-800' : 'text-stone-400 line-through'}`}
                >
                  {m.name || m.label || m.key}
                </span>
                <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full capitalize">
                  {m.category || 'general'}
                </span>
              </div>
              <button
                onClick={() => handleDeleteMeasurement(m.id)}
                className="text-stone-400 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
