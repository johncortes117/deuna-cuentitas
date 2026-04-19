# Dataset Sintético — Cuentitas / Deuna Negocios

## Archivos

| Archivo | Descripción |
|---|---|
| `transactions.csv` | Todas las transacciones, los 3 negocios |
| `transactions_carmita.csv` | Solo Tienda de Carmita |
| `transactions_roberto.csv` | Solo Cafetería Don Roberto |
| `transactions_lucia.csv` | Solo Bazar de Lucía |
| `cuentitas.db` | SQLite con 4 tablas: transactions, businesses, clients, vendors |

## Estructura de la tabla `transactions`

| Campo | Tipo | Descripción |
|---|---|---|
| transaction_id | TEXT | ID único (TXN000001) |
| business_id | TEXT | NEG001 / NEG002 / NEG003 |
| business_name | TEXT | Nombre del negocio |
| date | TEXT | YYYY-MM-DD |
| time | TEXT | HH:MM:SS |
| datetime | TEXT | YYYY-MM-DD HH:MM:SS |
| amount | REAL | Monto en dólares |
| client_id | TEXT | ID del cliente |
| client_name | TEXT | Nombre del cliente |
| vendor_id | TEXT | ID del vendedor (vacío si no aplica) |
| vendor_name | TEXT | Nombre del vendedor |
| weekday | TEXT | Día de la semana en inglés |
| month | INTEGER | 1-12 |
| year | INTEGER | 2025 o 2026 |
| hour | INTEGER | Hora del cobro (0-23) |

## Período: Abril 2025 — Marzo 2026 (12 meses)

---

## Los 3 negocios y sus historias

### NEG001 — Tienda de Carmita
- **Dueña:** Carmita Suárez
- **Categoría:** Tienda de abarrotes
- **Vendedores:** 2 (Carmita + Josué)
- **Historia:** negocio estable y consolidado. Clientes muy fieles y recurrentes. Pico claro al mediodía (11am–1pm). Ligero incremento en diciembre. Ticket promedio: $19.
- **Para demostrar:** ranking de clientes fieles, pico de mediodía, ranking de vendedores con diferencia clara.

### NEG002 — Cafetería Don Roberto
- **Dueño:** Roberto Cisneros
- **Categoría:** Cafetería
- **Vendedores:** ninguno (trabaja solo)
- **Historia:** negocio en crecimiento sostenido. Arrancó flojo en abril 2025 y crece mes a mes. Pico en la mañana (7–9am). Ticket bajo (promedio $4.75) pero volumen alto.
- **Para demostrar:** tendencia de crecimiento, hora pico de mañana, ausencia de ranking de vendedores.

### NEG003 — Bazar de Lucía
- **Dueña:** Lucía Mendoza
- **Categoría:** Bazar / Ropa
- **Vendedores:** 3 (Lucía domina el 74%, los otros dos muy por debajo)
- **Historia:** negocio con caída progresiva. Muy dependiente de fines de semana. Ha ido perdiendo clientes — en los últimos 3 meses solo quedan 3 clientes activos. Sin hora pico clara.
- **Para demostrar:** caída de ventas, dependencia de fin de semana, clientes perdidos, desigualdad en ranking de vendedores.

---

## Queries útiles para el agente

```sql
-- Resumen del día
SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total
FROM transactions
WHERE business_id='NEG001' AND date='2026-03-15';

-- Hora pico (últimos 30 días)
SELECT hour, COUNT(*) as txns
FROM transactions
WHERE business_id='NEG001' AND date >= date('now','-30 days')
GROUP BY hour ORDER BY txns DESC LIMIT 1;

-- Ranking de clientes del mes
SELECT client_name, COUNT(*) as visitas, ROUND(SUM(amount),2) as total
FROM transactions
WHERE business_id='NEG001' AND month=3 AND year=2026
GROUP BY client_id ORDER BY total DESC LIMIT 3;

-- Clientes que no han vuelto en 14 días
SELECT client_name, MAX(date) as ultima_visita
FROM transactions
WHERE business_id='NEG001'
GROUP BY client_id
HAVING ultima_visita < date('now','-14 days')
ORDER BY ultima_visita ASC;

-- Ranking de vendedores del mes
SELECT vendor_name, COUNT(*) as txns, ROUND(SUM(amount),2) as total
FROM transactions
WHERE business_id='NEG001' AND vendor_id!='' AND month=3 AND year=2026
GROUP BY vendor_id ORDER BY total DESC;

-- Comparación semana actual vs semana anterior
SELECT
  ROUND(SUM(CASE WHEN date >= date('now','-7 days') THEN amount ELSE 0 END),2) as esta_semana,
  ROUND(SUM(CASE WHEN date >= date('now','-14 days') AND date < date('now','-7 days') THEN amount ELSE 0 END),2) as semana_pasada
FROM transactions WHERE business_id='NEG001';
```
