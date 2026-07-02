# MitiMiti — Prompt Completo para Claude Code

## Contexto del proyecto

Estoy trabajando en una aplicación de pagos móviles con una UI ya construida que replica el diseño y experiencia visual de la app DeUna (billetera digital ecuatoriana). La app ya tiene componentes visuales funcionales: pantalla principal, lector de QR, historial de transacciones y flujos de pago individual.

**Tu tarea es implementar la feature "MitiMiti"** dentro de ese proyecto existente, sin romper lo que ya existe. MitiMiti es una funcionalidad de pagos grupales donde varias personas dividen el costo de una compra en el momento exacto de pagar, sin necesidad de transferencias posteriores.

---

## La idea de negocio

### El problema que resuelve

Cuando un grupo de personas sale a comer, va a una gasolinera, hace un pedido grupal o comparte cualquier gasto, el flujo actual en Ecuador es:

1. Una persona (el "host") paga todo con su billetera DeUna
2. Las demás personas le transfieren después por separado
3. Ese "después" muchas veces no llega, genera incomodidad social y deuda entre amigos

MitiMiti elimina ese problema: cada integrante del grupo paga su parte en el mismo instante de la compra, de forma automática, sin que el comercio cambie absolutamente nada de su operación.

### El insight clave

El comercio nunca ve la diferencia. Para el negocio sigue siendo un único QR de DeUna que cobra un monto total. Toda la inteligencia ocurre del lado de la aplicación, dentro del grupo de usuarios.

### Casos de uso principales

- Salidas a restaurantes
- Pedidos grupales (delivery compartido)
- Pago de gasolina entre varias personas
- Compras de regalos colectivos
- Viajes y hospedaje compartido
- Cualquier gasto grupal donde se quiera dividir en el momento

---

## Flujo completo del sistema

### Roles

- **Host**: La persona que inicia la sala, escanea el QR del comercio y confirma el pago final
- **Participante**: Cualquier persona que se une a la sala y paga su parte

---

### Flujo del Host (paso a paso)

```
[Paso 1] El host abre la app y va al lector QR
         (igual que un pago individual normal)
           │
           ▼
[Paso 2] Escanea el QR del comercio
         La app detecta el monto total
         Ejemplo: $48.00
           │
           ▼
[Paso 3] La app pregunta: ¿Pago individual o pago grupal?
         ┌────────────────┐    ┌─────────────────────┐
         │  Pagar solo    │    │  Crear sala MitiMiti │
         └────────────────┘    └─────────────────────┘
           │                            │
           ▼                            ▼
     (flujo normal)             [Paso 4] Se crea la sala
                                         │
                                         ▼
[Paso 5] La app genera un QR de invitación único para esta sala
         El host ve:
         - Monto total: $48.00
         - Participantes: 1 (solo tú por ahora)
         - Cada uno pagaría: $48.00
         - Estado: Esperando participantes...
           │
           ▼
[Paso 6] El host muestra/comparte el QR de invitación
         (los amigos lo escanean con su misma app)
           │
           ▼
[Paso 7] A medida que entran participantes, la pantalla
         del host se actualiza en tiempo real:
         - Participantes: 2 → cada uno: $24.00
         - Participantes: 3 → cada uno: $16.00
         - Participantes: 4 → cada uno: $12.00
           │
           ▼
[Paso 8] El host decide cuándo "cerrar" la sala
         (botón "Ya somos todos" o similar)
         En este momento se fija la división final
           │
           ▼
[Paso 9] Cada participante ve su monto y confirma
         El host ve en tiempo real quién confirmó
         Ejemplo: Ana ✓ | Luis ✓ | Pedro ⏳
           │
           ▼
[Paso 10] Cuando TODOS confirmaron, el host presiona "Pagar"
          La app ejecuta el cobro a cada participante
          El comercio recibe el monto total en una sola transacción
```

---

### Flujo del Participante (paso a paso)

```
[Paso 1] El participante abre la app y va al lector QR
           │
           ▼
[Paso 2] Escanea el QR de invitación que muestra el host
         (NO el QR del comercio, sino el QR de la sala)
           │
           ▼
[Paso 3] La app detecta que es un QR de sala MitiMiti
         Muestra pantalla de unirse:
         - Nombre de la sala / host
         - Comercio al que se está pagando
         - Monto total
         - Participantes actuales
         - Lo que le tocaría pagar (calculado al instante)
           │
           ▼
[Paso 4] El participante presiona "Unirme a la sala"
         Aparece en la lista del host en tiempo real
           │
           ▼
[Paso 5] Espera a que el host cierre la sala
         Ve su monto confirmado
           │
           ▼
[Paso 6] El host cierra la sala → el participante ve
         "El grupo ya está completo. Tu parte: $16.00"
         Botón: "Confirmar mi pago"
           │
           ▼
[Paso 7] El participante confirma
         Queda en estado "listo para pagar"
           │
           ▼
[Paso 8] Cuando el host ejecuta el pago, el participante
         recibe notificación de pago exitoso
```

---

## Lógica de división de dinero

### Regla fundamental

**Nunca trabajar con decimales flotantes. Siempre operar en centavos enteros.**

Esto elimina errores de precisión de punto flotante propios del hardware y garantiza que la suma de partes siempre sea exactamente igual al total original.

```
Correcto:   $10.00 → 1000 centavos → dividir enteros → reconvertir
Incorrecto: $10.00 → 10.0 / 3 → 3.3333... → error de redondeo
```

---

### El algoritmo central

```
FUNCIÓN dividirMonto(montoTotalCentavos: int, participantes: int): int[]

  parteBase  = floor(montoTotalCentavos / participantes)
  sobrante   = montoTotalCentavos mod participantes
  
  resultado = []
  
  PARA i DESDE 0 HASTA participantes - 1:
    SI i < sobrante:
      resultado[i] = parteBase + 1
    SINO:
      resultado[i] = parteBase
  
  RETORNAR resultado

FIN FUNCIÓN
```

### Ejemplos del algoritmo

**Caso exacto** — $9.00 entre 3 personas:
```
900 / 3 = 300 exacto, sobrante = 0

Persona 0 → $3.00
Persona 1 → $3.00
Persona 2 → $3.00
────────────────
Total     → $9.00 ✓
```

**Caso con sobrante de 1 centavo** — $10.00 entre 3 personas:
```
1000 / 3 = 333, sobrante = 1

Persona 0 → 334 centavos → $3.34  ← absorbe el centavo extra
Persona 1 → 333 centavos → $3.33
Persona 2 → 333 centavos → $3.33
────────────────────────────────
Total     → 1000 centavos → $10.00 ✓
```

**Caso con sobrante de 2 centavos** — $10.00 entre 6 personas:
```
1000 / 6 = 166, sobrante = 4

Persona 0 → 167 centavos → $1.67
Persona 1 → 167 centavos → $1.67
Persona 2 → 167 centavos → $1.67
Persona 3 → 167 centavos → $1.67
Persona 4 → 166 centavos → $1.66
Persona 5 → 166 centavos → $1.66
────────────────────────────────
Total     → 1000 centavos → $10.00 ✓
```

---

### Orden de asignación del sobrante

El sobrante debe asignarse de forma aleatoria, no siempre al primero en orden de llegada. Esto evita que el usuario perciba que "el primero en entrar siempre paga más".

**Implementación sugerida:**
1. Cuando el host cierra la sala y se fija el número de participantes, se genera un orden aleatorio de la lista (shuffle)
2. Ese orden aleatorio determina quién absorbe los centavos sobrantes
3. El orden se guarda en el estado de la sala y no cambia hasta que termina el pago

```javascript
// Ejemplo conceptual
function shuffleParticipants(participants) {
  return [...participants].sort(() => Math.random() - 0.5);
}

// Al cerrar la sala:
const orderedParticipants = shuffleParticipants(room.participants);
const amounts = dividirMonto(room.totalCents, orderedParticipants.length);

// Mapear montos con participantes en el orden aleatorio
const assignments = orderedParticipants.map((p, i) => ({
  userId: p.id,
  amountCents: amounts[i],
}));
```

---

### Caso especial: propina

Si la app permite agregar propina, esta SIEMPRE se suma ANTES de la división:

```
Subtotal del QR:   $20.00  →  2000 centavos
Propina (10%):   +  $2.00  →  +200 centavos
────────────────────────────────────────────
Total a dividir:   $22.00  →  2200 centavos

Entre 3 personas:
2200 / 3 = 733, sobrante = 1

Persona 0 → 734 centavos → $7.34
Persona 1 → 733 centavos → $7.33
Persona 2 → 733 centavos → $7.33
────────────────────────────────
Total     → 2200 centavos → $22.00 ✓
```

Nunca dividir primero y propinar después. Eso genera que cada quien propine su parte individualmente y puede dar totales incorrectos.

---

## Modelo de datos

### Sala (Room)

```typescript
interface Room {
  id: string;                        // UUID único de la sala
  hostId: string;                    // userId del host
  commerceQRData: string;            // Datos originales del QR del comercio
  commerceName: string;              // Nombre del comercio (si está disponible)
  totalAmountCents: number;          // Monto total en centavos (inmutable tras escaneo)
  tipAmountCents: number;            // Propina en centavos (default: 0)
  finalAmountCents: number;          // totalAmountCents + tipAmountCents
  status: RoomStatus;                // Estado actual de la sala
  participants: Participant[];       // Lista de participantes (incluye al host)
  paymentAssignments: Assignment[];  // Solo existe cuando status === 'locked'
  createdAt: Date;
  lockedAt: Date | null;             // Cuando el host cierra la sala
  paidAt: Date | null;               // Cuando se ejecuta el pago
  inviteQRToken: string;             // Token único para el QR de invitación
  expiresAt: Date;                   // La sala expira si no se paga (sugerido: 15 min)
}
```

### Estados de la sala (RoomStatus)

```typescript
type RoomStatus =
  | 'waiting'      // Sala abierta, esperando participantes
  | 'locked'       // Host cerró la sala, esperando confirmaciones
  | 'confirming'   // Todos confirmaron, host puede ejecutar pago
  | 'processing'   // Pago en proceso
  | 'completed'    // Pago exitoso
  | 'failed'       // Pago falló (ver lógica de fallos)
  | 'cancelled'    // Host canceló o sala expiró
```

### Participante (Participant)

```typescript
interface Participant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: 'host' | 'member';
  joinedAt: Date;
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  confirmedAt: Date | null;
}
```

### Asignación de monto (Assignment)

```typescript
interface Assignment {
  userId: string;
  amountCents: number;        // Monto exacto que debe pagar esta persona
  hasExtraCent: boolean;      // true si absorbió uno de los centavos sobrantes
}
```

---

## Máquina de estados de la sala

```
                 ┌──────────────────┐
                 │   [HOST ESCANEA  │
                 │    QR COMERCIO]  │
                 └────────┬─────────┘
                          │ Elige "Pago Grupal"
                          ▼
              ┌───────────────────────┐
              │       WAITING         │◄──── Participantes entran
              │  (esperando grupo)    │      y salen libremente
              └───────────┬───────────┘
                          │ Host presiona "Ya somos todos"
                          ▼
              ┌───────────────────────┐
              │        LOCKED         │◄──── Se calcula la división
              │  (sala cerrada,       │      Se asignan montos
              │   confirmando pagos)  │      Nadie más puede entrar
              └───────────┬───────────┘
                          │ Todos los participantes confirman
                          ▼
              ┌───────────────────────┐
              │      CONFIRMING       │
              │  (host puede pagar)   │
              └───────────┬───────────┘
                          │ Host presiona "Pagar Ahora"
                          ▼
              ┌───────────────────────┐
              │      PROCESSING       │
              │  (pago en proceso)    │
              └─────┬─────────┬───────┘
                    │         │
              éxito │         │ fallo
                    ▼         ▼
              ┌──────────┐ ┌──────────┐
              │COMPLETED │ │  FAILED  │
              └──────────┘ └──────────┘

  Desde cualquier estado antes de PROCESSING:
  ─────────────────────────────────────────
  Host cancela → CANCELLED
  Sala expira  → CANCELLED
```

---

## Pantallas y componentes UI

La UI debe seguir el mismo estilo visual que ya existe en el proyecto (paleta, tipografía, componentes).

### Pantalla 1: Modal de selección post-escaneo

Aparece después de escanear el QR del comercio, antes de pagar.

**Contenido:**
- Nombre del comercio (si está en el QR)
- Monto detectado: `$48.00`
- Dos opciones grandes y claras:
  - Botón primario: `Pagar solo` → va al flujo normal de pago
  - Botón secundario destacado: `Pagar en grupo (MitiMiti)` → abre flujo MitiMiti

---

### Pantalla 2: Sala MitiMiti — Vista del Host

**Header:**
- Nombre: "Sala MitiMiti"
- Comercio: [Nombre del comercio]
- Monto total: `$48.00`
- Timer de expiración: `14:32` (cuenta regresiva)

**Sección central — QR de invitación:**
- QR grande y centrado (generado a partir del `inviteQRToken`)
- Texto debajo: "Tus amigos escanean este QR para unirse"
- Botón secundario: "Compartir enlace" (para enviar por WhatsApp u otras apps)

**Sección de participantes (lista en tiempo real):**
```
👤 Tú (Host)         .............. $48.00
```
Cuando van entrando:
```
👤 Tú (Host)         .............. $24.00
👤 Ana García        .............. $24.00
```
```
👤 Tú (Host)         .............. $16.00
👤 Ana García        .............. $16.00
👤 Luis Pérez        .............. $16.00
```

**Nota de decimales** (solo visible si aplica):
```
⚠ El total no es divisible exactamente.
  Se distribuirá 1 centavo adicional automáticamente.
```

**Botón de acción:**
- Mientras `status === 'waiting'`: `Ya somos todos → Cerrar sala`
- Cuando `status === 'locked'` y no todos confirmaron: `Esperando confirmaciones... (2/3)`
- Cuando `status === 'confirming'` (todos confirmaron): `Pagar ahora — $16.00`

---

### Pantalla 3: Sala MitiMiti — Vista del Participante (al unirse)

**Header:**
- "MitiMiti — Unirse al grupo"
- Host: [Nombre del host]
- Comercio: [Nombre]

**Resumen:**
```
Total de la compra:   $48.00
Personas en el grupo: 3
Tu parte:             $16.00
```

**Botón:** `Unirme a la sala`

**Estado tras unirse:**
```
✓ Estás en la sala
Esperando a que [Host] cierre el grupo...
```

---

### Pantalla 4: Confirmación del participante (cuando host cierra sala)

```
El grupo está completo

[Nombre del comercio]
Tu parte a pagar:

  $16.00

[Confirmar mi pago]
[Salir de la sala]
```

**Estado tras confirmar:**
```
✓ Listo para pagar
Esperando que [Host] ejecute el pago...
```

---

### Pantalla 5: Vista del Host — Monitor de confirmaciones

Cuando `status === 'locked'`, el host ve:

```
Esperando confirmaciones

👤 Tú (Host)    ✓ Confirmado    $16.34
👤 Ana García   ✓ Confirmado    $16.33
👤 Luis Pérez   ⏳ Pendiente    $16.33

                    [2 de 3 confirmaron]
```

Cuando todos confirman:
```
¡Todos listos!

👤 Tú (Host)    ✓  $16.34
👤 Ana García   ✓  $16.33
👤 Luis Pérez   ✓  $16.33

         [PAGAR AHORA — $48.00]
```

---

### Pantalla 6: Procesando pago

```
        Procesando pago...
        
    [animación de carga]
    
    No cierres la aplicación
```

---

### Pantalla 7: Pago exitoso

```
    ✓  ¡Pago exitoso!
    
    [Nombre del comercio]
    $48.00 pagado entre 3 personas
    
    Tu parte: $16.34
    
    [Ver resumen]  [Volver al inicio]
```

**Pantalla de resumen (opcional, expandible):**
```
Resumen del pago MitiMiti
─────────────────────────
Tú          $16.34  ✓
Ana García  $16.33  ✓
Luis Pérez  $16.33  ✓
─────────────────────────
Total       $48.00

Pagado el [fecha y hora]
```

---

## Casos borde y cómo manejarlos

### 1. Un participante sale de la sala antes de que se cierre

- **Mientras status === 'waiting'**: permitido sin consecuencias. El monto se recalcula automáticamente para los que quedan.
- **Mientras status === 'locked'**: el participante puede presionar "Salir de la sala". Esto revierte la sala a `'waiting'`, se reasignan los montos y el host debe volver a cerrarla.
- **Mientras status === 'confirming'**: no se permite salir. El pago está a punto de ejecutarse.

### 2. Un participante no confirma (timeout)

Si un participante no confirma en X minutos después de que el host cerró la sala:

- Mostrar al host: `⚠ Luis Pérez no ha confirmado. ¿Qué deseas hacer?`
- Opciones:
  - `Reabrir sala y remover a Luis` → vuelve a `'waiting'` sin ese participante
  - `Esperar más tiempo`
  - `Cancelar pago grupal` → `'cancelled'`

### 3. La sala expira

- Si el tiempo límite (sugerido: 15 minutos desde creación) llega antes de que se complete el pago, la sala pasa a `'cancelled'`
- Todos los participantes reciben notificación: `La sala MitiMiti expiró`
- El host puede iniciar una nueva sala si aún quiere pagar

### 4. El pago falla durante el procesamiento

Esto es el caso más delicado. El pago es una transacción que afecta a todos.

**Estrategia:**
- Si el fallo es de un participante individual (fondos insuficientes, límite de transacción, etc.), notificar al host: `El pago de [Nombre] falló. ¿Qué deseas hacer?`
- Opciones del host:
  - `Remover a [Nombre] y redistribuir` → recalcular montos entre los que quedan → nuevas confirmaciones → reintentar
  - `Cancelar todo` → `'failed'`
- Si nadie fue cobrado aún: cancelar sin consecuencias
- Si algunos ya fueron cobrados y otros no: **este es el caso más crítico**. Requiere lógica de rollback. En un MVP, la recomendación es procesar todos los cobros como una sola operación atómica, o manejar un estado `'partial_failure'` con soporte manual

### 5. Solo hay 1 persona en la sala cuando el host cierra

- Bloquear la acción: `Necesitas al menos 2 personas para usar MitiMiti`
- Si el host quiere pagar solo, debe cancelar la sala y usar el flujo normal

### 6. El host pierde conexión después de cerrar la sala

- La sala mantiene su estado en el backend
- Al reconectarse, el host ve la pantalla correspondiente al estado actual
- Los participantes ven sus pantallas normalmente sin interrupciones

### 7. Monto de $0.00 o negativo

- Validar al escanear el QR: si el monto es ≤ 0, mostrar error y volver al inicio

---

## Comportamiento de actualización en tiempo real

La sala debe actualizar su estado en tiempo real para todos los participantes. Las opciones de implementación dependen del stack del proyecto:

- **WebSockets**: la solución más limpia para updates en tiempo real
- **Polling cada 2-3 segundos**: solución más simple, válida para MVP
- **Server-Sent Events (SSE)**: alternativa a WebSockets si el backend no los soporta

**Eventos que deben propagarse en tiempo real:**
- Alguien se une a la sala
- Alguien sale de la sala
- El host cierra la sala (status cambia a 'locked')
- Un participante confirma su pago
- El host ejecuta el pago (status cambia a 'processing')
- El pago se completa o falla

---

## Generación del QR de invitación

El QR de invitación es diferente al QR del comercio. No contiene información de pago directo; contiene un token para unirse a una sala.

**Contenido del QR de invitación (sugerido):**
```json
{
  "type": "mitimiti_invite",
  "roomId": "uuid-de-la-sala",
  "token": "token-de-seguridad-unico",
  "version": "1"
}
```

**O como URL deep link:**
```
deuna://mitimiti/join?room=uuid&token=abc123
```

La app, al escanear este QR, detecta que es de tipo `mitimiti_invite` y activa el flujo de participante en lugar del flujo de pago normal.

---

## Comunicación en la UI sobre los centavos sobrantes

Mostrar siempre con transparencia cuando el monto no es exactamente divisible. Nunca ocultarlo.

**Texto sugerido (aparece debajo de la lista de participantes):**
```
El total no puede dividirse en partes exactamente iguales.
Distribuimos 1 centavo adicional automáticamente entre algunos
participantes. La diferencia máxima es de $0.01 por persona.
```

**No usar frases como:**
- "Error de redondeo"
- "Ajuste de monto"
- "Diferencia técnica"

Esas frases generan desconfianza. El lenguaje debe ser claro y casual.

---

## Notas de implementación para el desarrollador

1. **Siempre convertir el monto del QR a centavos enteros** antes de cualquier operación. Nunca pasar `48.00` como float; usar `4800` como int.

2. **La función `dividirMonto` debe ser la única fuente de verdad** para los cálculos. No calcular montos en múltiples lugares del código.

3. **Verificar que la suma de `assignments` sea exactamente igual a `finalAmountCents`** como assertion antes de ejecutar el pago. Si no coincide, hay un bug en el cálculo.

4. **El `inviteQRToken` debe ser único e irrepetible** por sala. Sugerencia: UUID v4 o HMAC del roomId con una clave secreta.

5. **La sala tiene tiempo de vida**. Implementar un job o lógica que expire salas en estado `'waiting'` o `'locked'` después del tiempo límite.

6. **No permitir que el mismo usuario se una a la sala dos veces.** Validar por `userId` al intentar unirse.

7. **El host siempre está en la sala como participante.** Al crear la sala, agregarlo automáticamente a `participants` con `role: 'host'`.

8. **Cuando la sala está en estado `'locked'` o posterior**, rechazar nuevas solicitudes de unirse. Responder con mensaje claro: `Esta sala ya está cerrada. Pide al host que te agregue antes de cerrarla.`

9. **El pago final debe registrarse como una sola transacción hacia el comercio**, aunque internamente se debite de múltiples wallets. El comercio solo ve un cobro por el total.

10. **Para el MVP**, puede simplificarse omitiendo la propina, las divisiones por ítem y la rotación histórica de centavos. Implementar primero el flujo base completo y luego agregar estas features.

---

## Resumen de features: MVP vs Futuro

### MVP (implementar ahora)

- [x] Escanear QR del comercio y elegir pago grupal
- [x] Crear sala y generar QR de invitación
- [x] Unirse a sala mediante QR
- [x] División automática en centavos con algoritmo de sobrante
- [x] Vista en tiempo real de participantes y montos
- [x] Cierre de sala por el host
- [x] Confirmación individual de cada participante
- [x] Ejecución del pago por el host
- [x] Pantalla de éxito con resumen
- [x] Manejo básico de sala expirada

### Futuro (v2 en adelante)

- [ ] Propina configurable antes de dividir
- [ ] División por porcentajes personalizados
- [ ] División por ítems de la cuenta
- [ ] Excluir a un participante del pago
- [ ] Historial de salas y gastos compartidos
- [ ] Rotación justa del centavo sobrante por historial
- [ ] Invitación por enlace compartible (WhatsApp, etc.)
- [ ] Límite de tiempo configurable por el host
- [ ] Notificaciones push a participantes

---

*Este documento describe completamente la feature MitiMiti. Úsalo como especificación de referencia durante todo el desarrollo.*