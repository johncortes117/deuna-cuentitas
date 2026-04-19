# Especificaciones de diseño — Pantalla "Mis Cuentitas"
**Proyecto:** Cuentitas — Deuna Negocios  
**Versión:** 1.0  
**Fecha:** Abril 2026

---

## Principio de diseño

> Cada tarjeta debe ser entendible en menos de 3 segundos, sin que nadie explique nada.

El público objetivo son dueños de micronegocios, adultos en su mayoría, con uso básico de tecnología. Nada de jerga financiera, nada de gráficas complejas. Si necesita interpretarse, está mal diseñado.

---

## Estructura general de la pantalla

La pantalla "Mis Cuentitas" vive dentro de **Deuna Negocios**, en la sección "Mi Caja".

El flujo de la pantalla es vertical, scroll continuo, sin tabs ni navegación interna. Las tarjetas se apilan en este orden:

1. Alerta proactiva (header)
2. Resumen del día
3. Horas pico
4. Ranking de clientes
5. Ranking de vendedores *(solo si hay más de 1 vendedor registrado)*

---

## Paleta de colores

| Uso | Color |
|---|---|
| Color primario / acento | `#6B5CE7` (morado Deuna) |
| Barras secundarias / inactivas | `#EEEDFE` (morado muy claro) |
| Barra activa / destacada | `#6B5CE7` |
| Badge positivo (subida) | Fondo `#EAF3DE` · Texto `#3B6D11` |
| Badge negativo (bajada) | Fondo `#FCEBEB` · Texto `#A32D2D` |
| Fondo de tarjeta | Blanco `#FFFFFF` |
| Fondo de pantalla | Gris muy claro `#F5F4F0` |
| Texto principal | `#1A1A2E` |
| Texto secundario / etiquetas | `#999999` |
| Bordes | `rgba(0,0,0,0.08)` — 0.5px |

---

## Header — Alerta proactiva

Vive encima de todas las tarjetas, dentro del header morado de la app.

**Componente:** píldora (`border-radius: 20px`) con fondo semi-transparente blanco sobre el morado del header.

**Contenido:**
- Punto verde animado a la izquierda (indica que es dato en tiempo real)
- Texto en blanco, máximo 2 líneas
- Formato del mensaje: `"[Superlativo del día]. [Dato concreto] — [contexto rápido]"`
- Ejemplo: *"Ayer fue tu mejor martes del mes. Entraron $127 — pico a las 12pm"*

**Tono:** siempre positivo o neutral. Nunca alarmista.

---

## Tarjeta 1 — Resumen del día

### Qué muestra
- Total en dólares que entró hoy
- Cuántas ventas (cobros) se hicieron
- Comparación con ayer en lenguaje natural

### Jerarquía visual
1. Número grande: monto total del día — `font-size: 28px`, `font-weight: 500`
2. Texto secundario debajo: `"18 cobros · hasta ahora"` — `font-size: 12px`, color secundario
3. Badge a la derecha del monto: `"+$12 vs ayer"` en verde si subió, rojo si bajó
4. Mini gráfica debajo: últimos 7 días

### Gráfica — Barras verticales últimos 7 días
- **Tipo:** barras verticales simples
- **Datos:** un valor por día de los últimos 7 días
- **Barra de hoy:** color primario `#6B5CE7`
- **Barras anteriores:** color claro `#EEEDFE`
- **Sin ejes, sin valores en cada barra** — solo la forma visual
- **Etiquetas debajo:** inicial del día (L, M, Mi, J, V, S, D), `font-size: 9px`, color `#BBBBBB`
- **Altura del gráfico:** 40px máximo
- **Separador:** línea divisoria `0.5px` entre el número y la gráfica

### Lo que NO va
- Ejes con valores
- Números encima de cada barra
- Líneas de tendencia
- Porcentajes

---

## Tarjeta 2 — Horas pico

### Qué muestra
- Las franjas horarias del día agrupadas en bloques de 2 horas
- Qué bloque tuvo más ventas, destacado
- Texto de cierre: `"Tu hora pico es 12–1pm"`

### Jerarquía visual
1. Etiqueta pequeña arriba: `"Hora pico hoy"` — `font-size: 11px`, color secundario
2. Valor destacado: `"12–1pm"` — `font-size: 22px`, `font-weight: 500`
3. Subtexto: `"7 cobros en esa hora"` — `font-size: 11px`, color secundario
4. Gráfica de barras horizontales debajo

### Gráfica — Barras horizontales por franja horaria
- **Tipo:** barras horizontales
- **Etiqueta a la izquierda:** franja horaria (ej: `10am`, `11am`, `12pm`, `1pm`, `2pm`)
- **Barra del pico:** color primario `#6B5CE7`
- **Barras restantes:** color claro `#EEEDFE`
- **Sin valores numéricos en las barras** — solo la longitud relativa
- **Espaciado entre barras:** 6px
- **Altura de cada barra:** 10px con `border-radius: 3px`

### Por qué horizontal y no vertical
Las etiquetas de hora quedan a la izquierda y se leen naturalmente de arriba abajo, sin rotar texto. Es más legible para este público.

### Lo que NO va
- Heatmap de horas (demasiado complejo)
- Reloj visual o circular
- Más de 6 franjas horarias visibles

---

## Tarjeta 3 — Ranking de clientes

### Qué muestra
- Top 3 clientes del mes en curso
- Por cada cliente: posición, iniciales, nombre, total en dólares, número de visitas

### Formato — Lista rankeada
**No es una gráfica. Es una lista.** Como un marcador deportivo.

Cada fila tiene:
- Número de posición: `font-size: 11px`, color `#BBBBBB`, ancho fijo `14px`
- Avatar circular con iniciales: `width: 30px`, `height: 30px`, fondo en tono claro del color primario, texto en tono oscuro
- Nombre del cliente: `font-size: 12px`, `font-weight: 500`
- Subtexto: `"X visitas"` — `font-size: 11px`, color secundario
- Monto a la derecha: `font-size: 13px`, `font-weight: 500`, color primario `#6B5CE7`
- Separador entre filas: `0.5px solid rgba(0,0,0,0.06)`

### Colores de avatares (rotar entre los 3)
- Cliente #1: fondo `#EEEDFE` · texto `#534AB7`
- Cliente #2: fondo `#E1F5EE` · texto `#0F6E56`
- Cliente #3: fondo `#FAECE7` · texto `#993C1D`

### Lo que NO va
- Barras por cliente
- Porcentajes del total
- Más de 3 clientes visibles (sin expandir)

---

## Tarjeta 4 — Ranking de vendedores

### Condición de visibilidad
**Esta tarjeta solo aparece si hay 2 o más vendedores registrados en Deuna Negocios.** Si el comerciante trabaja solo, la tarjeta no existe en la pantalla.

### Qué muestra
- Top 3 vendedores del mes en curso
- Por cada vendedor: posición, iniciales, nombre, total vendido, número de transacciones

### Formato
Idéntico al ranking de clientes para mantener consistencia visual. El usuario no tiene que aprender un nuevo patrón.

El monto mostrado es el total en ventas generadas por ese vendedor en el mes.

---

## Botón — "Pregúntame algo"

Al final del scroll, después de todas las tarjetas, vive un botón de acción secundaria.

- **Texto:** `"Pregúntame algo"`
- **Ícono:** burbuja de chat, a la izquierda del texto
- **Estilo:** fondo morado primario `#6B5CE7`, texto blanco, `border-radius: 14px`, padding `13px`, ancho 100%
- **Función:** abre la interfaz de chat del asistente conversacional

Este botón no es el protagonista de la pantalla. Es el recurso para cuando el comerciante quiere algo más específico que no está en las tarjetas.

---

## Regla general para elegir formato visual

| Tipo de dato | Formato correcto |
|---|---|
| Un número importante del día | Grande, solo, con contexto en una línea debajo |
| Evolución en el tiempo | Barras verticales simples, sin ejes ni valores |
| Comparación por franja horaria | Barras horizontales con etiqueta a la izquierda |
| Ranking de personas | Lista con posición, avatar, nombre y monto |

**Nunca usar:** pie charts, líneas con múltiples series, heatmaps, números sin contexto, términos financieros técnicos.

---

## Tono del lenguaje en la UI

Todos los textos de la app deben seguir estas reglas:

- Español neutro, sin regionalismos
- Tuteo directo: *"vendiste"*, *"tu mejor hora"*, *"tus clientes"*
- Números en dólares siempre con símbolo: `$94`, no `94 USD`
- Comparaciones en lenguaje natural: *"$12 más que ayer"*, no *"+14.7%"*
- Si no hay datos suficientes para un insight: *"Aún no tenemos datos de esta semana. Vuelve mañana."*

---

## Comportamiento de estados vacíos

| Situación | Qué mostrar |
|---|---|
| Sin ventas hoy | `"Hoy todavía no hay cobros registrados."` |
| Sin vendedores registrados | Tarjeta de vendedores no aparece |
| Menos de 3 clientes en el mes | Mostrar solo los que haya, sin forzar 3 filas |
| Sin datos históricos (comercio nuevo) | `"Cuando tengas más ventas, aquí verás tus horas pico."` |
