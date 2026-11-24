import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { settingsRepository } from './settingsRepository';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

describe('settingsRepository', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();
  });

  describe('gestión de tipos de prenda (garmentTypes)', () => {
    it('crea un tipo de prenda con estado activo por defecto', async () => {
      const id = await settingsRepository.addGarmentType('Vestido de Gala');
      const item = await db.garmentTypes.get(id);

      expect(item).toBeDefined();
      expect(item?.name).toBe('Vestido de Gala');
      expect(item?.active).toBe(true);
    });

    it('permite desactivar un tipo de prenda mediante updateGarmentType', async () => {
      const id = await settingsRepository.addGarmentType('Falda');
      await settingsRepository.updateGarmentType(id, { active: false });

      const updated = await db.garmentTypes.get(id);
      expect(updated?.active).toBe(false);
      expect(updated?.name).toBe('Falda');
    });

    it('permite reactivar un tipo de prenda inactivo con updateGarmentType', async () => {
      const id = await settingsRepository.addGarmentType('Pantalón');
      await settingsRepository.updateGarmentType(id, { active: false });
      let item = await db.garmentTypes.get(id);
      expect(item?.active).toBe(false);

      await settingsRepository.updateGarmentType(id, { active: true });
      item = await db.garmentTypes.get(id);
      expect(item?.active).toBe(true);
    });

    it('actualiza el nombre de una prenda sin alterar su estado activo', async () => {
      const id = await settingsRepository.addGarmentType('Camisa');
      await settingsRepository.updateGarmentType(id, { name: 'Camisa Guayabera' });

      const updated = await db.garmentTypes.get(id);
      expect(updated?.name).toBe('Camisa Guayabera');
      expect(updated?.active).toBe(true);
    });

    it('lista todos los tipos de prenda reflejando los cambios de estado', async () => {
      const id1 = await settingsRepository.addGarmentType('Abrigo');
      const id2 = await settingsRepository.addGarmentType('Chaleco');

      await settingsRepository.updateGarmentType(id2, { active: false });

      const all = await settingsRepository.getGarmentTypes();
      expect(all).toHaveLength(2);
      expect(all.find((g) => g.id === id1)?.active).toBe(true);
      expect(all.find((g) => g.id === id2)?.active).toBe(false);
    });
  });

  describe('gestión de telas (fabrics)', () => {
    it('crea una tela con estado activo por defecto', async () => {
      const id = await settingsRepository.addFabric('Seda Italiana');
      const item = await db.fabrics.get(id);

      expect(item).toBeDefined();
      expect(item?.name).toBe('Seda Italiana');
      expect(item?.active).toBe(true);
    });

    it('permite desactivar una tela mediante updateFabric', async () => {
      const id = await settingsRepository.addFabric('Lino Rústico');
      await settingsRepository.updateFabric(id, { active: false });

      const updated = await db.fabrics.get(id);
      expect(updated?.active).toBe(false);
      expect(updated?.name).toBe('Lino Rústico');
    });

    it('permite reactivar una tela inactiva con updateFabric', async () => {
      const id = await settingsRepository.addFabric('Chifón');
      await settingsRepository.updateFabric(id, { active: false });
      let item = await db.fabrics.get(id);
      expect(item?.active).toBe(false);

      await settingsRepository.updateFabric(id, { active: true });
      item = await db.fabrics.get(id);
      expect(item?.active).toBe(true);
    });

    it('actualiza el nombre de una tela sin modificar su identificador ni estado', async () => {
      const id = await settingsRepository.addFabric('Algodón');
      await settingsRepository.updateFabric(id, { name: 'Algodón Pima' });

      const updated = await db.fabrics.get(id);
      expect(updated?.id).toBe(id);
      expect(updated?.name).toBe('Algodón Pima');
      expect(updated?.active).toBe(true);
    });

    it('lista todas las telas reflejando los cambios de estado', async () => {
      const id1 = await settingsRepository.addFabric('Dril');
      const id2 = await settingsRepository.addFabric('Lana');

      await settingsRepository.updateFabric(id1, { active: false });

      const all = await settingsRepository.getFabrics();
      expect(all).toHaveLength(2);
      expect(all.find((f) => f.id === id1)?.active).toBe(false);
      expect(all.find((f) => f.id === id2)?.active).toBe(true);
    });
  });

  describe('configuración general (appConfig)', () => {
    it('crea configuración por defecto si no existe con el logo del atelier', async () => {
      const config = await settingsRepository.getConfig();
      expect(config.id).toBe('default');
      expect(config.profitMargin).toBe(30);
      expect(config.currency).toBe('COP');
      expect(config.logoDataUrl).toBe('/edna-logo.jpg');
    });

    it('migra el logo por defecto antiguo svg al nuevo logo jpg', async () => {
      await db.appConfig.put({
        id: 'default',
        profitMargin: 30,
        currency: 'COP',
        logoDataUrl: '/edna-logo.svg'
      });
      const migrated = await settingsRepository.getConfig();
      expect(migrated.logoDataUrl).toBe('/edna-logo.jpg');
    });

    it('actualiza el margen de ganancia y moneda persistiendo en Dexie', async () => {
      await settingsRepository.updateConfig({ profitMargin: 45, currency: 'USD' });
      const updated = await settingsRepository.getConfig();
      expect(updated.profitMargin).toBe(45);
      expect(updated.currency).toBe('USD');
    });
  });
});
