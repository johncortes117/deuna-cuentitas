-- ═══════════════════════════════════════════════════════════════
-- MitiMiti — Supabase Database Setup
-- Ejecutar este SQL en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de salas (y actualizaciones)
ALTER TABLE IF EXISTS mitimiti_rooms ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'equal';

CREATE TABLE IF NOT EXISTS mitimiti_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         TEXT NOT NULL,
  host_name       TEXT NOT NULL,
  commerce_name   TEXT NOT NULL DEFAULT 'Comercio',
  total_cents     INTEGER NOT NULL,
  tip_cents       INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'locked', 'confirming', 'processing', 'completed', 'failed', 'cancelled')),
  invite_token    TEXT NOT NULL UNIQUE,
  locked_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  split_mode      TEXT NOT NULL DEFAULT 'equal'
    CHECK (split_mode IN ('equal', 'custom'))
);

-- 2. Tabla de participantes (y actualizaciones)
ALTER TABLE IF EXISTS mitimiti_participants ADD COLUMN IF NOT EXISTS deficit_cents INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS mitimiti_participants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES mitimiti_rooms(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('host', 'member')),
  amount_cents        INTEGER,
  has_extra_cent      BOOLEAN DEFAULT false,
  deficit_cents       INTEGER DEFAULT 0,
  confirmation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (confirmation_status IN ('pending', 'confirmed', 'declined', 'requesting_loan')),
  joined_at           TIMESTAMPTZ DEFAULT now(),
  confirmed_at        TIMESTAMPTZ,

  UNIQUE(room_id, user_id)
);

-- Actualizar constraints (ignoramos errores si ya existen)
DO $$
BEGIN
  -- Actualizar check de estado en rooms
  ALTER TABLE mitimiti_rooms DROP CONSTRAINT IF EXISTS mitimiti_rooms_status_check;
  ALTER TABLE mitimiti_rooms ADD CONSTRAINT mitimiti_rooms_status_check 
    CHECK (status IN ('waiting', 'locked', 'confirming', 'processing', 'completed', 'failed', 'cancelled'));

  -- Actualizar check de split_mode
  ALTER TABLE mitimiti_rooms DROP CONSTRAINT IF EXISTS mitimiti_rooms_split_mode_check;
  ALTER TABLE mitimiti_rooms ADD CONSTRAINT mitimiti_rooms_split_mode_check 
    CHECK (split_mode IN ('equal', 'custom'));

  -- Actualizar check de estado en participants
  ALTER TABLE mitimiti_participants DROP CONSTRAINT IF EXISTS mitimiti_participants_confirmation_status_check;
  ALTER TABLE mitimiti_participants ADD CONSTRAINT mitimiti_participants_confirmation_status_check 
    CHECK (confirmation_status IN ('pending', 'confirmed', 'declined', 'requesting_loan'));
END
$$;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_rooms_invite_token ON mitimiti_rooms(invite_token);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON mitimiti_rooms(status);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON mitimiti_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON mitimiti_participants(user_id);

-- 3.5. Tabla de deudas (Préstamos MitiMiti)
CREATE TABLE IF NOT EXISTS mitimiti_debts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES mitimiti_rooms(id) ON DELETE CASCADE,
  debtor_id       TEXT NOT NULL,
  debtor_name     TEXT NOT NULL,
  creditor_id     TEXT NOT NULL,
  creditor_name   TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'forgiven')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  paid_at         TIMESTAMPTZ,
  forgiven_at     TIMESTAMPTZ,
  
  UNIQUE(room_id, debtor_id, creditor_id)
);

CREATE INDEX IF NOT EXISTS idx_debts_room_id ON mitimiti_debts(room_id);
CREATE INDEX IF NOT EXISTS idx_debts_debtor ON mitimiti_debts(debtor_id);
CREATE INDEX IF NOT EXISTS idx_debts_creditor ON mitimiti_debts(creditor_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON mitimiti_debts(status);

-- 4. Habilitar Realtime en tablas
-- Para evitar errores de "already member of publication", lo configuramos dinámicamente:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mitimiti_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mitimiti_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mitimiti_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mitimiti_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mitimiti_debts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mitimiti_debts;
  END IF;
END
$$;

-- 5. Row Level Security (RLS) - Permisivo para prototipo
-- En producción, esto debería ser más restrictivo

ALTER TABLE mitimiti_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitimiti_participants ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de salas
DROP POLICY IF EXISTS "Salas visibles para todos" ON mitimiti_rooms;
CREATE POLICY "Salas visibles para todos" ON mitimiti_rooms
  FOR SELECT USING (true);

-- Permitir inserción de salas
DROP POLICY IF EXISTS "Cualquiera puede crear salas" ON mitimiti_rooms;
CREATE POLICY "Cualquiera puede crear salas" ON mitimiti_rooms
  FOR INSERT WITH CHECK (true);

-- Permitir actualización de salas
DROP POLICY IF EXISTS "Cualquiera puede actualizar salas" ON mitimiti_rooms;
CREATE POLICY "Cualquiera puede actualizar salas" ON mitimiti_rooms
  FOR UPDATE USING (true);

-- Permitir lectura pública de participantes
DROP POLICY IF EXISTS "Participantes visibles para todos" ON mitimiti_participants;
CREATE POLICY "Participantes visibles para todos" ON mitimiti_participants
  FOR SELECT USING (true);

-- Permitir inserción de participantes
DROP POLICY IF EXISTS "Cualquiera puede unirse" ON mitimiti_participants;
CREATE POLICY "Cualquiera puede unirse" ON mitimiti_participants
  FOR INSERT WITH CHECK (true);

-- Permitir actualización de participantes
DROP POLICY IF EXISTS "Cualquiera puede actualizar su estado" ON mitimiti_participants;
CREATE POLICY "Cualquiera puede actualizar su estado" ON mitimiti_participants
  FOR UPDATE USING (true);

-- Permitir eliminación de participantes (salir de la sala)
DROP POLICY IF EXISTS "Cualquiera puede salir" ON mitimiti_participants;
CREATE POLICY "Cualquiera puede salir" ON mitimiti_participants
  FOR DELETE USING (true);

-- Permisos tabla de deudas
ALTER TABLE mitimiti_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deudas visibles" ON mitimiti_debts 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Crear deudas" ON mitimiti_debts;
CREATE POLICY "Crear deudas" ON mitimiti_debts 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizar deudas" ON mitimiti_debts;
CREATE POLICY "Actualizar deudas" ON mitimiti_debts 
  FOR UPDATE USING (true);

-- 6. Recargar caché del esquema para la API REST (PostgREST)
NOTIFY pgrst, 'reload schema';
