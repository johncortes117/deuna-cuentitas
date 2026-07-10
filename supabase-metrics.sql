-- ═══════════════════════════════════════════════════════════════
-- MitiMiti — Analytics & Metrics Setup
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mitimiti_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT NOT NULL,
  room_id     UUID,  -- Puede ser nulo si el evento no está atado a una sala específica
  user_id     TEXT,  -- Puede ser nulo si no hay usuario identificado
  payload     JSONB DEFAULT '{}'::jsonb,
  client_ts   BIGINT NOT NULL, -- Tiempo en el cliente para deltas en el mismo dispositivo
  created_at  TIMESTAMPTZ DEFAULT now() -- FUENTE DE VERDAD para tiempos entre dispositivos
);

-- Índices para facilitar las analíticas
CREATE INDEX IF NOT EXISTS idx_metrics_event_name ON mitimiti_metrics(event_name);
CREATE INDEX IF NOT EXISTS idx_metrics_room_id ON mitimiti_metrics(room_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON mitimiti_metrics(created_at);

-- Políticas RLS
ALTER TABLE mitimiti_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insertar métricas a todos" ON mitimiti_metrics;
CREATE POLICY "Permitir insertar métricas a todos" ON mitimiti_metrics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Solo lectura admin" ON mitimiti_metrics;
CREATE POLICY "Solo lectura admin" ON mitimiti_metrics
  FOR SELECT USING (true); -- Permitimos leer a todos en el scope del MVP
