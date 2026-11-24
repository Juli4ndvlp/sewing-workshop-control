# Auditoría — Edna Atelier

Fecha: 2026-11-23
Alcance: todo `src/`, configuración y estado del repositorio (commit `775deaa`).

## Resumen ejecutivo

La app es un MVP funcional: compila, guarda pedidos en IndexedDB y genera un PDF. La arquitectura por capas está insinuada (modelos, repositorios, servicios, features), pero la implementación está a medio migrar: conviven dos flujos de pedidos, tres implementaciones de clientes y varios servicios sin conectar.

Los riesgos principales no son estéticos:

1. **Se pueden perder pagos registrados** por un estado obsoleto en el modal de detalle.
2. **Las fechas de entrega no se muestran** en la lista y el comprobante por un campo duplicado (`deliveryDate` vs `dates.deliveryDate`).
3. **No hay respaldo de datos**: IndexedDB local es el único almacenamiento.
4. **Los KPIs financieros son incorrectos** porque pedidos cancelados suman y los costos creados desde el formulario activo quedan en cero.
5. **El catálogo de prendas no se usa** al crear pedidos: se guarda texto libre en el campo que debería ser una FK.

El build y `tsc --noEmit` pasan. No hay tests, lint, formato ni CI, así que nada de esto está protegido contra regresiones.

## Cómo está construido

- React 19 + TypeScript strict + Vite 8 + Tailwind 4.
- Persistencia: Dexie/IndexedDB, base `EdnaAtelierDB` v2 (`src/repositories/dexie/db.ts`).
- Estado global: solo `useState` en `App` para pestaña activa y modal de pedido. No hay router ni store.
- Mutaciones: mezcla de repositorios (`DexieOrderRepository`, `DexieCustomerRepository`) y acceso directo a `db` desde componentes.
- UI: modales propios, sin librería de componentes ni sistema de notificaciones.
- Dinero: números flotantes en pesos, sin utilidad monetaria central.

## Bugs priorizados

### P0 — Corrupción de datos o pérdida de dinero

#### P0.1 Un segundo abono sobrescribe el primero

- Evidencia: `src/features/orders/OrderDetailModal.tsx:76-89` calcula el nuevo abono desde `order.financials`, que viene de una prop capturada al abrir el modal. `src/features/orders/OrdersPage.tsx:189-195` recarga la lista, pero no actualiza `selectedOrderForDetails`; el modal sigue mostrando el objeto viejo.
- Impacto: el primer abono se pierde al registrar el segundo. Además, el saldo mostrado y el estado del pedido quedan obsoletos tras cualquier cambio.
- Arreglo: dentro de una transacción, leer el pedido actual de Dexie, sumar el abono y volver a escribir. Después, actualizar tanto la lista como el pedido seleccionado con el registro devuelto. Validar `0 < abono <= saldo pendiente`.

#### P0.2 Fechas de entrega invisibles e inconsistentes

- Evidencia: el modelo declara `deliveryDate` y además `dates.deliveryDate` (`src/models/types.ts:33-38`). Todos los formularios escriben `deliveryDate` (`src/features/orders/OrderFormModal.tsx:71`, `NewOrderStepper.tsx:67`), pero la lista y el comprobante leen `order.dates?.deliveryDate` (`OrdersPage.tsx:154`, `OrderReceiptModal.tsx:80-87`).
- Impacto: la lista muestra “No definida” y el comprobante “Por coordinar” aunque la fecha exista. El dashboard y el detalle sí la leen de la raíz, así que la app se contradice.
- Arreglo: una sola fuente de verdad (`deliveryDate` en la raíz), eliminar `dates` del modelo y migrar registros existentes. Centralizar formato de fecha.

#### P0.3 La prenda se guarda como texto libre en vez de una FK

- Evidencia: `OrderFormModal.tsx:67-68` asigna `garmentTypeId: garmentType.trim()` (la descripción escrita). `OrderDetailModal.tsx:42-44` y `:144` intentan `db.garmentTypes.get(order.garmentTypeId)`, que falla; el PDF cae en “Prenda Personalizada”.
- Impacto: el catálogo de tipos de prenda de Ajustes es decorativo en el flujo activo, se rompe el detalle y el PDF, y no se pueden agrupar pedidos por tipo.
- Arreglo: selector de `garmentTypeId` desde el catálogo, con descripción/detalle aparte. Migrar pedidos existentes: si `garmentType` no es un id, crear/mapear el tipo y conservar el texto como descripción.

#### P0.4 Los pedidos cancelados contaminan todos los KPIs

- Evidencia: `src/features/dashboard/DashboardPage.tsx:41-50` suma todos los pedidos a ingresos, costos y saldos; `activeOrders` solo excluye `delivered`, por lo que incluye `cancelled`. Además, las barras de producción (`:131-152`) usan `orders.length` como denominador pero no cuentan cancelados.
- Impacto: ingresos, ganancia, cartera y “pedidos en curso” inflados; porcentajes que no suman 100.
- Arreglo: excluir `cancelled` de métricas y operación; definir si “ingresos” es facturado, cobrado o proyectado y documentarlo.

#### P0.5 Fechas date-only se muestran un día antes en Colombia

- Evidencia: `new Date('2026-09-15')` se interpreta como medianoche UTC. En UTC-5 se muestra el 14. Ocurre en `DashboardPage.tsx:172-208`, `OrdersPage.tsx:154`, `OrderDetailModal.tsx:201` y `pdfService.ts:91`.
- Impacto: entregas y facturas con fecha equivocada; mayor riesgo cerca de fin de mes y en recordatorios.
- Arreglo: helper `parseDateOnly` que construya la fecha en hora local, y `formatDate` único. No usar `new Date(string)` para `YYYY-MM-DD`.

#### P0.6 Cobros sin límite y saldo derivado duplicado

- Evidencia: `max` del input es solo HTML (`OrderDetailModal.tsx:250`), no se valida en JS. `pendingBalance` se persiste y recalcula en varios sitios (`OrderFormModal.tsx:57`, `OrderDetailModal.tsx:80`, `NewOrderStepper.tsx:52`), y `FinancialService` no se usa.
- Impacto: un abono puede superar el total; el saldo puede desincronizarse entre pantallas. No hay historial de pagos, solo un acumulado.
- Arreglo: modelo `Payment[]` por pedido (fecha, monto, método), calcular `advancePayment` y `pendingBalance` desde pagos, y validar contra el total en una transacción.

#### P0.7 No existe respaldo ni restauración

- Evidencia: no hay exportación/importación en `src/`; toda la información está en IndexedDB.
- Impacto: limpiar datos del navegador, cambiar de equipo o usar otro perfil borra clientes, pedidos y pagos sin recuperación.
- Arreglo: `backupService` con export/import JSON versionado, descarga y restauración con confirmación. Programar recordatorio y, más adelante, sincronización opcional.

### P1 — Funcionalidad rota o incoherente

#### P1.1 La pestaña “Producción” no existe

- Evidencia: `MainLayout.tsx:33` la ofrece en el menú; `App.tsx:21-40` no tiene `case 'production'`, así que cae en `default` y muestra el dashboard.
- Arreglo: implementarla (tablero tipo kanban por estado) o quitarla del menú. Si se implementa, tipar los ids de pestaña para que el `switch` sea exhaustivo.

#### P1.2 Facturas ignoran configuración y cliente real

- Evidencia: `OrderDetailModal.tsx:102-123` y `OrderReceiptModal.tsx:14-36` construyen `AppConfig` y `Customer` hardcodeados (“Cliente General”, COP, logo fijo) en vez de leer `settingsRepository.getConfig()` y el cliente del pedido.
- Impacto: nombre del negocio, moneda, logo y datos del cliente configurados en Ajustes no llegan a la factura.
- Arreglo: cargar configuración y cliente antes de generar el PDF; un único `PDFContext` o servicio que reciba datos resueltos.

#### P1.3 El margen global configurado no se usa

- Evidencia: `SettingsView.tsx:35-39` guarda `profitMargin`, pero `OrderFormModal.tsx:73-81` crea costos y margen en cero y `NewOrderStepper.tsx:33` fija 30 % por defecto.
- Impacto: la configuración financiera es decorativa y los pedidos nuevos nacen sin costos, inflando la ganancia del dashboard.
- Arreglo: el formulario canónico debe cargar el margen configurado y capturar materiales, mano de obra y precio. Un pedido sin costos debe marcarse como “sin costear”, no como 100 % de ganancia.

#### P1.4 El formulario activo de pedido es el más pobre

- Evidencia: `OrderFormModal.tsx` no captura medidas, tela, costos ni tipo de prenda del catálogo; `measurements: {}` y `totalCost: 0`. Ya existe un flujo más completo, `NewOrderStepper.tsx`, pero está desconectado.
- Impacto: se pierde información clave del taller y se duplica trabajo. El usuario convive con dos experiencias distintas.
- Arreglo: consolidar en un solo formulario (recomendado: el stepper), mover la lógica de cotización a un servicio de dominio y borrar el otro.

#### P1.5 Sin clientes no se puede crear un pedido y no hay salida

- Evidencia: `OrderFormModal.tsx:121-130` muestra “No hay clientes registrados” y el botón se deshabilita (`:255`), sin acción para crear un cliente desde ahí.
- Impacto: bloqueo en el primer uso del taller.
- Arreglo: CTA “Crear cliente” dentro del modal o un alta rápida (nombre + teléfono) que continúe el flujo.

#### P1.6 Borrados sin integridad referencial

- Evidencia: `ClientsPage.tsx:73-78` elimina clientes sin revisar pedidos; `SettingsView.tsx:49-52`, `:62-65` y `:81-84` eliminan prendas, telas y medidas referenciadas por pedidos.
- Impacto: pedidos huérfanos, detalles y PDF con datos incompletos, históricos imposibles de reconstruir.
- Arreglo: borrado lógico (`active: false`) por defecto, bloqueo si hay pedidos activos y confirmación con impacto (“3 pedidos usan esta tela”).

#### P1.7 Tres pantallas de clientes y dos de pedidos, con reglas distintas

- Evidencia: activa `features/clients/ClientsPage.tsx`; sin uso `CustomersPage.tsx`, `CustomerListPage.tsx`, `CustomerFormModal.tsx`, `CustomersView.tsx`, `OrderListPage.tsx`, `NewOrderStepper.tsx` y `SettingsPage.tsx`. `ClientsPage` exige teléfono; `CustomerFormModal` no. Las medidas dinámicas de Ajustes solo se usan en el código muerto.
- Impacto: se elige la implementación equivocada con facilidad; la experiencia y la validación cambian según la pantalla.
- Arreglo: decidir la implementación canónica, borrar el resto y unificar validaciones.

#### P1.8 Cancelación y ciclo de vida incompletos

- Evidencia: `OrderStatus` incluye `cancelled` (`types.ts:14`), pero el detalle no lo ofrece (`OrderDetailModal.tsx:126-131`), los tabs no lo filtran (`OrdersPage.tsx:98-104`) y el dashboard no lo aísla.
- Impacto: no se puede cancelar desde la UI; si se hace por datos, desaparece de las vistas y contamina métricas.
- Arreglo: transiciones explícitas (`pending → in_progress → ready → delivered`), cancelación con motivo, historial de estados y filtro correspondiente.

#### P1.9 Inventario solo permite crear

- Evidencia: `InventoryPage.tsx` no tiene edición, reposición ni borrado. El umbral de stock bajo está fijo en 3 (`:145`). El modelo duplica campos (`stock`/`quantity`, `unitCost`/`unitPrice`, `types.ts:76-86`) y no se vincula a pedidos.
- Impacto: el inventario se vuelve inútil en cuanto hay movimientos; no descuenta materiales ni avisa de forma útil.
- Arreglo: movimientos de inventario (entrada/salida/ajuste), edición, umbral por ítem y consumo asociado a pedidos.

#### P1.10 Errores silenciosos y doble envío

- Evidencia: antes todos los `catch` hacían `console.error` sin feedback. Se agregó `ErrorBoundary` global y `ToastProvider` básico; `SettingsView` ya usa toasts en respaldo/restauración. Aún faltan toasts/estados de error uniformes en todos los flujos y bloqueo de doble submit en algunas acciones.
- Impacto: menor que antes, pero todavía hay flujos donde el usuario puede no ver el resultado de un fallo.
- Arreglo pendiente: extender toasts/estados `saving/error` y deshabilitar acciones en curso en pedidos, clientes e inventario.

#### P1.11 El seed borra datos reales sin confirmación

- Evidencia: `seedData.ts:5-10` limpia clientes, catálogos y pedidos. Solo se importa desde `SettingsPage.tsx`, que no está montada, pero sigue en el repo.
- Impacto: si alguien la reconecta, pierde la base completa.
- Arreglo: mover a script de desarrollo, exigir `confirm` explícito y excluirlo del bundle de producción.

#### P1.12 Ajustes con controles que no hacen nada

- Evidencia: el selector “Unidad de Medida por Defecto” no tiene estado ni persistencia (`SettingsView.tsx:117-123`). `settingsRepository.updateConfig` hace `update` y no crea la config si falta (`settingsRepository.ts:16-18`).
- Impacto: configuración engañosa; fallo silencioso en una base nueva.
- Arreglo: persistir la unidad o quitar el control; hacer `put`/upsert de configuración.

### P2 — Calidad, UX y rendimiento

- **Búsqueda limitada**: `OrdersPage.tsx:40-47` no busca por cliente, estado, tela ni fechas, y usa el texto `garmentType` en vez del catálogo. No hay ordenamiento por entrega ni paginación.
- **Validación de fechas**: se aceptan entregas en el pasado y el formulario reemplaza una fecha vacía por “ahora” (`OrderFormModal.tsx:71`).
- **Moneda inconsistente**: cada pantalla usa `toLocaleString()` del sistema y `$`; se ignora `config.currency`. `pdfService` sí usa `Intl` con COP.
- **Accesibilidad**: modales principales usan `role="dialog"`, `aria-modal`, Escape, foco inicial/trampa y restauración de foco vía `useDialogA11y`. Falta auditoría completa de teclado/lectores en toda la app.
- **Bundle**: mejorado con `React.lazy` en rutas y `import()` dinámico para PDF; el build actual ya no emite warning de chunk >500 kB. Sigue habiendo chunks pesados (pdfService/html2canvas/jsPDF) pero se cargan bajo demanda.
- **Sin routing**: la pestaña activa vive en memoria; recargar vuelve al dashboard y no se pueden compartir enlaces.
- **Sin tests, lint, formato ni CI**: `package.json` solo tiene `dev`, `build` y `preview`.
- **README**: estaba en UTF-16 y con una sola línea; ya reemplazado.
- **Rendimiento**: todas las colecciones se cargan completas en memoria; suficiente para un taller pequeño, a revisar si crece.
- **PWA base**: hay `manifest.webmanifest`, íconos PNG/SVG, `sw.js` básico y registro en producción. Falta validar instalación/offline en dispositivos y refinar estrategia de cache.
- **Métricas sin definición**: no se distingue facturado, cobrado y proyectado; “Ingresos Totales” etiqueta facturación proyectada pero suma todo.
- **Sin historial de pagos ni de estados**: no se puede auditar cuándo se cobró ni quién cambió qué.

## Qué está bien y conviene conservar

- Stack simple y adecuado para uso local; TypeScript strict sin `any` evidentes.
- Dexie versionado (v1 → v2) en vez de `localStorage`.
- Separación inicial por modelos, repositorios, servicios y features.
- Interfaz consistente en Tailwind, con iconografía clara y buena densidad de información.
- Cálculo de saldo en tiempo real en el formulario y PDF funcional.
- `tsc` y build pasan; no hay deuda de compilación.

## Estado de implementación (actualización)

Actualización aplicada en código (Fase 0 y Fase 1 completadas en el flujo activo; pendiente validación manual en `npm run dev`):

- **P0.1 Abonos**: corregido. El abono se registra en transacción Dexie leyendo el pedido fresco, valida `0 < monto <= saldo`, recalcula saldo y actualiza el modal/lista con el registro devuelto.
- **P0.2 Fechas**: corregido. `deliveryDate` es la fuente única; se eliminó `Order.dates` del tipo, se agregó migración v3 para levantar `dates.deliveryDate` y se centralizó formato/parse en `src/utils/dates.ts`.
- **P0.3 FK de prenda**: corregido. El formulario usa catálogo de prendas (o crea un tipo personalizado) y guarda `garmentTypeId` real; migración v3 normaliza pedidos legacy con texto libre.
- **P0.4 Cancelados**: corregido. Los cancelados se excluyen de ingresos, ganancia costeada, cartera y pedidos en curso; se agregan filtro/contador de cancelados.
- **P0.5 Date-only**: corregido. Las fechas `YYYY-MM-DD` se parsean/formatean en hora local para evitar desfase de un día.
- **P0.6 Límite de cobros/historial**: corregido. Abonos con validación y transacción Dexie; historial en tabla `payments` (v4) con fecha, migración de abonos legacy y respaldo JSON v4 compatible con v1-v3.
- **P0.7 Respaldo**: corregido. Export/import JSON versionado con confirmación en Ajustes (`src/services/backupService.ts`).
- **Fase 1.1 Flujo único**: `NewOrderStepper.tsx` es el flujo canónico modal para crear y editar pedidos; `OrderFormModal`, `OrderListPage`, `SettingsPage` y duplicados de `customers/*` eliminados.
- **Fase 1.2 Config/margen**: el stepper carga `profitMargin`/moneda desde configuración; se muestra alerta de pedido sin costear.
- **Fase 1.3 Validación/estado/cancelación**: validaciones de fecha/montos/abono; cancelación con `cancellationReason` obligatorio; transiciones de estado más estrictas (`pending↔in_progress↔ready→delivered`, `delivered→ready` para corrección, cualquier no terminal→`cancelled`, `cancelled` terminal).
- **Fase 1.4 Medidas cliente**: el stepper precarga medidas del cliente; `ClientsPage` permite capturar/editar medidas del cliente usando el catálogo de medidas.
- **Fase 1.5 PDF**: comprobante/factura PDF usa datos reales de configuración, cliente y prenda.
- **Visual**: pasada visual aplicada a layout, Dashboard, Pedidos, Clientes, Inventario, Configuración y modales activos (paleta cálida, tipografía, jerarquía).
- **P1.12 Unidad de medida en Ajustes**: corregido. Selector conectado al modelo `AppConfig` (`defaultMeasurementUnit`), persistido en Dexie con soporte de upsert en `settingsRepository`.
- **Inventario**: formateo de moneda unificado con `formatCurrency()` en [InventoryPage.tsx](file:///c:/Users/Julian/Documents/Atelier/gemini/src/features/inventory/InventoryPage.tsx).
- **Repositorios**: capa de clientes consolidada en `customerRepository.ts` siguiendo el patrón limpio de `settingsRepository`; contratos huérfanos eliminados.

Verificación ejecutada: `npx tsc --noEmit` OK, `npm run test` OK (28/28), `npm run build` OK (warning conocido de chunk >500 kB).

## Plan de mejora recomendado

### Fase 0 — Detener pérdidas (1–3 días)

Completada (P0.6 parcial por historial de pagos).

### Fase 1 — Un solo flujo de pedido (3–5 días)

Completada en el flujo activo.

1. ~~Consolidar el formulario en el stepper (cliente → prenda/tela/medidas → costos y pago).~~
2. ~~Cargar margen y configuración reales; marcar pedidos sin costear.~~
3. ~~Validar fechas, montos y transiciones de estado; agregar cancelación con motivo.~~
4. ~~Resolver cliente desde el modal de pedido y precargar sus medidas.~~
5. ~~PDF con configuración, cliente y prenda reales; carga diferida.~~

### Fase 2 — Operación del taller (1–2 semanas)

Completada en base operativa:

1. Inventario: edición de insumos, umbral `minStock`, alertas de stock bajo, movimientos en `inventoryMovements` (v7), consumo por pedido (`Order.consumptions`) con descuento automático al crear/editar y devolución al cancelar. Stock editable manualmente con movimiento `manual`. Vista simple de últimos movimientos agregada en Inventario.
2. Historial: pagos en `payments` e historial de estados en `orderStatusHistory`, visibles en detalle de pedido.
3. Clientes: pantalla única con medidas dinámicas y modal de historial de pedidos por cliente.
4. Avisos: entregas vencidas, próximas (3 días) y stock bajo en dashboard.

### Fase 3 — Calidad y mantenimiento (continuo)

Completada en base práctica (2026-05):

1. Vitest + React Testing Library + `fake-indexeddb` configurados; tests ampliados para fechas, dinero, backup, pagos transaccionales y `orderService` (crear/consumos, stock insuficiente, cancelación con devolución, abonos, transiciones inválidas).
2. CI agregado en `.github/workflows/ci.yml` (typecheck, tests, build). Prettier configurado. ESLint configurado para JS/config (`eslint.config.js`); `lint` ejecuta `tsc --noEmit && eslint .`. `lint:eslint` completo para TS/TSX queda bloqueado por incompatibilidad actual de `typescript-eslint` con TypeScript 7.
3. `ErrorBoundary` global y `ToastProvider` básico agregados; errores visibles en flujos clave (respaldo/restauración y validaciones de dominio). Falta cobertura uniforme de toasts/estados en toda la app.
4. Accesibilidad base en modales: `role="dialog"`, `aria-modal`, Escape, foco inicial, trampa Tab y restauración de foco vía `useDialogA11y`. Falta auditoría completa.
5. Código muerto legado eliminado; lógica transaccional de pedidos extraída a `src/services/orderService.ts`.
6. PWA base implementada (manifest, íconos PNG/SVG, service worker básico, registro en producción). Falta validación offline/instalación en dispositivos. Migración de datos documentada en `docs/MIGRACION_DATOS.md`.

### Fase 4 — Producto

En progreso:

1. **Completado (base)**: página `Reportes` con filtro por período, métricas (facturado, cobrado, costo, margen real, cartera activa) y exportación CSV.
2. **Decisión (diferido)**: sincronización multidispositivo no implementada. Se mantiene fuera hasta definir backend, auth, cifrado/privacidad, consentimiento y resolución de conflictos (ver `docs/SINCRONIZACION.md`).
3. **Decisión (omitido)**: recordatorios automáticos/manuales WhatsApp/email retirados por ahora. Si se retoman, deben ser opt-in, con consentimiento y sin envío automático.
4. **Completado (base)**: calendario de entregas en Dashboard con importancia, detalle por día, y apertura de detalle de pedido al hacer clic.
5. **Completado (base)**: Dashboard con filtros rápidos (Todas/Vencidas/Listas/Con saldo) y datos de cliente visibles en próximas entregas.
6. **Completado (base)**: respaldo con resumen antes de restaurar y cifrado opcional por contraseña (Web Crypto AES-GCM + PBKDF2).

## Criterios de aceptación sugeridos para las correcciones P0

- Registrar dos abonos consecutivos conserva la suma y el saldo; recargar la página no cambia el resultado.
- Un abono mayor al saldo se rechaza con mensaje visible.
- La fecha de entrega se muestra igual en lista, detalle, dashboard, comprobante y PDF, sin desfase de un día.
- Los pedidos cancelados no aparecen en ingresos, ganancia, cartera ni “en curso”.
- Crear un pedido desde el catálogo guarda un `garmentTypeId` existente y el detalle/PDF muestran el nombre real.
- Exportar, limpiar IndexedDB e importar restaura clientes, pedidos, pagos y catálogos.
