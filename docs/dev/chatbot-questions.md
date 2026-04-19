# Preguntas de prueba para el agente — Cuentitas

15 preguntas para validar el agente conversacional. Cubren desde consultas simples (una herramienta) hasta preguntas complejas que encadenan varias.

Usar con `NEG001` (Tienda de Carmita) y fechas del rango `2025-04-01 – 2026-03-31`.

---

## Básicas — una sola herramienta

**1. Ventas de hoy**
> ¿Cuánto he vendido hoy?

Herramienta: `get_daily_summary` — verifica que responda con total, cobros y ticket promedio en lenguaje natural.

---

**2. Ventas de un día específico**
> ¿Cómo me fue el 15 de marzo?

Herramienta: `get_daily_summary(date: "2026-03-15")` — verifica que el agente interprete la fecha en lenguaje natural y la convierta a `YYYY-MM-DD`.

---

**3. Horas pico**
> ¿A qué hora vendo más?

Herramienta: `get_peak_hours` — debe devolver las franjas horarias en formato legible (ej: "12pm–2pm"), sin números técnicos encima de barras.

---

**4. Mejor día histórico**
> ¿Cuál ha sido mi mejor día de ventas?

Herramienta: `get_best_day` — debe incluir la fecha, el total y el número de cobros.

---

**5. Resumen general**
> Dame un resumen de cómo va el negocio en general.

Herramienta: `get_general_summary` — verifica que el agente no invente datos y use solo lo que devuelve la herramienta.

---

## Intermedias — contexto y período

**6. Tendencia semanal**
> ¿Cómo me fue esta semana? ¿Hubo algún día especialmente bueno?

Herramienta: `get_weekly_trend(days: 7)` — el agente debe identificar el mejor día de la semana a partir de los datos, no inventarlo.

---

**7. Comparación entre semanas**
> ¿Esta semana estoy vendiendo más o menos que la semana pasada?

Herramienta: `compare_weeks` — respuesta esperada en formato coloquial: "Esta semana llevas $X, que es $Y más/menos que la anterior", sin porcentajes.

---

**8. Ranking de clientes del mes**
> ¿Quiénes son mis mejores clientes este mes?

Herramienta: `get_top_clients(period: "month", limit: 3)` — debe devolver nombres, no IDs, con cuánto gastaron y cuántas visitas tuvieron.

---

**9. Clientes inactivos**
> ¿Qué clientes no han vuelto en el último mes?

Herramienta: `get_inactive_clients(days_since: 30)` — verifica que el agente sugiera acción concreta (ej: "podrías mandarles un mensaje").

---

**10. Rendimiento del equipo**
> ¿Cómo va mi equipo este mes? ¿Quién ha vendido más?

Herramienta: `get_top_vendors(period: "month")` — solo relevante para NEG001 y NEG003 que tienen múltiples vendedores.

---

## Avanzadas — encadenamiento de herramientas

**11. Comparación de un día específico con el promedio**
> El viernes pasado, ¿vendí más o menos que un viernes normal?

Herramientas: `get_daily_summary` + `get_weekly_trend` — el agente debe hacer la comparación por su cuenta, no solo devolver los datos crudos.

---

**12. Pregunta multi-aspecto**
> ¿Cómo estuvo hoy? ¿A qué hora fue el pico y quién compró más?

Herramientas: `get_daily_summary` + `get_peak_hours` + `get_top_clients(period: "today")` — el agente debe encadenar las tres y responder en un solo párrafo coherente.

---

**13. Análisis de retención**
> ¿Tengo clientes que antes compraban seguido y ya no han vuelto? ¿Cuánto tiempo llevan sin aparecer?

Herramienta: `get_inactive_clients(days_since: 14)` — pregunta más elaborada que la básica, verifica que el agente extraiga la intención correctamente.

---

**14. Tendencia de largo plazo**
> ¿Cómo han ido las ventas en los últimos 30 días? ¿Hay alguna tendencia?

Herramienta: `get_weekly_trend(days: 30)` — el agente debe interpretar la tendencia (subida, bajada, estable) a partir de los datos diarios, no solo listarlos.

---

**15. Pregunta conversacional de seguimiento**

*(Hacer después de cualquiera de las anteriores)*

> ¿Y eso es bueno o malo para un negocio como el mío?

Sin herramienta — verifica que el agente mantenga el contexto de la respuesta anterior y responda con criterio, no solo repitiendo datos. Prueba la coherencia conversacional del historial de 20 mensajes.

---

## Notas para testing

- Las preguntas 1–5 deben responder en < 3 segundos (una sola llamada de herramienta).
- Las preguntas 11–14 pueden tomar 4–6 segundos (múltiples herramientas en paralelo).
- La pregunta 15 no debe llamar ninguna herramienta — solo usar el historial.
- Ninguna respuesta debe contener porcentajes, jerga financiera (KPI, ROI) ni números encima de barras.
- Todas las respuestas deben estar en español con tuteo y montos como `$94`.
