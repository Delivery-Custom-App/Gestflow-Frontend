# GUÍA: Generar Datos de Prueba para Métricas del Dashboard

## ¿Qué haremos?
Vamos a generar datos realistas en tu base de datos Supabase para que puedas probar el flujo completo de métricas:
- ✅ Órdenes/Ventas con diferentes métodos de pago
- ✅ Gastos operacionales (aprobados y pendientes)
- ✅ Transferencias de dueño a local
- ✅ Cajas registradas y activas

## Pasos

### 1️⃣ Obtener el UUID del Local

Tienes dos opciones:

#### Opción A: Desde Supabase Studio
1. Ve a tu proyecto en [supabase.com/dashboard](https://supabase.com/dashboard)
2. Abre **SQL Editor**
3. Crea una nueva query y ejecuta:
   ```sql
   SELECT id, name, address FROM locals LIMIT 10;
   ```
4. Copia el UUID de la columna `id` del local que quieres usar

#### Opción B: Desde la consola del navegador
Si estás en el dashboard del frontend:
1. Abre DevTools (F12)
2. Ve a Console
3. Ejecuta:
   ```javascript
   const localsJson = localStorage.getItem('locals');
   console.log(localsJson); // Busca el local y copia su "id"
   ```

---

### 2️⃣ Personalizar el Script SQL

1. Abre el archivo: `seed-test-data.sql` (en la raíz del proyecto frontend)
2. Busca esta línea (aprox. línea 15):
   ```sql
   v_local_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid; -- CAMBIAR ESTO
   ```
3. Reemplaza el UUID entre comillas con el tuyo
   - **Ejemplo:** Si el local es "testing" con UUID `550e8400-e29b-41d4-a716-446655440000`:
   ```sql
   v_local_id UUID := '550e8400-e29b-41d4-a716-446655440000'::uuid;
   ```

---

### 3️⃣ Ejecutar el Script en Supabase

1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard) de tu proyecto
2. Abre **SQL Editor**
3. Haz click en **New Query**
4. Copia **TODO el contenido** del archivo `seed-test-data.sql` (personalizado)
5. Pega el código en el editor
6. Haz click en **▶️ Run** (o Ctrl+Enter)

**Resultado esperado:**
```
Datos de prueba generados exitosamente para local: 550e8400-e29b-41d4-a716-446655440000
Se crearon:
  - 8 órdenes de ventas (total: CLP 186,400)
  - 5 registros de gastos (total: CLP 150,500)
  - 3 transferencias (total: CLP 355,000)
  - 3 cajas registradas
```

---

### 4️⃣ Verificar en el Frontend

1. Accede al dashboard del frontend
2. Selecciona el local donde ejecutaste el seed
3. Haz click en **Administrativo**
4. Verifica que veas datos en:
   - **Dashboard**: Ventas del día, ventas del mes, flujo de caja
   - **Ventas**: Listado de 8 órdenes con desglose por método de pago
   - **Rendiciones**: Gastos aprobados + transferencias
   - **Flujo de Caja**: Cajas activas e inactivas, estado operativo

---

## ⚠️ Posibles Errores

### Error: "relation 'orders' does not exist"
**Causa:** Los nombres de las tablas en tu BD son diferentes
**Solución:** Verifica en Supabase Studio > SQL Editor > Table Explorer qué nombres tienen tus tablas y actualiza el script

### Error: "column 'items' does not exist"
**Causa:** Tu tabla `orders` no tiene columna `items`
**Solución:** Revisa la estructura real de tu tabla y ajusta el script

### No aparecen datos en el frontend
**Causas posibles:**
- El local_id está incorrecto
- El backend está filtrando por fecha/status diferente
- Faltan relaciones en la BD

**Verifica:**
```sql
SELECT COUNT(*) as total FROM orders WHERE local_id = '550e8400-e29b-41d4-a716-446655440000';
```
Si devuelve 0, ejecuta nuevamente el script con el UUID correcto.

---

## 📊 Datos Generados por Defecto

| Concepto | Cantidad | Total |
|----------|----------|-------|
| Órdenes | 8 | CLP 186,400 |
| Gastos aprob. | 3 | CLP 113,000 |
| Gastos pend. | 2 | CLP 37,500 |
| Transferencias | 3 | CLP 355,000 |
| Cajas | 3 | 2 activas |

---

## 🔧 Personalización Avanzada

Si quieres cambiar los montos o cantidades:

### Modificar ingresos diarios
Busca la sección de `INSERT INTO orders` y ajusta `total_amount`

### Modificar gastos
Busca la sección de `INSERT INTO expenses` y cambia `amount` y `status`

### Cambiar la moneda o formato
Si necesitas diferentes denominaciones, actualiza en la sección de valores

---

## ✅ Checklist

- [ ] Tengo el UUID del local
- [ ] Personalicé el script con mi UUID
- [ ] Ejecuté en Supabase SQL Editor
- [ ] Veo el mensaje de confirmación
- [ ] Verificado en frontend que aparecen datos

---

¿Necesitas ayuda? Verifica:
1. El UUID del local es correcto (8-4-4-4-12 caracteres)
2. Los nombres de las tablas coinciden con tu BD
3. El backend está respondiendo (ve a Network en DevTools)
