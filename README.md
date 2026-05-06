# GenLab Control

Plataforma React + Supabase para un laboratorio de genética humana. Incluye login en la raíz, dashboard, pacientes, bitácora de registros, carga Excel/CSV, exportación Excel del dashboard, reportes PDF filtrados y creación de usuarios por superusuario.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Superusuario

Correo:

```text
joeltrincadov@gmail.com
```

Contraseña recomendada:

```text
GenLab-JT!2026-74Mx
```

En modo local de demostración esa cuenta ya existe. En producción debes crear ese usuario en Supabase Auth con la contraseña anterior o con una propia de igual fuerza. El esquema SQL promueve automáticamente ese correo a rol `superuser`.

## Configuración Supabase

Este workspace ya esta conectado localmente al proyecto Supabase `bd_test`:

```text
Project ref: spbyhknvhczytrdpjlwx
URL: https://spbyhknvhczytrdpjlwx.supabase.co
```

Para replicarlo en otra maquina:

1. Copia `.env.example` a `.env`.
2. Agrega:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

3. Ejecuta el contenido de `supabase/schema.sql` en el SQL Editor de Supabase.
4. En Authentication, crea el usuario `joeltrincadov@gmail.com`.
5. Despliega la Edge Function:

```bash
supabase functions deploy create-user
```

La función `create-user` usa `SUPABASE_SERVICE_ROLE_KEY` en el entorno de Supabase, no en el frontend. Sirve para que el superusuario cree cuentas de acceso desde la plataforma.

## Carga masiva

La sección Carga acepta `.xlsx`, `.csv` y `.tsv`. Los campos mínimos son:

- `Nombre`
- `Apellidos`

También reconoce encabezados como `Edad`, `Sexo`, `Localidad`, `Estado`, `Vivienda`, `Material Vivienda`, `Agua`, `Saneamiento`, `Hacinamiento`, `Condiciones De Vida`, `Código Muestra`, `Diagnóstico`, `Estudio Genético`, `Antecedentes Familiares`, `Teléfono` y `Notas Clínicas`.

Los textos se normalizan a formato capitulado antes de guardarse.

## Exportaciones

- Dashboard: descarga un `.xlsx` con métricas, distribuciones, pacientes y bitácora.
- Reportes: descarga un PDF con los pacientes resultantes de los filtros, estadígrafos principales y resumen por estado.
