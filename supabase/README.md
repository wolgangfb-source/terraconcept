# Base de datos — Cotizador Terra Concept

Proyecto Supabase `terraconcept` (`tguoquizfjcalrqvxqey`), org HBull, plan Free,
Postgres 17.6, región **us-west-2**.

## Archivos

Se corren en orden. Los tres son **idempotentes** — reejecutables sin romper nada.

| Archivo | Qué hace |
|---|---|
| `01_schema.sql` | Enums, 7 tablas, secuencia del correlativo, triggers de `updated_at`, índices |
| `02_seed_tarifario.sql` | 12 partidas + 179 bullets + 9 condiciones generales + 22 parámetros |
| `03_policies.sql` | RLS: sin sesión no se lee ni se escribe nada |

## Cómo conectarse

La red local no tiene IPv6 y el host directo de Supabase
(`db.tguoquizfjcalrqvxqey.supabase.co`) **sólo publica AAAA**. Hay que usar el
**session pooler**, que sí es IPv4:

```
host: aws-1-us-west-2.pooler.supabase.com
port: 5432
user: postgres.tguoquizfjcalrqvxqey
db:   postgres
ssl:  requerido
```

La contraseña no vive en este repo (es público). Está en el panel de Supabase,
en *Connect → Direct connection string → Session pooler*.

## Estado actual

- 7 tablas creadas y pobladas con las paramétricas del tarifario.
- Correlativo `cotizacion_numero_seq` listo, arranca en **5** → se muestra `00005`.
- RLS activa en las 7 tablas. Verificado: el rol `anon` recibe 401 en todas;
  un JWT autenticado ve las 12 líneas y los 22 parámetros.
- Registro público de usuarios **deshabilitado** — los usuarios se crean a mano
  desde *Authentication → Users*.
- Sin datos operacionales todavía (`clientes`, `cotizaciones` vacías).

## Notas de diseño

**El correlativo lo asigna la DB**, no el navegador, para que dos cotizaciones
creadas al mismo tiempo no choquen ni dejen huecos.

**`cotizaciones.snapshot` (jsonb) congela la cotización**: al emitir se guarda el
texto íntegro de la partida y las condiciones generales. Si mañana sube el
tarifario, una cotización de hoy se sigue reimprimiendo como se envió.

**Las cotizaciones no se borran**, se pasan a estado `anulada` — así el
correlativo no queda con huecos.

**`cotizacion_detalle` es mixto a propósito.** En la cotización de referencia el
total no sale de multiplicar el precio del tarifario: las filas son "Radier
perimetral", "Mano de obra especializada", "Logística y traslado". La app propone
una primera fila desde la partida y el usuario agrega, edita y borra filas libres.
