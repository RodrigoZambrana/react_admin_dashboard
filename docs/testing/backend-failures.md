# Backend Runtime Failures

Fecha de evaluación: `2026-05-08`

## Falla de runner

| Comando | Resultado | Causa | Estado |
|---|---|---|---|
| `cd backend && npm test -- --runInBand` | falla | `runInBand` es un flag de Jest; Vitest no lo reconoce | abierto |

## Warnings observados en la corrida verde

| Señal | Contexto | Impacto | Acción |
|---|---|---|---|
| `MercadoPagoService` informa que el provider `none` deja el servicio deshabilitado | Tests del backend | No bloquea el suite, pero confirma dependencia externa apagada | Mantener como comportamiento esperado en entorno de test |
| `StorefrontService` emite warning sobre producto paramétrico resuelto sin definición publicada | Tests de storefront | No rompió la suite, pero es una señal de dominio que merece seguimiento | Revisar en el recovery funcional si reaparece como bug de negocio |

## Falla no reproducida en esta corrida

- No hubo fallos de aserciones, import, bootstrap ni Prisma en el suite completo
- No apareció flakiness observable en una corrida única

