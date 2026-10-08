# APLICACIÓN ANTIGRAVITY EN VERCEL + SUPABASE
## Registro y Control de Entregas de TAGs TelePASE (Web PC & Mobile PWA)
**Proyecto Peajes Corredor Noreste - Camino Selva S.A.**

---

## 🗂️ Estructura del Proyecto

```
telepases/
├── app/
│   ├── globals.css          # Estilos globales y Tailwind CSS
│   ├── layout.tsx           # Layout principal de Next.js
│   └── page.tsx             # Panel de Control (Dashboard) y Tabla en Tiempo Real
├── components/
│   └── DeliveryForm.tsx     # Formulario de Registro Rápido en Vía
├── lib/
│   └── supabase.ts          # Inicialización del cliente Supabase
├── types/
│   └── database.ts          # Definición de interfaces TypeScript
├── schema.sql               # Script SQL completo para Supabase (Tablas, Triggers, RLS)
├── .env.local               # Credenciales locales de Supabase
├── .env.example             # Plantilla de variables de entorno
├── next.config.mjs          # Configuración de Next.js
├── tailwind.config.ts       # Configuración de Tailwind CSS
├── tsconfig.json            # Configuración de TypeScript
└── package.json             # Dependencias del proyecto
```

---

## 🗄️ 1. Configuración de Base de Datos en Supabase

1. Accedé a tu panel de control en **[Supabase Console](https://supabase.com/dashboard)**.
2. Creá un nuevo proyecto o selecciona uno existente.
3. Dirigite a la sección **SQL Editor**.
4. Copiá y ejecutá el contenido del archivo [`schema.sql`](./schema.sql).

El script creará automáticamente:
- **`tag_deliveries`**: Registro completo de entregas de TAGs RFID por vía.
- **`peaje_stock`**: Control de inventario en tiempo real para las 4 plazas (Santa Ana, Colonia Victoria, Paraje Fachinal, Ituzaingó).
- **Trigger `trg_update_stock_on_delivery`**: Descuenta automáticamente el stock al guardar cada entrega.
- **Índices de alto rendimiento**: Optimización para búsquedas por Patente, Serial y Estación.
- **Políticas RLS**: Seguridad habilitada para lectura e inserción pública.

---

## 💻 2. Ejecución en Entorno Local

1. Instalá las dependencias del proyecto:
   ```bash
   npm install
   ```

2. Configurá el archivo `.env.local` con tus claves de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
   ```
   *(Podés obtener estas credenciales en **Project Settings > API** dentro de Supabase)*

3. Iniciá el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Abrí `http://localhost:3000` en tu navegador.

---

## 🚀 3. Despliegue en Vercel

1. Subí el código a tu repositorio de **GitHub**, **GitLab** o **Bitbucket**.
2. Ingresá a **[Vercel Dashboard](https://vercel.com/dashboard)** y haz clic en **"Add New..." > "Project"**.
3. Importá tu repositorio.
4. En la sección **Environment Variables**, agregá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Haz clic en **Deploy**.

---

## 📊 Funcionalidades Clave

- ⚡ **Modo Rápido en Vía**: Preserva la Estación y el Runner asignado para agilizar entregas seguidas.
- 📱 **Diseño Responsivo (Mobile & PC)**: Optimizado para tabletas en cabina/vía y computadoras de escritorio.
- 📉 **Control de Stock Dinámico**: Alertas automáticas cuando el inventario baja del umbral mínimo por plaza.
- 📥 **Exportación CSV para GLM**: Genera reportes compatibles para el cruce con el sistema GLM.
