# Arquitectura de Préstamos P2P (Auth vs Settlement)

Este documento detalla el patrón de arquitectura utilizado para registrar deudas y préstamos en MitiMiti, diseñado bajo estándares bancarios y de pasarelas de pago.

## El Problema: Integridad Transaccional

En una aplicación de división de gastos en tiempo real como MitiMiti, los usuarios pueden ofrecerse a cubrir el déficit de otros. Sin embargo, si estos préstamos se registran de forma definitiva (oficial) en la base de datos *durante* la interacción en la sala, nos enfrentamos a dos riesgos críticos:

1. **Fallo en el Pago Principal:** El host intenta pagar al comercio (ej. restaurante) pero su tarjeta es rechazada o los fondos son insuficientes. La sala entra en estado `failed` o `cancelled`. Si las deudas ya eran oficiales, el usuario A le deberá dinero al usuario B por un evento que financieramente nunca ocurrió.
2. **Abandono / Expiración de Sala:** La sala se cancela o expira por tiempo límite. El evento se anula.

## La Solución: Auth vs Capture (Retención vs Liquidación)

Para resolver esto, implementamos un modelo inspirado en el flujo "Authorization vs Capture" usado en el procesamiento de tarjetas de crédito.

### 1. Authorization (Promesas de Pago / Retenciones)
Cuando un usuario presta dinero dentro de la sala, el registro se guarda en la tabla `mitimiti_debts` con `status = 'pending'`.
- Estas deudas **existen** en la base de datos, lo que permite la sincronización en tiempo real (Supabase Realtime) y la persistencia en caso de recargas de página.
- **NO** son visibles en el historial global ni en la pantalla de "Mis Deudas" oficiales del usuario (`getMyDebts` filtra excluyendo el estado `pending`).
- Se comportan como "intenciones" o "promesas" de pago.

### 2. Capture (Liquidación / Settlement)
El estado de la sala determina el destino de estas promesas:
- **Éxito (`completed`):** Cuando el host procesa exitosamente el pago final en el comercio, la función `updateRoomStatus` intercepta este estado y actualiza todas las deudas `pending` de esa sala a `status = 'active'`. En este momento, el dinero "se asienta" (Settlement) y las deudas se vuelven oficiales.
- **Fallo / Cancelación (`failed` | `cancelled`):** Si la sala se aborta, la función `updateRoomStatus` intercepta este estado y actualiza todas las deudas `pending` a `status = 'cancelled'`. Esto anula las promesas de pago y mantiene un rastro auditable (audit trail) de que la intención existió pero fue anulada, sin ensuciar la contabilidad del usuario.

## Resumen del Ciclo de Vida de una Deuda

1. `pending`: Creada durante la interacción en la sala (Auth).
2. `cancelled`: La sala fue abortada o falló el pago (Void).
3. `active`: La sala finalizó exitosamente (Capture / Settlement). La deuda ahora es oficial y debe ser pagada.
4. `paid`: El deudor saldó su deuda fuera de línea o vía Deuna, y el sistema lo registró.
5. `forgiven`: El acreedor perdonó la deuda manualmente.

## Implementación en Código

El manejo central de esto ocurre en `src/mitimiti/supabase.ts` dentro de `updateRoomStatus`:

```typescript
export async function updateRoomStatus(roomId, status) {
  // ... actualiza la sala ...

  // Auth vs Capture de Deudas
  if (status === 'completed') {
    await supabase.from('mitimiti_debts').update({ status: 'active' }).eq('room_id', roomId).eq('status', 'pending');
  } else if (status === 'cancelled' || status === 'failed') {
    await supabase.from('mitimiti_debts').update({ status: 'cancelled' }).eq('room_id', roomId).eq('status', 'pending');
  }
}
```
