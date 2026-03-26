# AI User Capabilities Model

## 1. Propósito

Este documento define el modelo operativo mínimo para usuarios administrativos con:

- grupos funcionales
- capacidades directas
- `permission envelope`
- proyección controlada hacia IA

El objetivo es cerrar el MVP sin caer todavía en un RBAC fino sobredimensionado.

## 2. Principios

- La autorización real sigue validándose en backend.
- La IA no reemplaza permisos reales; los consume como contexto operativo.
- Un usuario puede operar en varias áreas al mismo tiempo.
- No se obliga a elegir un `active conversational role` para trabajar.
- Si no existe configuración explícita de grupos/capacidades, el sistema mantiene compatibilidad con el comportamiento legacy.

## 3. Modelo de datos

Sobre `User` hoy existen:

- `role`
  - rol base administrativo/auth del sistema
- `capabilityGroups`
  - grupos funcionales reutilizables
- `directCapabilities`
  - excepciones o ampliaciones puntuales por usuario

Campos agregados en backend:

- [schema.prisma](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/schema.prisma)
- [20260326141500_user_capability_groups/migration.sql](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/migrations/20260326141500_user_capability_groups/migration.sql)

## 4. Catálogo actual

### Capacidades

- `conversations.manage`
- `customers.manage`
- `appointments.manage`
- `catalog.manage`
- `orders.manage`
- `quotes.manage`
- `payments.manage`
- `aberturas.quote`
- `aberturas.register`
- `knowledge.manage`
- `ai.settings.manage`
- `users.manage`

### Grupos

- `support`
- `sales`
- `operations`
- `finance`
- `platform_admin`

La definición viva del catálogo está en:

- [capabilities.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/auth/capabilities.ts)

## 5. Resolución del permission envelope

La resolución actual sigue este orden:

1. `SUPERADMIN`
   - recibe envelope completo
   - no depende de configuración explícita
2. usuario con grupos/capacidades explícitas
   - se usa la unión de:
     - capacidades de grupos
     - capacidades directas
3. usuario sin configuración explícita
   - se aplica fallback legacy según `role`

Fuentes posibles:

- `superadmin`
- `explicit`
- `legacy_role`
- `none`

Esto permite dos comportamientos compatibles:

- no romper operadores existentes
- permitir nuevos usuarios con alcance funcional explícito

## 6. Proyección actual en el sistema

### Backend/auth

La sesión y el JWT administrativo ya exponen:

- `capabilityGroups`
- `directCapabilities`
- `capabilityEnvelope`
- `capabilitySource`
- `userManagementPolicy`
  - `canAccessUserManagement`
  - `canManageUserCapabilities`
  - `allowedUserManagementRoles`
  - `allowedCapabilityManagementRoles`

Archivos clave:

- [auth.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/auth/auth.service.ts)
- [account.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/account/account.controller.ts)

### ABM de usuarios

El admin ya puede:

- listar grupos/capacidades disponibles
- asignar grupos
- asignar capacidades directas
- editar esa configuración por usuario

Política actual:

- la gestión de usuarios y la edición de capacidades se gobiernan por configuración de backend persistida en `SystemConfig`
- claves activas:
  - `auth:userManagementAllowedRoles`
  - `auth:userCapabilityManagementAllowedRoles`
- fallback si no hay configuración válida en BD:
  - `USER_MANAGEMENT_ALLOWED_ROLES=SUPERADMIN,ADMIN`
  - `USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES=SUPERADMIN,ADMIN`
- si un perfil puede acceder al ABM pero no gestionar capacidades:
  - la UI permite administración básica de usuarios
  - el backend redacta grupos/capacidades en las respuestas
  - la UI oculta la edición de grupos/capacidades
- si un perfil no puede acceder al ABM:
  - el backend devuelve `users.access.denied`
  - la UI muestra un mensaje coherente y no intenta forzar el flujo

Nota de compatibilidad:

- el feature/ruta `Usuarios` en frontend quedó abierto a roles administrativos compatibles
- el control real sigue estando en backend por política configurable
- esto evita bloquear futuras configuraciones por tenant/empresa sin convertir el frontend en la fuente de verdad
- la sesión expone además el `source` efectivo de cada política (`database` o `environment`) para auditoría y troubleshooting

Archivos clave:

- [users.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/users/users.controller.ts)
- [UsersList.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/users/UsersList/UsersList.tsx)
- [UsersService.ts](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/services/UsersService.ts)

### IA

Hoy la IA usa esta capa de forma conservadora:

- si el usuario tiene una configuración explícita simple y clara, puede influir en el perfil conversacional por defecto
- si el usuario es multi-área o ambiguo, se mantiene el fallback compatible actual

Esto evita que la IA limite artificialmente a operadores amplios.

Archivos clave:

- [role-resolver.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/role-engine/role-resolver.ts)
- [role-runtime.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/roles/role-runtime.js)
- [conversations.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/conversations/conversations.service.ts)

## 7. Lo que todavía no está cerrado

- enforcement transversal por capacidad sobre endpoints core del backend
- visibilidad/ocultamiento de UI por capacidad
- E2E por subrol/capacidad sobre operadores reales
- decisión final sobre si `active conversational role` aporta valor real

## 8. Regla de diseño vigente

Para el MVP:

- primero se consolida `permission envelope`
- la IA se adapta a eso sin bloquear operadores polivalentes
- `active conversational role` queda opcional y pendiente de validación real

Ese acuerdo reemplaza cualquier interpretación donde:

- un usuario deba elegir un subrol para operar
- la IA reduzca permisos efectivos por una abstracción conversacional
