# MANUAL COMPLETO Y GUÍA DE APRENDIZAJES - PLATAFORMA TELEPASE
## Corredor Vial Noreste - Camino Selva S.A.

Bienvenido al **Manual Oficial de Operación de la Plataforma TelePASE**. Este documento está estructurado para que cualquier usuario, sin importar si es su primer día en la casilla de peaje o si es el Administrador General, aprenda a operar el sistema paso a paso con total claridad.

---

## 1. CONCEPTOS CLAVE ANTES DE EMPEZAR

### 1.1. ¿Qué es una Oblea / TAG RFID?
Un **TAG TelePASE** es una etiqueta/sticker adhesivo con un chip electrónico inteligente que se coloca en el parabrisas de los vehículos. 
- Cada oblea tiene impreso un **Número de Serie único de 8 dígitos** (ejemplo: `63228500` o `63230000`).
- No pueden existir dos vehículos con el mismo número de TAG.

### 1.2. Puntos de Entrega Oficiales
El Corredor Vial Noreste cuenta con 5 estaciones/depósitos registrados:
1. **Santa Ana** (Peaje Ruta 12)
2. **Colonia Victoria** (Peaje Ruta 12)
3. **Paraje Fachinal** (Peaje Ruta 105)
4. **Ituzaingó** (Peaje Ruta 12)
5. **Oficina Central** (Depósito Central y Administración)

---

## 2. EL CIRCUITO DE INVENTARIO (¿De dónde sale el stock?)

Para comprender por qué una oblea puede o no entregarse en vía, es fundamental conocer el viaje que hace el stock:

```
┌─────────────────┐       Alta de Lote        ┌─────────────────┐
│ 1. FÁBRICA      │ ────────────────────────> │ 2. OF. CENTRAL  │
└─────────────────┘                           └─────────────────┘
                                                       │
                                            Transferencia (Envío)
                                                       │
                                                       ▼
┌─────────────────┐   Confirmar Recepción     ┌─────────────────┐
│ 4. ENTREGA VÍA  │ <──────────────────────── │ 3. PEAJE DESTINO│
│ (-1 disponible) │                           │ (Pend.Recepc.)  │
└─────────────────┘                           └─────────────────┘
```

1. **Ingreso a Oficina Central**: Cuando la empresa compra obleas a fábrica (ej. 20.000 unidades), el Administrador las registra en *Oficina Central* mediante la opción **Alta de Lotes**.
2. **Transferencias a Peajes**: Oficina Central distribuye el stock enviando cajas/lotes a cada peaje (ej. 1.500 TAGs a Santa Ana). El envío queda en estado **"En Tránsito"** y en la tarjeta del peaje destino se enciende la alerta **"Pend. Recepción"**.
3. **Confirmación en Peaje**: El operador del peaje abre la pestaña **Movimientos** y hace clic en el botón verde **"Confirmar Recepción"**. A partir de ese segundo, los TAGs quedan en estado **Disponible (disp.)** para entregarse a los conductores.
4. **Entrega al Vehículo**: Cuando registras 1 entrega en la casilla, el stock *Disponible* baja en 1 unidad y el stock *Entregados* aumenta en 1.

---

## 3. PASO A PASO: ¿CÓMO REGISTRAR TU PRIMERA ENTREGA DE TAG?

Sigue este procedimiento exacto cada vez que un vehículo se detenga a solicitar o instalar su TelePASE:

### Paso 1: Revisa tu Punto de Entrega
- En el formulario, el primer campo es **Punto de Entrega**. Debe coincidir con la estación donde estás ubicado (ej. *Santa Ana*).

### Paso 2: Ingrese la Patente / Dominio
- Tipea la patente del vehículo sin espacios ni guiones.
- **Ejemplos válidos**: `AB123CD` (Mercosur) o `AA100BB` o `ABC123` (Formato anterior).

### Paso 3: Ingrese DNI / CUIT y Nombre del Conductor
- **DNI / CUIT**: Ingrese el número del titular o CUIT de la empresa (ej: `30712345678` o `20334445559`).
- **Nombre Receptor**: Nombre completo del conductor o razón social (ej: *Juan Pérez* o *Transporte Misiones S.R.L.*).

### Paso 4: Ingrese el Número de Serie del TAG
- Tipea o escanea los 8 dígitos del sticker (ej: `63230000`). La cantidad siempre es **1**.

### Paso 5: Presione "REGISTRAR ENTREGA DE TAGS"
- El sistema guardará la operación, el formulario se limpiará de forma automática y la fila aparecerá al instante en la **Grilla de Entregas** de abajo.

---

## 4. HERRAMIENTA ESPECIAL: REPLICACIÓN PARA FLOTAS Y EMPRESAS

Si llega un chofer o apoderado a registrar **10 camiones de la misma empresa**:
1. Registra el primer vehículo normalmente (*Nombre: Transporte Selva S.R.L.*, *CUIT: 30711112223*).
2. Presiona los botones azules **"Replicar Nombre"** y **"Replicar CUIT"** al lado de los campos.
3. Al presionar **Registrar Entrega**, el sistema guardará el primer camión pero **MANTENDRÁ RELLENADOS EL NOMBRE Y EL CUIT** para el siguiente formulario.
4. Para los siguientes 9 camiones, solo tendrás que escribir la nueva Patente y el nuevo TAG. ¡Ahorras más del 70% del tiempo de carga!

---

## 5. GUÍA RÁPIDA DE RESOLUCIÓN DE MENSAJES DE ERROR

### ❌ Error 1: "El TAG NO corresponde a ningún lote ni transferencia en la estación"
- **¿Por qué ocurre?**: El número de TAG tipeado no pertenece al inventario cargado o recibido en tu peaje.
- **¿Cómo solucionarlo?**: 
  1. Verifica que no hayas cometido un error de tipeo en los dígitos del TAG.
  2. Si el número es correcto, verifica en la pestaña **Movimientos** si el paquete de TAGs figura pendiente de recepción.

### ⚠️ Error 2: "El TAG proviene de una transferencia PENDIENTE DE RECEPCIÓN"
- **¿Por qué ocurre?**: La caja de TAGs fue enviada a tu peaje pero ningún operador ingresó aún a confirmar el remito.
- **¿Cómo solucionarlo?**: Entra a la pestaña **Movimientos** y haz clic en el botón verde **"Confirmar Recepción"**. Luego vuelve al formulario y regístralo.

### 🚫 Error 3: "El TAG ya fue entregado previamente"
- **¿Por qué ocurre?**: Ese número de serie ya fue registrado en otro vehículo. No se permite duplicar entregas de obleas.

---

## 6. USUARIOS, ROLES Y CLAVES DE RESPALDO

| Rol de Usuario | Permisos y Funciones | Clave Maestra por Defecto |
| :--- | :--- | :--- |
| **Administrador** | Acceso total: Usuarios, Alta de Lotes, Edición/Eliminación de entregas y Botón "Limpiar Entregas". | `Cee$$2026` |
| **Operador** | Trabajo en casilla: Registración de entregas en vía y confirmación de transferencias de su peaje. | `op123456` |
| **Consulta** | Auditoría y Supervisión: Solo lectura de inventarios, tarjetas e informes. | `consulta123` |

*Nota*: Se recomienda activar el tilde **"Recordar mi usuario"** en la pantalla de inicio de sesión para que el sistema recuerde tu correo y no tengas que volver a escribirlo.

---

## 7. EXPORTACIÓN DE REPORTES (EXCEL Y CSV)

Los botones **"Descargar XLS"** y **"CSV"** descargan los datos filtrados en pantalla conteniendo únicamente las **7 columnas oficiales**:
1. **Fecha/Hora**
2. **Punto de Entrega**
3. **Patente**
4. **TAG Serial**
5. **DNI / CUIT**
6. **Nombre Receptor**
7. **Usuario Registrador**
