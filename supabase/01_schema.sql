-- ============================================================================
-- Terra Concept — Cotizador
-- 01_schema.sql — tablas, secuencia del correlativo, triggers, indices
--
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type unidad_medida as enum ('m2', 'ml', 'un');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_cotizacion as enum ('borrador', 'enviada', 'aceptada', 'rechazada', 'anulada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_item as enum ('incluye', 'no_incluye');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- PARAMETRICAS
-- ===========================================================================

-- Las 12 filas del tarifario (11 partidas; la 5 se abre en dos formatos).
create table if not exists lineas (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,
  familia         text not null,
  nombre          text not null,
  subtitulo       text,
  titulo_portada  text,
  bajada_portada  text,
  unidad          unidad_medida not null,
  precio_base     integer not null check (precio_base >= 0),
  minimo          numeric(10,2) not null default 0 check (minimo >= 0),
  imagen          text,
  orden           integer not null default 0,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Guardas para que el archivo siga siendo idempotente si la tabla ya existia
-- sin estas columnas.
alter table lineas add column if not exists titulo_portada text;
alter table lineas add column if not exists bajada_portada text;

drop trigger if exists lineas_updated_at on lineas;
create trigger lineas_updated_at
  before update on lineas
  for each row execute function set_updated_at();

comment on table  lineas is 'Tarifario base. Fuente: PROPUESTA ECONOMICA BASE TERRA CONCEPT.docx';
comment on column lineas.precio_base is 'Valor CLP neto por unidad. "Desde $X" en el tarifario.';
comment on column lineas.minimo is 'Superficie / metros lineales / unidades minimas de la partida.';

-- Bullets de "Incluye" / "No incluye" de cada partida.
create table if not exists linea_items (
  id        bigint generated always as identity primary key,
  linea_id  bigint not null references lineas(id) on delete cascade,
  tipo      tipo_item not null,
  texto     text not null,
  orden     integer not null default 0
);

create index if not exists linea_items_linea_idx on linea_items (linea_id, tipo, orden);

-- Las 9 clausulas de cierre del tarifario.
create table if not exists condiciones_generales (
  id      bigint generated always as identity primary key,
  texto   text not null,
  orden   integer not null default 0,
  activo  boolean not null default true
);

-- Clave/valor editable sin tocar codigo: iva_pct, validez_dias, etc.
create table if not exists parametros (
  clave       text primary key,
  valor       text not null,
  descripcion text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists parametros_updated_at on parametros;
create trigger parametros_updated_at
  before update on parametros
  for each row execute function set_updated_at();

-- ===========================================================================
-- OPERACIONALES
-- ===========================================================================

create table if not exists clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  rut        text,
  email      text,
  telefono   text,
  direccion  text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clientes_nombre_idx on clientes (lower(nombre));

drop trigger if exists clientes_updated_at on clientes;
create trigger clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

-- Correlativo de cotizaciones. Arranca en 5 por decision del usuario.
-- Vive en la DB (no en el navegador) para que no haya huecos ni choques
-- entre dos cotizaciones creadas al mismo tiempo.
create sequence if not exists cotizacion_numero_seq start with 5 increment by 1;

create table if not exists cotizaciones (
  id               bigint generated always as identity primary key,
  numero           integer not null unique default nextval('cotizacion_numero_seq'),
  cliente_id       bigint references clientes(id) on delete restrict,
  linea_id         bigint references lineas(id) on delete restrict,

  proyecto         text,
  direccion        text,
  fecha            date not null default current_date,
  validez_dias     integer not null default 7,
  plazo_ejecucion  text,

  estado           estado_cotizacion not null default 'borrador',

  -- Las cotizaciones van solo en valor neto: sin IVA.
  -- `total` se mantiene separado de `neto` como gancho para ajustes futuros
  -- (descuentos, recargos); hoy son iguales.
  neto             integer not null default 0,
  total            integer not null default 0,

  notas            text,

  -- Congela el texto de la partida al momento de emitir: nombre, bullets de
  -- incluye/no incluye, condiciones generales y precios. Si manana sube el
  -- tarifario, esta cotizacion se sigue reimprimiendo como se envio.
  snapshot         jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users(id) on delete set null
);

-- El IVA se eliminó del alcance: las cotizaciones van sólo en valor neto.
-- Guardas para que el archivo siga siendo idempotente contra una base que ya
-- tenía estas columnas.
alter table cotizaciones drop column if exists iva_pct;
alter table cotizaciones drop column if exists iva_monto;

create index if not exists cotizaciones_numero_idx  on cotizaciones (numero desc);
create index if not exists cotizaciones_cliente_idx on cotizaciones (cliente_id);
create index if not exists cotizaciones_estado_idx  on cotizaciones (estado);
create index if not exists cotizaciones_fecha_idx   on cotizaciones (fecha desc);

drop trigger if exists cotizaciones_updated_at on cotizaciones;
create trigger cotizaciones_updated_at
  before update on cotizaciones
  for each row execute function set_updated_at();

-- Filas del cuadro "DESGLOSE DE INSTALACION".
-- Mixto a proposito: la app propone una primera fila desde el tarifario
-- (cantidad x precio_base) y el usuario agrega/edita/borra filas libres.
create table if not exists cotizacion_detalle (
  id              bigint generated always as identity primary key,
  cotizacion_id   bigint not null references cotizaciones(id) on delete cascade,
  descripcion     text not null,
  cantidad        numeric(10,2),
  unidad          text,
  precio_unitario integer,
  valor           integer not null default 0,
  orden           integer not null default 0
);

create index if not exists cotizacion_detalle_cot_idx on cotizacion_detalle (cotizacion_id, orden);

-- ---------------------------------------------------------------------------
-- Numero formateado a 5 digitos -> 00005
-- ---------------------------------------------------------------------------
create or replace function numero_formateado(n integer)
returns text
language sql
immutable
as $$
  select lpad(n::text, 5, '0');
$$;
