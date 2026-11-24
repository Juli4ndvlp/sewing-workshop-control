# Sincronización multidispositivo (alcance)

## Estado actual

- La app funciona **solo local** en el navegador (IndexedDB/Dexie).
- No hay cuentas, backend ni sincronización.

## Alcance propuesto (futuro opcional)

Si se implementa, debe ser **opt-in** y con consentimiento explícito.

### Requisitos mínimos

- **Identidad y acceso**: cuentas de usuario, autenticación, recuperación y control de sesión.
- **Backend**: API + base de datos remota; no exponer IndexedDB directamente.
- **Consentimiento y privacidad**: política clara, consentimiento antes de subir datos, opción de desactivar/exportar/eliminar.
- **Conflictos**: estrategia de merge por entidad (last-write-wins con auditoría, o CRDT/operaciones) y resolución de borrados.
- **Seguridad**: cifrado en tránsito, control de acceso por taller/usuario, backups del servidor.
- **Migración**: importar respaldo local v4 como semilla inicial; exportación disponible en cualquier momento.

### Fuera de alcance por ahora

- Sincronización automática sin consentimiento.
- Multi-taller/multi-tenant complejo antes de validar necesidad real.
- Envío automático de mensajes sin confirmación del usuario.
