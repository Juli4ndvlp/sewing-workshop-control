# AGENTS.md — Guía del proyecto Edna Atelier

Lee esto antes de tocar código. El detalle de hallazgos está en [`docs/AUDITORIA.md`](docs/AUDITORIA.md).

## Contexto

App de gestión de un taller de costura. React 19 + TypeScript strict + Vite 8 + Tailwind 4. Persistencia exclusivamente local con Dexie/IndexedDB (`EdnaAtelierDB`, v2). Sin backend, sin autenticación y sin multiusuario. La UI y los mensajes van en español.

## Comandos

```bash
npm run dev             # Vite en http://localhost:5173
npm run build           # tsc + build (usar como verificación mínima)
npx tsc --noEmit        # typecheck aislado
```

No hay `test`, `lint` ni `format` todavía. Si una tarea necesita tests, el agente tester configura Vitest; no inventes un runner distinto.

El build termina bien aunque Vite escriba el warning de chunks >500 kB en stderr. No lo confundas con un fallo.

## Mapa de código

Activo (montado desde `src/App.tsx`):

- `features/dashboard/DashboardPage.tsx`
- `features/orders/OrdersPage.tsx` + `features/orders/NewOrderStepper.tsx` + `features/orders/OrderDetailModal.tsx` + `features/orders/OrderReceiptModal.tsx`
- `features/clients/ClientsPage.tsx`
- `features/inventory/InventoryPage.tsx`
- `features/reports/ReportsPage.tsx`
- `features/settings/SettingsView.tsx`
- `layouts/MainLayout.tsx`
- `services/orderService.ts` (casos transaccionales: crear/editar pedido con consumos, abonos, cambios de estado/cancelación)

Legado eliminado en Fase 2/3: contratos/repositorios/servicios no usados (`IOrderRepository`, `IConfigRepository`, `DexieOrderRepository`, `financialService`, `seedData`). No reintroducir capas muertas; si se crea una abstracción, debe tener uso real.

`NewOrderStepper` es el flujo canónico para crear y editar pedidos. No dupliques lógica de pedidos en otro formulario.

## Reglas de dominio

- **Moneda**: pesos colombianos (COP), almacenados como `number`. Formatea con `Intl.NumberFormat('es-CO', { style: 'currency', currency })`, no con `'$' + toLocaleString()`.
- **Fechas**: `deliveryDate` es la fuente de verdad y se guarda como `YYYY-MM-DD` (date-only). `Order.dates` está obsoleto: no lo uses en código nuevo. Nunca hagas `new Date('YYYY-MM-DD')` para mostrar, porque interpreta UTC y en Colombia muestra un día antes. Usa un helper que construya fecha local.
- **Estados**: `pending → in_progress → ready → delivered`; `cancelled` es terminal. Cancelados no cuentan en ingresos, ganancia, cartera ni pedidos en curso.
- **Finanzas**: un pedido guarda `materialCost + laborCost = totalCost`, `totalPrice`, `advancePayment` y `pendingBalance`. `pendingBalance = max(0, totalPrice - advancePayment)` siempre. No confíes en un `pendingBalance` leído de una prop: recalcúlalo desde el registro fresco. Un pedido con `totalCost = 0` está “sin costear”, no tiene 100 % de margen.
- **Pagos**: se registran en la tabla `payments` (historial con fecha) y deben validarse (`0 < monto <= saldo`) dentro de una transacción Dexie. `financials.advancePayment` y `pendingBalance` se derivan del historial; no confíes en props obsoletas.
- **Prendas**: `Order.garmentTypeId` debe ser el id de un registro de `garmentTypes`. `garmentType` es solo texto de apoyo/migración. No guardes la descripción libre en el id.
- **Borrados**: clientes, prendas, telas y medidas pueden estar referenciados por pedidos. Prefiere desactivar (`active: false`) o bloquear con confirmación de impacto; no borres en cascada sin decisión explícita.
- **Datos**: cualquier cambio de esquema requiere subir la versión en `db.ts` y escribir migración. Nunca ejecutes `seedData` sobre datos reales. No borres IndexedDB desde código sin confirmación del usuario.

## Convenciones de código

- TypeScript strict, sin `any`; prefiere tipos del dominio en `src/models/types.ts`.
- Componentes funcionales, hooks, Tailwind. Iconos con `lucide-react`.
- Acceso a datos: usa o crea repositorios en `src/repositories/`; no metas queries nuevas directamente en componentes si la lógica se va a reutilizar.
- Lógica de negocio (dinero, fechas, estados) fuera de los componentes, en `src/services/` o `src/utils/`, y cubierta con tests.
- Modales: `role="dialog"`, `aria-modal`, cierre con Escape, foco inicial y `aria-label` en botones de icono.
- Errores visibles para el usuario; no dejes solo `console.error`.
- Cambios pequeños y enfocados. No mezcles refactors masivos con features.
- Al agregar dependencias, justifica por qué y revisa el impacto en el bundle.
- Actualiza este archivo y `docs/AUDITORIA.md` si cambias reglas o cierras hallazgos.

## Definición de terminado

1. El cambio resuelve un criterio de aceptación verificable.
2. `npx tsc --noEmit` y `npm run build` pasan.
3. Si hay tests, pasan y cubren el caso (incluido el borde que motivó el cambio).
4. Probado manualmente el flujo afectado en `npm run dev`.
5. Sin código muerto nuevo ni `console.error` como único manejo de error.
6. Documentación o criterios actualizados cuando aplica.

## Trampas conocidas (no reintroducir)

- Leer el saldo o el abono desde una prop capturada antes de una mutación.
- Mezclar `deliveryDate` con `dates.deliveryDate`.
- Sumar pedidos cancelados a métricas.
- Crear pedidos sin costos y presentarlos como rentables.
- Hardcodear `AppConfig`, nombre del negocio, moneda o logo en vez de leer Ajustes.
- Usar `order.garmentTypeId` como texto libre.
- Formularios que guardan silenciosamente una fecha por defecto cuando el usuario no eligió una.

## Agentes disponibles

- `atelier-reviewer`: analiza cambios y busca regresiones; no edita.
- `atelier-tester`: escribe tests y configura el runner; solo edita tests e infraestructura de test.
- `atelier-dev`: implementa cambios acotados siguiendo esta guía.
- `atelier-verifier`: verifica criterios de aceptación con evidencia; no edita.
- `architecture-reviewer`: revisa la arquitectura de Edna Atelier (capas, dominio, persistencia, límites de módulos, deuda técnica) y propone mejoras concretas. Solo lectura.
- `page-optimizer`: optimiza páginas/UI, refactoriza y elimina código innecesario manteniendo comportamiento. Puede editar código.
