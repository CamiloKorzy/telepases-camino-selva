-- =====================================================================
-- PROYECTO CORREDOR NORESTE - CAMINO SELVA S.A.
-- APLICACIÓN ANTIGRAVITY: REGISTRO Y CONTROL DE TAGS TELEPASE
-- =====================================================================

-- 1. TABLA MAESTRA DE ENTREGAS EN VÍA (7 DATOS CLAVE)
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

-- INICIALIZAR LOS PUNTOS DE ENTREGA INICIALES
INSERT INTO public.peaje_stock (estacion, stock_recibido, stock_minimo_alerta)
VALUES 
    ('Santa Ana', 2000, 150),
    ('Colonia Victoria', 1500, 100),
    ('Paraje Fachinal', 1000, 100),
    ('Ituzaingó', 1500, 100)
ON CONFLICT (estacion) DO NOTHING;

-- 3. TRIGGER AUTOMÁTICO DE ACTUALIZACIÓN DE STOCK AL REGISTRAR ENTREGA
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

CREATE OR REPLACE TRIGGER trg_update_stock_on_delivery
AFTER INSERT ON public.tag_deliveries
FOR EACH ROW EXECUTE FUNCTION update_stock_on_delivery();

-- 4. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS Y CRUCE CON GLM
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_dominio ON public.tag_deliveries(dominio);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_tag_serial ON public.tag_deliveries(tag_serial);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_estacion ON public.tag_deliveries(estacion);
CREATE INDEX IF NOT EXISTS idx_tag_deliveries_created_at ON public.tag_deliveries(created_at DESC);

-- 5. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.tag_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peaje_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura publica de entregas" ON public.tag_deliveries FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de entregas" ON public.tag_deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir lectura de stock" ON public.peaje_stock FOR SELECT USING (true);

-- 6. TABLA DE GESTIÓN DE USUARIOS Y ROLES (ADMINISTRADOR Y OPERADOR)
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

-- CREAR USUARIO ADMINISTRADOR INICIAL
INSERT INTO public.user_profiles (email, nombre, password_hash, rol, punto_entrega, activo)
VALUES 
    ('camilo.k@ceeenriquez.com', 'Camilo Korzyniewski', 'admin123', 'Administrador', 'Todos', true),
    ('admin@caminoselva.com', 'Administrador General', 'admin123', 'Administrador', 'Todos', true)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de usuarios" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Permitir insercion y edicion de usuarios" ON public.user_profiles FOR ALL USING (true);

-- 7. TABLA DE ALTA DE LOTES DE TAGS POR PUNTO DE ENTREGA (INVENTARIO NUMERADO)
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

ALTER TABLE public.tag_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de lotes" ON public.tag_batches FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de lotes" ON public.tag_batches FOR ALL USING (true);
