-- ============================================================================
-- Terra Concept — Cotizador
-- 03_policies.sql — Row Level Security
--
-- Regla unica: sin sesion iniciada no se lee ni se escribe NADA.
-- El cotizador se sirve desde una URL publica de Netlify y la publishable key
-- viaja en el navegador, asi que la RLS es la unica barrera real. "Sin link
-- desde produccion" no protege: la URL es adivinable.
--
-- Idempotente: reejecutable.
-- ============================================================================

alter table lineas                enable row level security;
alter table linea_items           enable row level security;
alter table condiciones_generales enable row level security;
alter table parametros            enable row level security;
alter table clientes              enable row level security;
alter table cotizaciones          enable row level security;
alter table cotizacion_detalle    enable row level security;

-- Nadie entra sin sesion. Se revoca el acceso del rol anonimo a nivel de
-- privilegios, ademas de la RLS — dos cierres en vez de uno.
revoke all on lineas, linea_items, condiciones_generales, parametros,
              clientes, cotizaciones, cotizacion_detalle
  from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on lineas, linea_items, condiciones_generales, parametros,
     clientes, cotizaciones, cotizacion_detalle
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Politicas
--
-- Todas exigen `auth.uid() is not null`. El equipo de Terra Concept comparte
-- el mismo pool de cotizaciones, asi que cualquier usuario autenticado ve y
-- edita todo — no hay separacion por vendedor. Si mas adelante se quiere que
-- cada uno vea solo lo suyo, el gancho ya existe: `cotizaciones.created_by`.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'lineas', 'linea_items', 'condiciones_generales', 'parametros',
    'clientes', 'cotizaciones', 'cotizacion_detalle'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_auth_select', t);
    execute format('drop policy if exists %I on %I', t || '_auth_insert', t);
    execute format('drop policy if exists %I on %I', t || '_auth_update', t);
    execute format('drop policy if exists %I on %I', t || '_auth_delete', t);

    execute format(
      'create policy %I on %I for select to authenticated using (auth.uid() is not null)',
      t || '_auth_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (auth.uid() is not null)',
      t || '_auth_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      t || '_auth_update', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (auth.uid() is not null)',
      t || '_auth_delete', t);
  end loop;
end $$;
