# Frontend Lint Debt Strategy

## Objetivo

Contener la deuda de lint existente sin bloquear entregas nuevas ni mezclar fixes masivos con features.

## Regla operativa

- `npm run lint` se mantiene como diagnóstico global.
- Todo código nuevo o modificado en superficies críticas debe pasar `npm run lint:conversation-debug`.
- No se introducen nuevas excepciones globales de ESLint para destrabar features.

## Superficies protegidas

- `frontend/src/views/crm/ConversationDebug`
- `frontend/src/services/ConversationsService.ts`
- `frontend/src/configs/routes.config/appsRoute.tsx`
- `frontend/src/configs/navigation.config/apps.navigation.config.ts`

## Plan incremental

1. `crm` y servicios de conversación:
   normalizar accesibilidad, labels y handlers primero.
2. `settings`:
   atacar pantallas con deuda `jsx-a11y/label-has-associated-control`.
3. `cms` y módulos legacy:
   corregir deuda por lotes pequeños, módulo por módulo.

## Criterio de avance

- Sin deuda nueva en superficies protegidas.
- Fixes por módulo con validación focalizada.
- El lint global sigue siendo visible, pero deja de contaminar entregas puntuales.
