// ============================================================================
// Terra Concept — Cotizador
// app.js — sesión, formulario, cálculo, render del documento y guardado.
//
// Sin build ni framework, igual que el resto del proyecto: ES module cargado
// directo por el navegador, cliente de Supabase desde CDN.
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const cat = {
  lineas: [],        // tarifario con sus bullets
  parametros: {},    // clave -> valor
  condiciones: [],   // condiciones generales
  clientes: [],
};

let cot = nuevaCotizacion();

function nuevaCotizacion() {
  return {
    id: null,
    numero: null,          // lo asigna la DB al guardar
    estado: 'borrador',
    linea: null,
    cantidad: null,
    cliente: { id: null, nombre: '', rut: '', email: '', telefono: '' },
    proyecto: '',
    direccion: '',
    fecha: hoyISO(),
    validez_dias: 7,
    plazo_ejecucion: '',
    detalle: [],
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

function fechaLarga(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
}

// CLP: sin decimales y con punto de miles, como en la cotización de referencia.
function clp(n) {
  return '$ ' + Math.round(n || 0).toLocaleString('es-CL');
}

function folio(n) {
  return n == null ? '—' : String(n).padStart(5, '0');
}

const UNIDAD_ROTULO = { m2: 'm²', ml: 'ml', un: 'unidades' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function mostrarAviso(texto, tipo = '') {
  const el = $('aviso');
  el.textContent = texto || '';
  el.className = 'aviso-ui' + (tipo ? ' ' + tipo : '');
}

function cargando(on) {
  $('cargando').classList.toggle('visible', on);
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('login-error');
  err.textContent = '';
  $('login-btn').disabled = true;

  const { error } = await sb.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-pass').value,
  });

  $('login-btn').disabled = false;
  if (error) {
    err.textContent = error.message === 'Invalid login credentials'
      ? 'Correo o contraseña incorrectos.'
      : error.message;
    return;
  }
  await entrar();
});

$('btn-salir').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

async function entrar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  $('login').style.display = 'none';
  $('app').classList.add('visible');
  $('usuario').textContent = session.user.email;

  cargando(true);
  try {
    await cargarCatalogo();
    reiniciar();
  } catch (e) {
    mostrarAviso('No se pudo cargar el tarifario: ' + e.message, 'error');
  } finally {
    cargando(false);
  }
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
async function cargarCatalogo() {
  const [lineas, items, params, conds, clientes] = await Promise.all([
    sb.from('lineas').select('*').eq('activo', true).order('orden'),
    sb.from('linea_items').select('*').order('orden'),
    sb.from('parametros').select('*'),
    sb.from('condiciones_generales').select('*').eq('activo', true).order('orden'),
    sb.from('clientes').select('*').order('nombre'),
  ]);

  for (const r of [lineas, items, params, conds, clientes]) {
    if (r.error) throw r.error;
  }

  cat.parametros = Object.fromEntries(params.data.map((p) => [p.clave, p.valor]));
  cat.condiciones = conds.data;
  cat.clientes = clientes.data;

  cat.lineas = lineas.data.map((l) => ({
    ...l,
    incluye: items.data.filter((i) => i.linea_id === l.id && i.tipo === 'incluye'),
    no_incluye: items.data.filter((i) => i.linea_id === l.id && i.tipo === 'no_incluye'),
  }));

  // Selector de línea (familia). Manda sobre el de partidas: primero se elige
  // la línea y eso acota el tarifario a lo que corresponde.
  const familias = [...new Set(cat.lineas.map((l) => l.familia))];
  const selFam = $('f-familia');
  selFam.innerHTML = '<option value="">Seleccionar…</option>';
  for (const f of familias) {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    selFam.appendChild(o);
  }

  pintarPartidas('');

  pintarClientesConocidos();
}

// Deja en el selector de partidas sólo las de la línea elegida.
function pintarPartidas(familia) {
  const sel = $('f-linea');
  const dela = familia ? cat.lineas.filter((l) => l.familia === familia) : [];

  sel.innerHTML = familia
    ? '<option value="">Seleccionar…</option>'
    : '<option value="">Elegir una línea primero…</option>';

  for (const l of dela) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.subtitulo ? `${l.nombre} — ${l.subtitulo}` : l.nombre;
    sel.appendChild(o);
  }
  sel.disabled = !familia;
}

// Autocompletado del campo Cliente. Se repinta al crear uno nuevo, para que
// quede disponible de inmediato sin recargar la página.
function pintarClientesConocidos() {
  $('clientes-conocidos').innerHTML =
    cat.clientes.map((c) => `<option value="${esc(c.nombre)}">`).join('');
}

function reiniciar() {
  cot = nuevaCotizacion();
  cot.validez_dias = Number(cat.parametros.validez_dias ?? 7);
  cot.plazo_ejecucion = cat.parametros.plazo_ejecucion_default ?? '';

  $('f-familia').value = '';
  pintarPartidas('');
  $('f-linea').value = '';
  $('f-cantidad').value = '';
  $('f-cliente').value = '';
  $('f-rut').value = '';
  $('f-email').value = '';
  $('f-telefono').value = '';
  $('f-proyecto').value = '';
  $('f-direccion').value = '';
  $('f-fecha').value = cot.fecha;
  $('f-validez').value = cot.validez_dias;
  $('f-plazo').value = cot.plazo_ejecucion;
  $('pista-linea').textContent = '';
  $('pista-minimo').textContent = '';
  $('rotulo-unidad').textContent = '';

  bloquearEstado(true);
  mostrarAviso('');
  pintarFilas();
  render();
}

// Toda cotización nueva parte como borrador y el estado queda bloqueado. Sólo
// se libera al abrir una ya guardada, que es cuando cambiar de estado tiene
// sentido: enviada, aceptada, rechazada.
function bloquearEstado(bloquear) {
  $('f-estado').value = cot.estado;
  $('f-estado').disabled = bloquear;
  $('pista-estado').textContent = bloquear
    ? 'Toda cotización nueva parte como borrador. El estado se puede cambiar una vez guardada.'
    : '';
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------
$('f-linea').addEventListener('change', () => {
  const id = Number($('f-linea').value);
  cot.linea = cat.lineas.find((l) => l.id === id) || null;

  if (cot.linea) {
    const u = UNIDAD_ROTULO[cot.linea.unidad];
    $('rotulo-unidad').textContent = `(${u})`;
    $('pista-linea').textContent =
      `${clp(cot.linea.precio_base)} por ${u} · mínimo ${Number(cot.linea.minimo)} ${u}`;
    if (!cot.proyecto) {
      cot.proyecto = cot.linea.nombre;
      $('f-proyecto').value = cot.proyecto;
    }
    proponerDetalle();
  } else {
    $('rotulo-unidad').textContent = '';
    $('pista-linea').textContent = '';
  }
  validarMinimo();
  pintarFilas();
  render();
});

$('f-estado').addEventListener('change', () => { cot.estado = $('f-estado').value; });

$('f-familia').addEventListener('change', () => {
  pintarPartidas($('f-familia').value);
  // Cambiar de línea invalida la partida elegida y su fila propuesta.
  cot.linea = null;
  cot.detalle = cot.detalle.filter((d) => !d._auto);
  $('f-linea').value = '';
  $('pista-linea').textContent = '';
  $('pista-minimo').textContent = '';
  $('rotulo-unidad').textContent = '';
  pintarFilas();
  render();
});

$('f-cantidad').addEventListener('input', () => {
  cot.cantidad = $('f-cantidad').value === '' ? null : Number($('f-cantidad').value);
  proponerDetalle();
  validarMinimo();
  pintarFilas();
  render();
});

// Cantidad que se cobra. El mínimo de la partida no es un tope que bloquee:
// si el cliente pide 5 m² y el mínimo son 28, el detalle registra los 5 m²
// reales pero se cobran los 28. Nunca se cobra menos que el mínimo.
function cantidadCobrada() {
  if (!cot.linea || !cot.cantidad) return 0;
  return Math.max(Number(cot.cantidad), Number(cot.linea.minimo));
}

// La primera fila del desglose se propone desde el tarifario. Queda editable:
// en la cotización de referencia el total no sale de multiplicar el precio base,
// sino de partidas propias (radier, mano de obra, logística).
function proponerDetalle() {
  if (!cot.linea || !cot.cantidad) return;
  const propuesta = {
    descripcion: cot.linea.nombre,
    cantidad: cot.cantidad,                 // lo que realmente se instala
    unidad: cot.linea.unidad,
    precio_unitario: cot.linea.precio_base,
    valor: Math.round(cantidadCobrada() * cot.linea.precio_base),
    _auto: true,
  };
  const i = cot.detalle.findIndex((d) => d._auto);
  if (i >= 0) cot.detalle[i] = propuesta;
  else cot.detalle.unshift(propuesta);
}

// Informa cuando se está aplicando el mínimo. No es un error: es cómo se cobra.
function validarMinimo() {
  const el = $('pista-minimo');
  el.className = 'pista';
  if (!cot.linea || !cot.cantidad) { el.textContent = ''; return; }

  const min = Number(cot.linea.minimo);
  const u = UNIDAD_ROTULO[cot.linea.unidad];
  if (Number(cot.cantidad) < min) {
    el.textContent = `Se instalan ${cot.cantidad} ${u}, pero se cobra el mínimo de `
      + `${min} ${u} = ${clp(min * cot.linea.precio_base)}.`;
  } else {
    el.textContent = '';
  }
}

for (const [id, campo] of Object.entries({
  'f-cliente': 'cliente.nombre', 'f-rut': 'cliente.rut',
  'f-email': 'cliente.email', 'f-telefono': 'cliente.telefono',
  'f-proyecto': 'proyecto', 'f-direccion': 'direccion',
  'f-fecha': 'fecha', 'f-validez': 'validez_dias', 'f-plazo': 'plazo_ejecucion',
})) {
  $(id).addEventListener('input', (e) => {
    const v = e.target.value;
    if (campo.startsWith('cliente.')) cot.cliente[campo.split('.')[1]] = v;
    else cot[campo] = campo === 'validez_dias' ? Number(v) : v;

    // Si el nombre coincide con un cliente ya registrado, se rellena el resto.
    if (id === 'f-cliente') {
      const c = cat.clientes.find((x) => x.nombre.toLowerCase() === v.trim().toLowerCase());
      if (c) {
        cot.cliente = { id: c.id, nombre: c.nombre, rut: c.rut || '', email: c.email || '', telefono: c.telefono || '' };
        $('f-rut').value = cot.cliente.rut;
        $('f-email').value = cot.cliente.email;
        $('f-telefono').value = cot.cliente.telefono;
      } else {
        cot.cliente.id = null;
      }
    }
    render();
  });
}

// ---------------------------------------------------------------------------
// Desglose editable
// ---------------------------------------------------------------------------
$('btn-agregar').addEventListener('click', () => {
  cot.detalle.push({ descripcion: '', cantidad: null, unidad: null, precio_unitario: null, valor: 0 });
  pintarFilas();
  render();
});

function pintarFilas() {
  const cont = $('filas');
  cont.innerHTML = '';

  cot.detalle.forEach((d, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.innerHTML = `
      <input type="text"   value="${esc(d.descripcion)}" placeholder="Descripción" data-c="descripcion">
      <input type="number" class="num" value="${d.cantidad ?? ''}" placeholder="—" step="0.01" data-c="cantidad">
      <input type="number" class="num" value="${d.precio_unitario ?? ''}" placeholder="—" step="1" data-c="precio_unitario">
      <input type="number" class="num" value="${d.valor ?? 0}" placeholder="0" step="1" data-c="valor">
      <button class="fila-quitar" title="Quitar fila">×</button>`;

    const inputValor = fila.querySelector('[data-c="valor"]');

    fila.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const c = inp.dataset.c;
        // Editar cualquier campo a mano desengancha la fila de la propuesta
        // automática, para no pisar lo que escribió el usuario.
        d._auto = false;

        if (c === 'descripcion') {
          d.descripcion = inp.value;
        } else if (c === 'valor') {
          // Escribir el valor a mano manda: hay filas sin cantidad ni precio
          // unitario que tengan sentido, como "Logística y traslado".
          d.valor = Number(inp.value || 0);
        } else {
          d[c] = inp.value === '' ? null : Number(inp.value);
          // Con cantidad y precio unitario, el valor se calcula solo.
          if (d.cantidad != null && d.precio_unitario != null) {
            d.valor = Math.round(d.cantidad * d.precio_unitario);
            inputValor.value = d.valor;
          }
        }
        recalcular();
        render();
      });
    });

    fila.querySelector('.fila-quitar').addEventListener('click', () => {
      cot.detalle.splice(i, 1);
      pintarFilas();
      render();
    });

    cont.appendChild(fila);
  });

  recalcular();
}

// Las cotizaciones van sólo en valor neto: sin IVA.
function totales() {
  const neto = cot.detalle.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  return { neto, total: neto };
}

function recalcular() {
  $('r-total').textContent = clp(totales().total);
}

// ---------------------------------------------------------------------------
// Render del documento
// ---------------------------------------------------------------------------
// Logo oficial del sitio, no una reconstrucción: así el documento y la web
// muestran exactamente la misma marca.
const MARCA = `<img class="marca-logo" src="../images/logo_terraconcept.png"
  alt="Terra Concept — Soluciones para exteriores">`;

const ICONO_CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const ICONO_EQUIS = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const ICONO_INFO  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';

function cabecera() {
  return `<header class="doc-header">
    ${MARCA}
    <div class="folio">
      <div class="folio-rotulo">COTIZACIÓN N°</div>
      <div class="folio-numero">${folio(cot.numero)}</div>
    </div>
  </header>`;
}

function pie(conContacto = false) {
  if (!conContacto) {
    return `<footer class="doc-footer">${esc((cat.parametros.empresa_web ?? 'terraconcept.cl').toUpperCase())}</footer>`;
  }
  return `<footer class="doc-footer">
    <div class="doc-footer-contacto">
      <span><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/></svg>${esc(cat.parametros.empresa_telefono ?? '')}</span>
      <span><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/></svg>${esc(cat.parametros.empresa_email ?? '')}</span>
      <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>${esc(cat.parametros.empresa_web ?? '')}</span>
    </div>
  </footer>`;
}

function atributo(n, svg) {
  return `<div class="atributo">
    <div class="atributo-icono">${svg}</div>
    <div>
      <div class="atributo-titulo">${esc(cat.parametros[`atributo_${n}_titulo`] ?? '')}</div>
      <div class="atributo-texto">${esc(cat.parametros[`atributo_${n}_texto`] ?? '')}</div>
    </div>
  </div>`;
}

function paginaPortada() {
  const l = cot.linea;
  const img = l?.imagen ? `../images/cotizador/${l.imagen}` : '';
  return `<section class="pagina">
    ${cabecera()}
    <div class="pagina-cuerpo portada">
      <div class="portada-hero">
        ${img ? `<img src="${img}" alt="${esc(l.nombre)}">` : ''}
        <div class="portada-hero-texto">
          <div class="portada-hero-rotulo">INSTALACIÓN DE</div>
          <div class="portada-hero-titulo">${esc(l?.titulo_portada ?? '—')}</div>
          <div class="portada-hero-bajada">${esc(l?.bajada_portada ?? '')}</div>
        </div>
      </div>
      <div class="portada-inferior">
        <div>
          <p class="portada-titular">${esc(cat.parametros.portada_titular ?? '')}</p>
          <p class="portada-parrafo">${esc(cat.parametros.portada_parrafo ?? '')}</p>
        </div>
        <div class="atributos">
          ${atributo(1, '<svg viewBox="0 0 24 24"><path d="M12 3l4 5-4 13-4-13 4-5z"/><path d="M8 8h8"/></svg>')}
          ${atributo(2, '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>')}
          ${atributo(3, '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>')}
          ${atributo(4, '<svg viewBox="0 0 24 24"><path d="M19 5c0 8-5 13-13 14 0-8 5-13 13-14z"/><path d="M6 19c3-3 5-5 9-7"/></svg>')}
        </div>
      </div>
    </div>
    ${pie()}
  </section>`;
}

function paginaAlcance() {
  const l = cot.linea;
  const bloque = (titulo, items, negativo) => `
    <div class="alcance-bloque">
      <h2 class="seccion-titulo">${titulo}</h2>
      <div class="seccion-regla"></div>
      <div class="items">
        ${items.map((i) => `
          <div class="item">
            <div class="item-icono${negativo ? ' es-negativo' : ''}">${negativo ? ICONO_EQUIS : ICONO_CHECK}</div>
            <div class="item-texto">${esc(i.texto)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  return `<section class="pagina">
    ${cabecera()}
    <div class="pagina-cuerpo alcance">
      ${bloque('¿QUÉ INCLUYE NUESTRA INSTALACIÓN?', l?.incluye ?? [], false)}
      ${bloque('¿QUÉ NO INCLUYE?', l?.no_incluye ?? [], true)}
      <div class="nota-pie">
        <div class="item-icono">${ICONO_INFO}</div>
        <p>${esc(cat.parametros.nota_alcance ?? '')}</p>
      </div>
    </div>
    ${pie()}
  </section>`;
}

function paginaPresupuesto() {
  const t = totales();
  const campo = (rotulo, valor) =>
    `<div><div class="ficha-campo-rotulo">${rotulo}</div><div class="ficha-campo-valor">${esc(valor || '—')}</div></div>`;

  return `<section class="pagina">
    ${cabecera()}
    <div class="pagina-cuerpo presupuesto">
      <h2 class="seccion-titulo">PRESUPUESTO</h2>
      <div class="seccion-regla"></div>

      <div class="ficha">
        ${campo('Cliente:', cot.cliente.nombre)}
        ${campo('Fecha:', fechaLarga(cot.fecha))}
        ${campo('Proyecto:', cot.proyecto)}
        ${campo('Validez de la propuesta:', cot.validez_dias ? `${cot.validez_dias} días` : '')}
        ${campo('Dirección:', cot.direccion)}
        ${campo('Plazo de ejecución:', cot.plazo_ejecucion)}
      </div>

      <table class="desglose">
        <thead><tr><th>DESGLOSE DE INSTALACIÓN</th><th>VALOR (CLP)</th></tr></thead>
        <tbody>
          ${cot.detalle.length
            ? cot.detalle.map((d) => `<tr><td>${esc(d.descripcion || '—')}</td><td>${clp(d.valor)}</td></tr>`).join('')
            : '<tr><td>—</td><td>$ 0</td></tr>'}
        </tbody>
      </table>

      <div class="totales">
        <div class="totales-fila es-total">
          <span class="totales-rotulo">TOTAL NETO</span><span class="totales-monto">${clp(t.total)}</span>
        </div>
        <p class="totales-glosa">${esc(cat.parametros.nota_valores ?? '')}</p>
      </div>

      <div class="avisos">
        <div class="aviso">
          <div class="item-icono"><svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M4 20h16"/><path d="M10 20v-5h4v5"/></svg></div>
          <div>
            <div class="aviso-titulo">VISITA TÉCNICA</div>
            <div class="aviso-texto">${esc(cat.parametros.nota_visita_tecnica ?? '')}</div>
          </div>
        </div>
        <div class="aviso">
          <div class="item-icono"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg></div>
          <div>
            <div class="aviso-titulo">NOTA IMPORTANTE</div>
            <div class="aviso-texto">${esc(cat.parametros.nota_importante ?? '')}</div>
          </div>
        </div>
      </div>

      <div class="cierre">${esc(cat.parametros.cierre_documento ?? '').replace(' EN ', ' EN<br>')}</div>
    </div>
    ${pie(true)}
  </section>`;
}

function render() {
  $('doc').innerHTML = paginaPortada() + paginaAlcance() + paginaPresupuesto();
  document.title = cot.numero
    ? `Cotizacion-${folio(cot.numero)}-${(cot.cliente.nombre || 'sin-cliente').replace(/\s+/g, '-')}`
    : 'Cotizador — Terra Concept';
  ajustarEscala();
}

// La hoja mide 210 mm; el lienzo casi nunca. Se escala para que quepa entera.
function ajustarEscala() {
  const lienzo = $('lienzo');
  const interno = $('lienzo-interno');
  const anchoHoja = interno.firstElementChild?.firstElementChild?.offsetWidth || 794;
  const disponible = lienzo.clientWidth - 44;
  const escala = Math.min(1, disponible / anchoHoja);
  interno.style.transform = `scale(${escala})`;
  interno.style.height = escala < 1 ? `${interno.scrollHeight * escala}px` : '';
}
window.addEventListener('resize', ajustarEscala);

// ---------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------
$('btn-guardar').addEventListener('click', guardar);

async function guardar() {
  if (!cot.linea) return mostrarAviso('Falta elegir la partida del tarifario.', 'error');
  if (!cot.cliente.nombre.trim()) return mostrarAviso('Falta el nombre del cliente.', 'error');
  if (!cot.detalle.length) return mostrarAviso('El desglose no puede ir vacío.', 'error');

  cargando(true);
  try {
    // 1. Cliente: se reutiliza si ya existe, si no se crea.
    let clienteId = cot.cliente.id;
    if (!clienteId) {
      const { data, error } = await sb.from('clientes').insert({
        nombre: cot.cliente.nombre.trim(),
        rut: cot.cliente.rut || null,
        email: cot.cliente.email || null,
        telefono: cot.cliente.telefono || null,
        direccion: cot.direccion || null,
      }).select().single();
      if (error) throw error;
      clienteId = data.id;
      cot.cliente.id = data.id;
      cat.clientes.push(data);
      pintarClientesConocidos();
    }

    const t = totales();

    // 2. Snapshot: congela el texto de la partida y las condiciones generales.
    //    Si mañana sube el tarifario, esta cotización se sigue reimprimiendo
    //    exactamente como se envió.
    const snapshot = {
      linea: {
        codigo: cot.linea.codigo, nombre: cot.linea.nombre, subtitulo: cot.linea.subtitulo,
        familia: cot.linea.familia, unidad: cot.linea.unidad,
        precio_base: cot.linea.precio_base, minimo: cot.linea.minimo,
        titulo_portada: cot.linea.titulo_portada, bajada_portada: cot.linea.bajada_portada,
        imagen: cot.linea.imagen,
      },
      incluye: cot.linea.incluye.map((i) => i.texto),
      no_incluye: cot.linea.no_incluye.map((i) => i.texto),
      condiciones: cat.condiciones.map((c) => c.texto),
      parametros: cat.parametros,
      cantidad: cot.cantidad,
      congelado_en: new Date().toISOString(),
    };

    const fila = {
      cliente_id: clienteId,
      linea_id: cot.linea.id,
      estado: cot.estado,
      proyecto: cot.proyecto || null,
      direccion: cot.direccion || null,
      fecha: cot.fecha,
      validez_dias: cot.validez_dias,
      plazo_ejecucion: cot.plazo_ejecucion || null,
      neto: t.neto,
      total: t.total,
      snapshot,
    };

    // 3. Cabecera. El correlativo lo pone la DB (secuencia desde 5), nunca el
    //    navegador: así dos cotizaciones simultáneas no chocan.
    let cotizacionId;
    if (cot.id) {
      const { data, error } = await sb.from('cotizaciones')
        .update(fila).eq('id', cot.id).select().single();
      if (error) throw error;
      cotizacionId = data.id;
      cot.numero = data.numero;
      await sb.from('cotizacion_detalle').delete().eq('cotizacion_id', cotizacionId);
    } else {
      const { data, error } = await sb.from('cotizaciones').insert(fila).select().single();
      if (error) throw error;
      cotizacionId = data.id;
      cot.id = data.id;
      cot.numero = data.numero;
      // Ya guardada: recién ahora tiene sentido poder cambiarle el estado.
      bloquearEstado(false);
    }

    // 4. Detalle
    const { error: errDet } = await sb.from('cotizacion_detalle').insert(
      cot.detalle.map((d, i) => ({
        cotizacion_id: cotizacionId,
        descripcion: d.descripcion || '—',
        cantidad: d.cantidad,
        unidad: d.unidad,
        precio_unitario: d.precio_unitario,
        valor: Math.round(Number(d.valor) || 0),
        orden: i,
      })));
    if (errDet) throw errDet;

    mostrarAviso(`Cotización ${folio(cot.numero)} guardada.`, 'ok');
    render();
  } catch (e) {
    mostrarAviso('No se pudo guardar: ' + (e.message || e), 'error');
  } finally {
    cargando(false);
  }
}

// ---------------------------------------------------------------------------
// PDF y reinicio
// ---------------------------------------------------------------------------
$('btn-pdf').addEventListener('click', () => {
  if (!cot.linea) return mostrarAviso('Falta elegir la partida antes de generar el PDF.', 'error');
  window.print();
});

// ---------------------------------------------------------------------------
// Compartir el PDF (WhatsApp, correo, lo que ofrezca el sistema)
//
// `window.print()` no entrega un archivo: abre el diálogo del navegador. Para
// poder compartir hace falta un PDF de verdad, así que aquí se genera uno en el
// dispositivo y se entrega al menú nativo de compartir.
//
// El costo es que este PDF va rasterizado (texto no seleccionable, más pesado)
// frente al de impresión, que es vectorial. Por eso conviven los dos botones:
// "PDF" para el camino bueno en escritorio, "Compartir" para el teléfono.
// ---------------------------------------------------------------------------
const puedeCompartirArchivos = typeof navigator.canShare === 'function';
$('acciones-compartir').hidden = !puedeCompartirArchivos;

function nombreArchivo() {
  const quien = (cot.cliente.nombre || 'sin-cliente').trim().replace(/\s+/g, '-');
  return `Cotizacion-${folio(cot.numero)}-${quien}.pdf`;
}

// Se arma hoja por hoja en vez de dejar que la librería pagine sola: cada
// `.pagina` ya mide exactamente una A4, así que el corte queda donde debe.
//
// Se usan jsPDF y html2canvas por separado y no html2pdf.js, cuyo build ESM
// está roto en el CDN ("Cannot set properties of undefined (setting
// 'getPageSize')"). Se importan sólo al pedir compartir, para no cargarlos en
// cada visita.
async function generarPDF() {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm'),
    import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm').then((m) => m.default),
  ]);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const paginas = $('doc').querySelectorAll('.pagina');

  for (let i = 0; i < paginas.length; i++) {
    const canvas = await html2canvas(paginas[i], {
      scale: 2, useCORS: true, backgroundColor: '#faf9f6', logging: false,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
  }
  return pdf.output('blob');
}

$('btn-compartir').addEventListener('click', async () => {
  if (!cot.linea) return mostrarAviso('Falta elegir la partida antes de compartir.', 'error');

  cargando(true);
  try {
    const blob = await generarPDF();
    const archivo = new File([blob], nombreArchivo(), { type: 'application/pdf' });

    if (navigator.canShare({ files: [archivo] })) {
      await navigator.share({
        files: [archivo],
        title: `Cotización ${folio(cot.numero)}`,
        text: `Cotización ${folio(cot.numero)} — Terra Concept`,
      });
      mostrarAviso('');
    } else {
      // El dispositivo no comparte archivos: al menos se lo descarga.
      descargarBlob(blob, nombreArchivo());
      mostrarAviso('Este dispositivo no permite compartir archivos. El PDF se descargó.', '');
    }
  } catch (e) {
    // Cancelar el menú de compartir lanza AbortError: no es un fallo.
    if (e && e.name === 'AbortError') return;
    mostrarAviso('No se pudo generar el PDF para compartir: ' + (e.message || e), 'error');
  } finally {
    cargando(false);
  }
});

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

$('btn-nueva').addEventListener('click', () => {
  if (cot.id && !confirm('¿Empezar una cotización nueva? Los cambios sin guardar se pierden.')) return;
  reiniciar();
});

// ===========================================================================
// Listado, consulta y edición
// ===========================================================================
let cotizacionesCache = [];

function verVista(cual) {
  const esListado = cual === 'listado';
  $('vista-editor').hidden = esListado;
  $('vista-listado').hidden = !esListado;
  $('nav-editor').classList.toggle('activo', !esListado);
  $('nav-listado').classList.toggle('activo', esListado);
  if (esListado) cargarListado();
  else ajustarEscala();
}

$('nav-editor').addEventListener('click', () => verVista('editor'));
$('nav-listado').addEventListener('click', () => verVista('listado'));
$('l-refrescar').addEventListener('click', cargarListado);
$('l-buscar').addEventListener('input', pintarListado);
$('l-estado').addEventListener('change', pintarListado);

async function cargarListado() {
  const aviso = $('l-aviso');
  aviso.textContent = '';
  aviso.className = 'aviso-ui';

  const { data, error } = await sb
    .from('cotizaciones')
    .select('id, numero, fecha, estado, total, proyecto, direccion, cliente_id, linea_id, clientes(nombre)')
    .order('numero', { ascending: false });

  if (error) {
    aviso.textContent = 'No se pudo cargar el listado: ' + error.message;
    aviso.className = 'aviso-ui error';
    return;
  }
  cotizacionesCache = data;
  pintarListado();
}

function pintarListado() {
  const q = $('l-buscar').value.trim().toLowerCase();
  const filtroEstado = $('l-estado').value;

  const filtradas = cotizacionesCache.filter((c) => {
    if (filtroEstado && c.estado !== filtroEstado) return false;
    if (!q) return true;
    return [folio(c.numero), c.clientes?.nombre, c.proyecto]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  $('l-vacio').style.display = filtradas.length ? 'none' : 'block';
  $('l-vacio').textContent = cotizacionesCache.length
    ? 'Ninguna cotización coincide con la búsqueda.'
    : 'No hay cotizaciones todavía.';

  const tbody = $('l-filas');
  tbody.innerHTML = '';

  for (const c of filtradas) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num">${folio(c.numero)}</td>
      <td>${esc(c.clientes?.nombre ?? '—')}</td>
      <td>${esc(c.proyecto ?? '—')}</td>
      <td>${esc(fechaLarga(c.fecha))}</td>
      <td class="der">${clp(c.total)}</td>
      <td><span class="pildora ${c.estado}">${c.estado}</span></td>
      <td>
        <div class="acciones-fila">
          <button class="btn suave chico" data-a="abrir">Abrir</button>
          <button class="btn suave chico" data-a="duplicar">Duplicar</button>
          ${c.estado !== 'anulada' ? '<button class="btn suave chico" data-a="anular">Anular</button>' : ''}
        </div>
      </td>`;

    tr.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.a === 'abrir') abrirCotizacion(c.id, false);
        else if (b.dataset.a === 'duplicar') abrirCotizacion(c.id, true);
        else anularCotizacion(c);
      });
    });

    tbody.appendChild(tr);
  }
}

// Las cotizaciones nunca se borran: se pasan a `anulada`. Borrarlas dejaría
// huecos en el correlativo, que es justo lo que el correlativo debe evitar.
async function anularCotizacion(c) {
  if (!confirm(`¿Anular la cotización ${folio(c.numero)}? Queda en el historial, pero marcada como anulada.`)) return;
  cargando(true);
  const { error } = await sb.from('cotizaciones').update({ estado: 'anulada' }).eq('id', c.id);
  cargando(false);
  if (error) {
    $('l-aviso').textContent = 'No se pudo anular: ' + error.message;
    $('l-aviso').className = 'aviso-ui error';
    return;
  }
  await cargarListado();
}

async function abrirCotizacion(id, duplicar) {
  cargando(true);
  try {
    const [cab, det] = await Promise.all([
      sb.from('cotizaciones').select('*, clientes(*)').eq('id', id).single(),
      sb.from('cotizacion_detalle').select('*').eq('cotizacion_id', id).order('orden'),
    ]);
    if (cab.error) throw cab.error;
    if (det.error) throw det.error;

    const c = cab.data;
    cot = nuevaCotizacion();

    // Al duplicar se suelta el id y el número: se guarda como una cotización
    // nueva y la DB le asigna el siguiente correlativo.
    cot.id = duplicar ? null : c.id;
    cot.numero = duplicar ? null : c.numero;
    cot.estado = duplicar ? 'borrador' : c.estado;

    cot.linea = cat.lineas.find((l) => l.id === c.linea_id) || null;
    cot.cantidad = c.snapshot?.cantidad ?? null;
    cot.proyecto = c.proyecto ?? '';
    cot.direccion = c.direccion ?? '';
    cot.fecha = duplicar ? hoyISO() : c.fecha;
    cot.validez_dias = c.validez_dias;
    cot.plazo_ejecucion = c.plazo_ejecucion ?? '';

    cot.cliente = c.clientes
      ? { id: duplicar ? c.clientes.id : c.clientes.id, nombre: c.clientes.nombre,
          rut: c.clientes.rut ?? '', email: c.clientes.email ?? '', telefono: c.clientes.telefono ?? '' }
      : { id: null, nombre: '', rut: '', email: '', telefono: '' };

    cot.detalle = det.data.map((d) => ({
      descripcion: d.descripcion, cantidad: d.cantidad, unidad: d.unidad,
      precio_unitario: d.precio_unitario, valor: d.valor, _auto: false,
    }));

    volcarAlFormulario();
    verVista('editor');
    mostrarAviso(
      duplicar
        ? `Copia de la cotización ${folio(c.numero)}. Al guardar tomará un número nuevo.`
        : `Editando la cotización ${folio(c.numero)}.`,
      'ok');
  } catch (e) {
    $('l-aviso').textContent = 'No se pudo abrir: ' + (e.message || e);
    $('l-aviso').className = 'aviso-ui error';
  } finally {
    cargando(false);
  }
}

// Vuelca el estado `cot` a los campos del formulario. Es el camino inverso de
// los listeners de arriba, que van del formulario al estado.
function volcarAlFormulario() {
  // La línea manda sobre el selector de partidas: hay que repintarlo antes de
  // poder seleccionar la partida guardada.
  $('f-familia').value = cot.linea ? cot.linea.familia : '';
  pintarPartidas(cot.linea ? cot.linea.familia : '');
  $('f-linea').value = cot.linea ? cot.linea.id : '';
  $('f-cantidad').value = cot.cantidad ?? '';
  $('f-cliente').value = cot.cliente.nombre;
  $('f-rut').value = cot.cliente.rut;
  $('f-email').value = cot.cliente.email;
  $('f-telefono').value = cot.cliente.telefono;
  $('f-proyecto').value = cot.proyecto;
  $('f-direccion').value = cot.direccion;
  $('f-fecha').value = cot.fecha;
  $('f-validez').value = cot.validez_dias;
  $('f-plazo').value = cot.plazo_ejecucion;

  if (cot.linea) {
    const u = UNIDAD_ROTULO[cot.linea.unidad];
    $('rotulo-unidad').textContent = `(${u})`;
    $('pista-linea').textContent =
      `${clp(cot.linea.precio_base)} por ${u} · mínimo ${Number(cot.linea.minimo)} ${u}`;
  }
  // Una copia arranca de cero como borrador; una cotización ya guardada sí
  // puede cambiar de estado.
  bloquearEstado(cot.id === null);
  validarMinimo();
  pintarFilas();
  render();
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
verVista('editor');
entrar();

// PWA: instalable y utilizable sin conexión. El service worker sirve el código
// por red primero, así que un deploy nuevo llega de inmediato.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin service worker la app funciona igual; sólo pierde el modo offline.
    });
  });
}
