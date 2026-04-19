# Dataset de prueba — Referencia

## Resumen

`data/cuentitas.db` contiene 12 meses de transacciones sintéticas (abril 2025 – marzo 2026) para tres negocios ficticios. Es una base SQLite de solo lectura — el backend nunca escribe en ella.

El archivo CSV equivalente está en `data/transactions.csv`.

---

## Los tres negocios

| ID | Nombre | Tipo | Patrón |
|---|---|---|---|
| `NEG001` | Tienda de Carmita | Tienda de abarrotes | Estable, clientes recurrentes, pico al mediodía, 2 vendedores |
| `NEG002` | Cafetería Don Roberto | Cafetería | Crecimiento sostenido mes a mes, pico 7–9am, dueño único |
| `NEG003` | Bazar de Lucía | Bazar / ropa | Caída progresiva, dependencia de fines de semana, 3 vendedores |

---

## Esquema de la tabla `transactions`

```sql
CREATE TABLE transactions (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,      -- 'NEG001' | 'NEG002' | 'NEG003'
  date        TEXT NOT NULL,      -- 'YYYY-MM-DD'
  hour        INTEGER NOT NULL,   -- 0-23
  amount      REAL NOT NULL,      -- monto en dólares
  client_id   TEXT,               -- ID del cliente
  client_name TEXT,               -- nombre del cliente
  vendor_id   TEXT,               -- ID del vendedor (puede ser vacío si dueño único)
  vendor_name TEXT                -- nombre del vendedor
);
```

---

## Rango de fechas

```
Inicio: 2025-04-01
Fin:    2026-03-31
```

Para probar los insights con el trigger manual, usar fechas dentro de este rango:

```bash
# ✅ Tiene datos
"date": "2026-03-10"
"date": "2025-12-20"

# ❌ Sin datos (fuera del rango)
"date": "2026-04-19"   # ← hoy, posterior al dataset
```

---

## Consultas útiles (verificación)

Con el backend corriendo, puedes usar Swagger en `http://localhost:3000/api` o curl:

```bash
# Resumen de hoy para Carmita (usando una fecha del dataset)
curl -s -X POST http://localhost:3000/chat/session/start \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "role": "admin"}' | jq '.sessionId'

# Luego con el sessionId:
curl -s -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "text": "¿Cuál fue mi mejor día histórico?"}' | jq '.text'
```

O directamente en SQLite:

```bash
# Instalar sqlite3 si no lo tienes
# En Windows: winget install SQLite.SQLite

sqlite3 data/cuentitas.db

# Dentro del shell sqlite3:
SELECT date, COUNT(*) as cobros, ROUND(SUM(amount),2) as total
FROM transactions
WHERE business_id = 'NEG001'
GROUP BY date
ORDER BY total DESC
LIMIT 10;

.quit
```

---

## Características del dataset por negocio

### NEG001 — Tienda de Carmita

- **Clientes:** 15–20 clientes recurrentes, alta frecuencia de retorno
- **Horario pico:** 12pm–2pm (hora del almuerzo)
- **Ticket promedio:** ~$8–12
- **Vendedores:** 2 (Carmita + 1 empleado)
- **Tendencia:** Estable con ligera variación estacional

### NEG002 — Cafetería Don Roberto

- **Clientes:** 30–40 clientes distintos por semana
- **Horario pico:** 7am–9am (desayunos)
- **Ticket promedio:** ~$4–6
- **Vendedores:** Solo Roberto
- **Tendencia:** Crecimiento del 5–8% mensual

### NEG003 — Bazar de Lucía

- **Clientes:** Baja recurrencia, muchos clientes únicos
- **Horario pico:** Sábados y domingos, tarde
- **Ticket promedio:** ~$15–25
- **Vendedores:** 3 (Lucía + 2 empleados)
- **Tendencia:** Caída del 3–5% mensual

---

## Para el dataset_README completo

Ver `data/dataset_README.md` para detalles completos del esquema, proceso de generación y distribuciones estadísticas.
