# Plan — Cotizador Terra Concept

Página interna de generación de cotizaciones, dentro del mismo proyecto Netlify,
sin link desde el sitio público. Fuente del contenido: `PROPUESTA ECONOMICA BASE
TERRA CONCEPT.docx` (tarifario, 11 partidas) + imagen de referencia del formato
de 3 páginas.

---

## 1. Alcance

| # | Entregable |
|---|---|
| 1 | Página `/cotizador/` en el mismo repo/deploy, sin link desde `index.html`, `noindex` |
| 2 | Menú de selección de tipo de cotización (12 partidas del tarifario) |
| 3 | Formulario de datos variables (cliente, proyecto, cantidades, precios, plazos) |
| 4 | Render del documento en el formato de la imagen de referencia (3 págs, 4 si el detalle es largo) |
| 5 | Base de datos Supabase: paramétricas + clientes + cotizaciones + detalle |
| 6 | Numeración correlativa desde el 5, generada por la DB |
| 7 | Menú de consulta, edición y duplicado de cotizaciones existentes |
| 8 | Descarga en PDF |
| 9 | Autenticación Supabase desde el inicio (decidido — ver §8-A) |

---

## 2. Advertencias de seguridad (leer antes de empezar)

**a) La contraseña de la base de datos quedó expuesta en el chat.**
Hay que **rotarla en el panel de Supabase** (Settings → Database → Reset database
password). Esa contraseña es sólo para conexión directa a Postgres — la app web
nunca la usa — pero conviene rotarla igual. No se transcribe en este documento:
el repositorio es público.

**b) La `publishable key` sí puede ir en el código del navegador.**
Las keys `sb_publishable_*` están diseñadas para ser públicas. Lo que protege los
datos **no es la key, son las políticas RLS**. Si RLS queda abierto, cualquiera
que descubra la URL `terraconcept.cl/cotizador/` puede leer y escribir todos los
datos de clientes y cotizaciones.

**c) "Sin link directo" no es seguridad, es sólo discreción.**
La URL es adivinable y Netlify sirve el archivo a cualquiera que la escriba.

**Consecuencia práctica:** el usuario optó por implementar la autenticación
**desde el inicio**, de modo que la RLS se escribe directamente contra
`auth.uid()` y nunca existe una ventana con la DB abierta.

**d) Nada de credenciales en el repo.** El repo `wolgangfb-source/terraconcept`
es **público**. Al archivo de config del cotizador van solamente la URL del
proyecto y la publishable key. La contraseña de la DB, la `service_role` key y
cualquier secreto no entran nunca al repo.

---

## 3. Arquitectura

Se mantiene la línea del proyecto: **sin build step, sin framework, sin
`package.json`**. La app corre 100 % en el navegador y habla directo con
Supabase vía su cliente JS cargado como ES module desde CDN — el mismo patrón
que ya usa `index.html` para la librería Motion.

```
/index.html                  ← sitio público, NO se toca
/cotizador/
    index.html               ← shell de la app (menú, formulario, listado)
    app.js                   ← lógica: Supabase, cálculo, estado
    config.js                ← URL + publishable key (público, sin secretos)
    ui.css                   ← estilos de la interfaz del cotizador
    documento.css            ← estilos del documento cotización + @page / @media print
/images/cotizador/
    piscina.jpg  pastelones.jpg  adoquines.jpg  fachaletas.jpg
/supabase/
    01_schema.sql  02_seed_tarifario.sql  03_policies.sql
/docs/PLAN-COTIZADOR.md      ← este archivo
```

Se hereda la identidad visual del sitio: tokens `--green #1c2b1f`,
`--cream #f7f5f0`, `--stone #a89f92`, `--line #ddd7c8`, tipografías **Jost**
(títulos) + **Inter** (texto).

**Alternativa descartada:** backend con Netlify Functions. Guardaría la
`service_role` key del lado servidor, pero obliga a introducir `package.json` y
build — se sale del stack actual sin dar un beneficio que RLS + Auth no den ya.

---

## 4. Modelo de datos (Supabase / Postgres)

### Paramétricas (se cargan una vez desde el DOCX)

**`lineas`** — las 12 filas del tarifario
`id · codigo · familia · nombre · unidad ('m2'|'ml'|'un') · precio_base · minimo · imagen · orden · activo`

**`linea_items`** — los bullets de cada partida
`id · linea_id · tipo ('incluye'|'no_incluye') · texto · orden`

**`condiciones_generales`** — las 9 cláusulas del cierre del DOCX
`id · texto · orden · activo`

**`parametros`** — clave/valor editable: `iva_pct` (19), `validez_dias` (7),
`visita_tecnica_uf` (1), textos legales del pie.

### Operacionales

**`clientes`**
`id · nombre · rut · email · telefono · direccion · created_at`

**`cotizaciones`**
`id · numero (correlativo) · cliente_id · linea_id · proyecto · direccion ·
fecha · validez_dias · plazo_ejecucion · estado ('borrador'|'enviada'|'aceptada'|'rechazada'|'anulada') ·
neto · iva_pct · iva_monto · total · notas · snapshot (jsonb) · created_at · updated_at`

**`cotizacion_detalle`** — las filas del cuadro "DESGLOSE DE INSTALACIÓN"
`id · cotizacion_id · descripcion · cantidad · unidad · precio_unitario · valor · orden`

### Tres decisiones de diseño que importan

**Correlativo desde el 5.** Columna `numero` alimentada por una secuencia
Postgres `START WITH 5`, asignada en la DB (no en el navegador) para que no haya
huecos ni choques. Se muestra con relleno de ceros a **5 dígitos** → `00005`.

**`snapshot` congela la cotización.** Al emitir se guarda en `jsonb` el texto
íntegro de la partida (nombre, bullets de incluye/no incluye, condiciones
generales, precios). Así, si mañana sube el tarifario, una cotización de hoy
sigue reimprimiéndose exactamente como se envió. Sin esto, editar el tarifario
reescribe el pasado.

**El desglose es mixto, no automático.** En la imagen de referencia el total
($4.000.000) no sale de multiplicar los $35.000/ml del tarifario: las filas son
"Radier perimetral", "Mano de obra especializada", "Logística y traslado". O sea
el cotizador debe **proponer** una primera fila desde la partida
(`cantidad × precio_base`) y dejar que el usuario **agregue, edite, reordene y
borre** filas libres. Un desglose puramente calculado no reproduce el formato
pedido.

---

## 5. El documento (formato de la imagen de referencia)

**Página 1 — Portada**
Logo Terra Concept + "COTIZACIÓN N° 00005" · foto de la línea a sangre ·
título `INSTALACIÓN DE {LÍNEA}` con bajada · bloque "Transformamos espacios
exteriores en experiencias que perduran" · 4 atributos con ícono (Materiales
premium · Instalación experta · Durabilidad garantizada · Diseño que integra) ·
pie `TERRACONCEPT.CL`

**Página 2 — Alcance**
`¿QUÉ INCLUYE NUESTRA INSTALACIÓN?` — bullets `incluye` de la partida, con ícono
en círculo · `¿QUÉ NO INCLUYE?` — bullets `no_incluye`, con ícono ✕ · nota al
pie sobre valores referenciales y visita técnica.

**Página 3 — Presupuesto**
Ficha en 2 columnas (Cliente / Fecha · Proyecto / Validez · Dirección / Plazo) ·
tabla `DESGLOSE DE INSTALACIÓN` con columna `VALOR (CLP)` · bloque de cierre en
tres líneas — `NETO` · `IVA 19%` · `TOTAL` — con el TOTAL destacado ·
avisos de Visita Técnica y Nota Importante · cierre "GRACIAS POR CONFIAR EN
TERRA CONCEPT" · pie con `+56 9 3616 4525`, `ventas@terraconcept.cl`,
`terraconcept.cl`.

**Página 4 — sólo si desborda.** Si el desglose pasa de ~12 filas o las
condiciones generales no caben, la tabla continúa en una cuarta página con
encabezado repetido. Se implementa con `break-inside: avoid` por fila y un
control de alto, no con un salto fijo.

**Íconos:** SVG inline en el HTML. Nada de icon fonts ni CDN de íconos — deben
sobrevivir al render de PDF y a un visor offline.

**Mapeo imagen → partida** (4 fotos entregadas, 12 partidas):

| Foto del ZIP | Familia | Partidas |
|---|---|---|
| `2_...0001.jpg` (piscina) | Piscinas | 6, 9 |
| `4_...0003.jpg` (pastelones grandes) | Pastelones / Terrazas | 2, 3, 4, 5a, 5b, 7, 8 |
| `3_...0002.jpg` (camino adoquinado) | Adoquines | 1 |
| `1_...0000.jpg` (muro fachaletas) | Fachaletas | 10, 11 |

La foto es un campo por partida en `lineas.imagen`, así que después se puede
diferenciar sin tocar código.

---

## 6. Fases de trabajo

> **Estado al 7 de agosto de 2026:** Fases 0 a 5 ✅ hechas. Siguientes: 6 y 7.
> Pendiente del usuario: rotar la contraseña de la DB.

### Fase 0 — Decisiones ✅ resueltas (§8)

### Fase 1 — Base de datos + autenticación ✅
1. `01_schema.sql`: tablas, secuencia desde 5, índices, `updated_at` por trigger.
2. `02_seed_tarifario.sql`: las 12 partidas + ~180 bullets + 9 condiciones
   generales, transcritos del DOCX.
   *Ojo:* la partida 3 dice "Todo lo indicado en la partida anterior" — en la DB
   se expande explícitamente, porque en el PDF esa frase no se entiende sola.
3. `03_policies.sql`: RLS activo en todas las tablas, todas las políticas
   condicionadas a `auth.uid() is not null`. Sin sesión no se lee ni se escribe
   nada.
4. Supabase Auth: email + contraseña, **registro público deshabilitado** — los
   usuarios se crean a mano desde el panel. Pantalla de login delante de toda la
   app, con cierre de sesión.
5. Verificar contra el proyecto `tguoquizfjcalrqvxqey`.

### Fase 2 — Assets ✅
Las 4 fotos quedaron en `images/cotizador/` con nombres semánticos
(`piscina.jpg`, `pastelones.jpg`, `adoquines.jpg`, `fachaletas.jpg`),
redimensionadas a 1200 px de ancho y recomprimidas: **5,0 MB → 915 KB**.

### Fase 3 — Plantilla del documento ✅
`cotizador/documento.css` + `cotizador/preview.html` con los datos de la imagen
de referencia. Validado renderizando a PDF con Chrome headless: **3 páginas,
A4 exacto (210 × 297 mm)**.

El alto de fila de la página de alcance está calibrado contra la partida más
larga del tarifario —Adoquines, 10 incluye + 8 no incluye— para que las 18 filas
más la nota al pie quepan en una sola página. Si se toca ese espaciado, hay que
revalidar ese caso.

### Fase 4 — App de generación ✅
`cotizador/index.html` + `app.js` + `ui.css` + `config.js`. Login de Supabase
Auth delante de todo, selector de las 12 partidas, formulario con validación del
mínimo del tarifario, desglose editable, cálculo de neto/IVA/total, vista previa
en vivo del documento y guardado en Supabase con snapshot.

Verificado extremo a extremo contra la base real: login, carga del catálogo,
propuesta automática de la primera fila (40 ml × $35.000 = $1.400.000), alerta de
mínimo, desglose de la cotización de referencia ($4.000.000 neto → $4.760.000
con IVA), guardado con correlativo **00005**, re-guardado que actualiza sin
consumir número, y segunda cotización que toma **00006**. Datos de prueba
borrados y secuencia devuelta a 5.

### Fase 5 — Consulta y edición ✅
Vista "Cotizaciones" con navegación en la barra superior. Listado ordenado por
número descendente, búsqueda en vivo por número, cliente o proyecto, filtro por
estado y píldora de color por estado.

Acciones por fila: **Abrir** (carga la cotización completa en el editor y la
actualiza sin consumir número), **Duplicar** (suelta id y número; al guardar la
DB asigna el siguiente correlativo y reutiliza el cliente en vez de duplicarlo) y
**Anular** (cambia el estado; nunca se borra, para no dejar huecos en el
correlativo — el botón desaparece si ya está anulada).

Verificado contra la base real con 4 cotizaciones de prueba: búsqueda por los
tres campos, filtro por estado, edición que persiste y conserva el número,
duplicado que pasó de 00006 a 00008 reutilizando el cliente, y anulación.
Todo borrado después y la secuencia devuelta a 5.

### Fase 6 — PDF ✅
`@media print` + `@page { size: A4 portrait; margin: 0 }`. El botón PDF dispara
`window.print()`; el CSS de impresión oculta barra, panel y listado, y anula el
escalado de la vista previa. El nombre sugerido del archivo sale del `<title>`:
`Cotizacion-00005-Kirk-Donoso`.

Verificado imprimiendo la estructura completa de la app a PDF: salen **3 hojas
A4 exactas (210 × 297 mm) sin una sola cadena de la interfaz**.

### Fase 7 — Publicación ✅ (falta el push)
`noindex, nofollow` en el `<head>` del cotizador · `robots.txt` · `_headers` de
Netlify con `X-Robots-Tag: noindex, nofollow, noarchive` para `/cotizador/*` ·
verificado que `index.html` y las imágenes del sitio no tienen ningún cambio
respecto a `origin/main`.

**Decisión que se apartó del plan original:** el plan decía `robots.txt` con
`Disallow: /cotizador/`. No se hizo así. Un `Disallow` impide el rastreo, y sin
rastreo el buscador nunca lee la etiqueta `noindex` — la URL puede terminar
indexada igual si alguien la enlaza. La combinación efectiva es dejar rastrear y
responder `noindex`, que es lo implementado.

Falta sólo el push a `main`, que **requiere confirmación explícita en el chat**
porque publica en producción.

---

## 7. Pruebas

- Cada fase se prueba localmente y se muestra antes de avanzar.
- El PDF se compara contra la imagen de referencia página por página.
- Se prueban los tres tipos de unidad (m², ml, unidad) y el caso de desborde a
  4 páginas.
- Se verifica que el correlativo no se salte ni se repita con dos cotizaciones
  creadas seguidas.
- No hay tests automatizados en este proyecto y este plan no los introduce.

---

## 8. Decisiones tomadas

| | Decisión |
|---|---|
| **A. Autenticación** | Supabase Auth **desde el inicio**. RLS contra `auth.uid()` desde la Fase 1; nunca hay una ventana con la DB abierta. |
| **B. IVA en el PDF** | Se muestran las tres líneas: **NETO · IVA 19 % · TOTAL**, con el TOTAL destacado. Se aparta levemente de la referencia, que sólo trae `TOTAL NETO`. |
| **C. Descarga del PDF** | **CSS de impresión** + `window.print()`. Fidelidad exacta, texto seleccionable, sin dependencias. |
| **D. Correlativo** | Relleno a **5 dígitos** → `00005`. Arranca en 5. |

---

## 9. Fuera de alcance

Envío de la cotización por correo desde la app · firma electrónica · integración
con SII o facturación · conversión automática UF/CLP · portal para que el cliente
vea su cotización · multiusuario con roles diferenciados. Todo esto es abordable
después; ninguno está considerado en las fases de arriba.
