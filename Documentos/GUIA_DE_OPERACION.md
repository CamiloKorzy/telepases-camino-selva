# GUÍA DE OPERACIÓN Y MANUAL DE USO - PLATAFORMA TELEPASE
## Corredor Vial Noreste - Camino Selva S.A.

Este documento constituye el **Manual Oficial de Operación del Sistema TelePASE**. Contiene las instrucciones paso a paso para acceder, operar y administrar cada módulo de la plataforma web y de la Aplicación Móvil (APK).

---

## 1. Acceso a la Plataforma e Inicio de Sesión
- **Dirección Web / APK**: Acceso a la interfaz web o mediante la app Android `TelePASE-CaminoSelva.apk`.
- **Credenciales y Cuentas por Defecto**:
  - **Administrador**: `camilo.k@ceeenriquez.com` / `admin@caminoselva.com` (Clave: `Cee$$2026`).
  - **Operadores de Peaje**: `peaje.santa.ana@caminoselva.com`, `peaje.victoria@caminoselva.com`, `peaje.fachinal@caminoselva.com`, `peaje.ituzaingo@caminoselva.com`, `oficina.central@caminoselva.com` (Clave: `op123456`).
  - **Consulta / Auditoría**: `consulta@caminoselva.com` (Clave: `consulta123`).
- **Opción "Recordar mi usuario"**: Marque el tilde al ingresar para persisiti la dirección de correo en el navegador/dispositivo y evitar escribirlo en cada ingreso.
- **Rendimiento de Login**: Autenticación inmediata con respuesta `<400ms` usando caché local de perfiles y sincronización en segundo plano con la base de datos Supabase.

---

## 2. Módulo de Registración de Entregas en Vía
El módulo principal permite al personal del peaje registrar de manera rápida la entrega de obleas RFID a los conductores.

### Pasos para registrar una entrega:
1. **Seleccionar Punto de Entrega**: Elija la estación correspondiente (ej. *Santa Ana*, *Colonia Victoria*, *Paraje Fachinal*, *Ituzaingó*).
2. **Dominio / Patente**: Ingrese el dominio del vehículo (ej. `AB123CD` o `AA111AA`).
3. **DNI / CUIT**: Ingrese el número de documento o CUIT del titular.
4. **Nombre Receptor**: Nombre completo o razón social de la persona o empresa receptora.
5. **Replicación para Empresas / Flotas**: Si se registran varios vehículos de un mismo titular, presione los botones **"Replicar Nombre"** y **"Replicar CUIT"** para clonar automáticamente los datos al siguiente formulario.
6. **Cantidad y TAG Serial**: El campo de cantidad inicia por defecto en 1. Ingrese o escanee el número de serie de la oblea (ej. `63230000`).
7. **Registrar**: Al presionar **"REGISTRAR ENTREGA DE TAGS"**, el sistema realiza las siguientes validaciones:
   - Controla que el TAG pertenezca al inventario o lote recibido en esa estación.
   - Controla que el TAG no haya sido entregado anteriormente en ninguna estación.
   - Limpia los campos automáticamente tras confirmar la registración.

---

## 3. Módulo de Movimientos y Transferencias entre Estaciones
Permite trasladar cajas/lotes de TAGs desde la **Oficina Central** hacia los distintos peajes del corredor o realizar transferencias inter-estación.

### Enviar Transferencia (Estación Origen):
1. Seleccionar **Estación Origen** y **Estación Destino**.
2. Ingresar la **Serie Desde** y la **Serie Hasta** (ej. `63230000` al `63231499`).
3. El sistema valida automáticamente que el rango complete la cantidad ingresada y que todos los TAGs pertenezcan activamente al inventario de la estación Origen.
4. Al confirmar, el estado del remito pasa a **"En Tránsito"**.

### Recepcionar Remito (Estación Destino):
1. En la tarjeta indicadora de la estación Destino aparecerá el indicador **"Pend. Recepción"**.
2. Al ingresar a la pestaña **Movimientos**, se visualizan las transferencias pendientes.
3. Presione **"Confirmar Recepción"**. El estado cambiará a **"Recibido"** y las unidades se sumarán al stock disponible para entrega en vía de esa estación.

---

## 4. Módulo de Alta de Lotes de Fábrica (Administrador)
Reservado para el Administrador general. Permite la registración de remitos de fábrica con la incorporación de nuevos bloques de series al stock del Corredor Vial (ej. Lote Inicial de 20.000 TAGs).

---

## 5. Módulo de Puntos de Entrega (Estaciones)
Permite configurar los Puntos de Entrega oficiales y definir el **Stock Mínimo de Alerta**. Cuando el stock disponible en una estación cae por debajo de dicho umbral, la tarjeta indicadora cambia a alerta en color rojo.

---

## 6. Módulo de Usuarios y Roles
Gestión de usuarios y asignación de permisos:
- **Administrador**: Acceso ilimitado, creación de usuarios, edición y eliminación de entregas, botón de "Limpiar Entregas".
- **Operador**: Registro de entregas y transferencias de su estación.
- **Consulta**: Solo lectura de reportes y stocks.

---

## 7. Módulo de Auditoría de Operaciones
Todas las operaciones realizadas por cualquier usuario o rol (incluso administradores) son registradas con sello de fecha, hora, usuario, rol y detalle en el **Log de Usuario**, accesible desde la pestaña **Auditoría**.

---

## 8. Exportación de Datos a Excel y CSV
Desde la vista principal de entregas se puede filtrar el historial y exportar los reportes en formato **Excel (.xlsx)** o **CSV** conteniendo las 7 columnas exactas registradas:
1. **Fecha/Hora**
2. **Punto de Entrega**
3. **Patente**
4. **TAG Serial**
5. **DNI / CUIT**
6. **Nombre Receptor**
7. **Usuario Registrador**
