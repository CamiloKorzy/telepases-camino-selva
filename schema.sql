-- =====================================================================
-- PROYECTO CORREDOR NORESTE - CAMINO SELVA S.A.
-- APLICACIÓN TELEPASES: REGISTRO Y CONTROL DE TAGS TELEPASE
-- =====================================================================

-- 0. LIMPIEZA PREVIA DE TRIGGERS Y POLÍTICAS (EJECUCIÓN IDEMPOTENTE)
DROP TRIGGER IF EXISTS trg_update_stock_on_delivery ON public.tag_deliveries;
DROP FUNCTION IF EXISTS update_stock_on_delivery();

DROP POLICY IF EXISTS "Permitir lectura publica de entregas" ON public.tag_deliveries;
DROP POLICY IF EXISTS "Permitir insercion de entregas" ON public.tag_deliveries;
DROP POLICY IF EXISTS "Permitir todo en entregas" ON public.tag_deliveries;

DROP POLICY IF EXISTS "Permitir lectura de stock" ON public.peaje_stock;
DROP POLICY IF EXISTS "Permitir todo en stock" ON public.peaje_stock;

DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON public.user_profiles;
DROP POLICY IF EXISTS "Permitir insercion y edicion de usuarios" ON public.user_profiles;
DROP POLICY IF EXISTS "Permitir todo en usuarios" ON public.user_profiles;

DROP POLICY IF EXISTS "Permitir lectura publica de lotes" ON public.tag_batches;
DROP POLICY IF EXISTS "Permitir insercion de lotes" ON public.tag_batches;
DROP POLICY IF EXISTS "Permitir todo en lotes" ON public.tag_batches;

-- 1. TABLA MAESTRA DE ENTREGAS EN VÍA (REGISTRO DE ENTREGAS)
CREATE TABLE IF NOT EXISTS public.tag_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    estacion VARCHAR(100) NOT NULL, -- Punto de Entrega
    nombre_apellido VARCHAR(150),
    dni_cuit VARCHAR(20) NOT NULL,
    dominio VARCHAR(10) NOT NULL,
    tag_serial VARCHAR(20) NOT NULL UNIQUE,
    operador_runner VARCHAR(100) NOT NULL,
    observaciones TEXT,
    sincronizado_glm BOOLEAN DEFAULT FALSE,
    fecha_cruce_glm TIMESTAMPTZ
);

-- 2. TABLA DE CONTROL DE STOCK POR PUNTO DE ENTREGA
CREATE TABLE IF NOT EXISTS public.peaje_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estacion VARCHAR(100) NOT NULL UNIQUE, -- Nombre del Punto de Entrega
    stock_recibido INT NOT NULL DEFAULT 0,
    stock_entregado INT NOT NULL DEFAULT 0,
    stock_minimo_alerta INT NOT NULL DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE GESTIÓN DE USUARIOS Y ROLES (ADMINISTRADOR Y OPERADOR)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    password_hash VARCHAR(100) NOT NULL DEFAULT '123456',
    rol VARCHAR(30) NOT NULL CHECK (rol IN ('Administrador', 'Operador')),
    punto_entrega VARCHAR(100) DEFAULT 'Todos',
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CREAR USUARIOS ADMINISTRADORES INICIALES DE PRUEBA / SISTEMA
INSERT INTO public.user_profiles (email, nombre, password_hash, rol, punto_entrega, activo)
VALUES 
    ('camilo.k@ceeenriquez.com', 'Camilo Korzyniewski', 'admin123', 'Administrador', 'Todos', true),
    ('admin@caminoselva.com', 'Administrador General', 'admin123', 'Administrador', 'Todos', true)
ON CONFLICT (email) DO NOTHING;

-- 4. TABLA DE ALTA DE LOTES DE TAGS POR PUNTO DE ENTREGA (RECEPCIONES / INVENTARIO)
CREATE TABLE IF NOT EXISTS public.tag_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    fecha_recepcion DATE DEFAULT CURRENT_DATE NOT NULL,
    estacion VARCHAR(100) NOT NULL, -- Nombre del Punto de Entrega
    serial_desde VARCHAR(20) NOT NULL,
    serial_hasta VARCHAR(20) NOT NULL,
    cantidad INT NOT NULL,
    numero_remito VARCHAR(100),
    observaciones TEXT,
    usuario_registro VARCHAR(100) NOT NULL
);

-- 5. TABLA DE MOVIMIENTOS Y TRANSFERENCIAS ENTRE DEPOSITOS / PUNTOS DE ENTREGA
CREATE TABLE IF NOT EXISTS public.tag_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    fecha_envio DATE DEFAULT CURRENT_DATE NOT NULL,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    serial_desde VARCHAR(20) NOT NULL,
    serial_hasta VARCHAR(20) NOT NULL,
    cantidad INT NOT NULL,
    estado VARCHAR(30) DEFAULT 'En Tránsito' NOT NULL CHECK (estado IN ('En Tránsito', 'Recibido', 'Cancelado')),
    numero_remito_transferencia VARCHAR(100),
    usuario_envio VARCHAR(100) NOT NULL,
    fecha_recepcion TIMESTAMPTZ,
    usuario_recepcion VARCHAR(100),
    observaciones TEXT
);

-- 6. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_dominio ON public.tag_deliveries(dominio);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_tag_serial ON public.tag_deliveries(tag_serial);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_estacion ON public.tag_deliveries(estacion);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_created_at ON public.tag_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_batches_estacion ON public.tag_batches(estacion);
CREATE INDEX IF NOT EXISTS idx_tag_transfers_origen ON public.tag_transfers(origen);
CREATE INDEX IF NOT EXISTS idx_tag_transfers_destino ON public.tag_transfers(destino);

-- 7. HABILITAR ROW LEVEL SECURITY (RLS) Y POLÍTICAS DE ACCESO TOTAL (SELECT, INSERT, UPDATE, DELETE)
ALTER TABLE public.tag_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peaje_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo en entregas" ON public.tag_deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en stock" ON public.peaje_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en usuarios" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en lotes" ON public.tag_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en transferencias" ON public.tag_transfers FOR ALL USING (true) WITH CHECK (true);

-- 7. TRIGGER AUTOMÁTICO DE ACTUALIZACIÓN DE STOCK AL REGISTRAR ENTREGA
CREATE OR REPLACE FUNCTION update_stock_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.peaje_stock
    SET stock_entregado = stock_entregado + 1,
        updated_at = timezone('utc'::text, now())
    WHERE estacion = NEW.estacion;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_delivery
AFTER INSERT ON public.tag_deliveries
FOR EACH ROW EXECUTE FUNCTION update_stock_on_delivery();
