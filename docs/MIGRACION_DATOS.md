# Migración y respaldo de datos

## Almacenamiento actual

- Los datos viven en IndexedDB del navegador (`EdnaAtelierDB`) mediante Dexie.
- No hay backend ni sincronización. El respaldo/exportación es responsabilidad del usuario.

## Respaldo

- Desde **Configuración > Respaldo**, exportar genera un JSON v4 con: `customers`, `orders`, `garmentTypes`, `fabrics`, `measurementDefinitions`, `appConfig`, `inventory`, `payments`, `orderStatusHistory`, `inventoryMovements`.
- La importación valida estructura básica, tipos, estados, fechas `YYYY-MM-DD`, montos no negativos, IDs duplicados y referencias principales (pedido->cliente, pago/historial->pedido, movimiento->insumo).
- La restauración reemplaza las tablas del respaldo dentro de una transacción Dexie.

## Compatibilidad

- El restore acepta respaldos v1-v3 y normaliza datos faltantes (historiales/pagos/movimientos vacíos por defecto).
- Cambios de esquema futuros deben incrementar versión en `src/repositories/dexie/db.ts` y agregar migración/upgrade.

## Recomendación operativa

- Exportar respaldo antes de limpiezas de navegador, cambios grandes de versión o migración a otro equipo.
- No usar `seedData` ni borrar IndexedDB desde código sin confirmación explícita.
