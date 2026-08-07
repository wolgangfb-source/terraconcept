-- ============================================================================
-- Terra Concept — Cotizador
-- 02_seed_tarifario.sql — carga de paramétricas
--
-- Fuente literal: "PROPUESTA ECONOMICA BASE TERRA CONCEPT.docx"
-- 11 partidas → 12 filas (la partida 5 se abre en dos formatos de pastelón).
--
-- Idempotente: reejecutable. Las líneas se actualizan por `codigo`; los bullets
-- se borran y recargan. No borra `lineas` para no romper cotizaciones que ya
-- la referencian (FK on delete restrict).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Las 12 filas del tarifario
-- ---------------------------------------------------------------------------
insert into lineas (codigo, familia, nombre, subtitulo, titulo_portada, bajada_portada, unidad, precio_base, minimo, imagen, orden) values
  ('ADO-01', 'Adoquines',  'Instalación de Adoquines',
   null, 'ADOQUINES', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 28000, 28, 'adoquines.jpg', 10),

  ('PAS-02', 'Pastelones', 'Instalación de Pastelones sobre Radier Existente',
   null, 'PASTELONES', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 12000, 20, 'pastelones.jpg', 20),

  ('PAS-03', 'Pastelones', 'Instalación de Pastelones sobre Radier con Nivelación',
   null, 'PASTELONES', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 16000, 20, 'pastelones.jpg', 30),

  ('PAS-04', 'Pastelones', 'Instalación Completa de Pastelones',
   null, 'PASTELONES', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 25000, 20, 'pastelones.jpg', 40),

  ('PAS-05A', 'Pastelones', 'Instalación de Pastelones por Unidad',
   'Formatos 20×20, 30×30, 40×40 y 50×50', 'PASTELONES', 'Diseño, precisión y durabilidad en cada detalle',
   'un', 14000, 25, 'pastelones.jpg', 50),

  ('PAS-05B', 'Pastelones', 'Instalación de Pastelones por Unidad',
   'Formatos superiores a 50×50 (60×60, 80×80, 100×100, 120×30, 120×40, 120×120 y superiores)',
   'PASTELONES', 'Diseño, precisión y durabilidad en cada detalle',
   'un', 17000, 25, 'pastelones.jpg', 60),

  ('PIS-06', 'Piscinas',   'Instalación de Bordes de Piscina de Hormigón',
   null, 'PISCINA', 'Diseño, precisión y durabilidad en cada detalle',
   'ml', 35000, 15, 'piscina.jpg', 70),

  ('TER-07', 'Terrazas',   'Instalación de Terrazas o Extensiones',
   'Sin radier', 'TERRAZA', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 40000, 20, 'pastelones.jpg', 80),

  ('TER-08', 'Terrazas',   'Instalación de Terrazas sobre Radier Existente',
   null, 'TERRAZA', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 28000, 20, 'pastelones.jpg', 90),

  ('PIS-09', 'Piscinas',   'Instalación de Bordes para Piscina de Fibra',
   null, 'PISCINA', 'Diseño, precisión y durabilidad en cada detalle',
   'ml', 48000, 15, 'piscina.jpg', 100),

  ('FAC-10', 'Fachaletas', 'Instalación de Fachaletas sobre Superficie Plana',
   null, 'FACHALETAS', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 28000, 20, 'fachaletas.jpg', 110),

  ('FAC-11', 'Fachaletas', 'Instalación de Fachaletas sobre Superficie Irregular',
   null, 'FACHALETAS', 'Diseño, precisión y durabilidad en cada detalle',
   'm2', 39000, 20, 'fachaletas.jpg', 120)
on conflict (codigo) do update set
  familia        = excluded.familia,
  nombre         = excluded.nombre,
  subtitulo      = excluded.subtitulo,
  titulo_portada = excluded.titulo_portada,
  bajada_portada = excluded.bajada_portada,
  unidad         = excluded.unidad,
  precio_base    = excluded.precio_base,
  minimo         = excluded.minimo,
  imagen         = excluded.imagen,
  orden          = excluded.orden;

-- ---------------------------------------------------------------------------
-- Bullets de Incluye / No incluye
--
-- Nota sobre PAS-03: el DOCX dice "Todo lo indicado en la partida anterior".
-- Aquí se expande explícitamente — en el PDF esa frase no se entiende sola.
-- ---------------------------------------------------------------------------
delete from linea_items;

insert into linea_items (linea_id, tipo, texto, orden)
select l.id, t.tipo::tipo_item, t.texto, t.orden
from (values
  -- ADO-01 · Adoquines ------------------------------------------------------
  ('ADO-01','incluye','Replanteo y trazado.',1),
  ('ADO-01','incluye','Excavación según requerimiento del proyecto.',2),
  ('ADO-01','incluye','Compactación de subrasante.',3),
  ('ADO-01','incluye','Base estabilizada.',4),
  ('ADO-01','incluye','Cama de arena.',5),
  ('ADO-01','incluye','Instalación de adoquines.',6),
  ('ADO-01','incluye','Cortes simples perimetrales.',7),
  ('ADO-01','incluye','Compactación final.',8),
  ('ADO-01','incluye','Relleno de juntas con arena.',9),
  ('ADO-01','incluye','Limpieza final del área intervenida.',10),
  ('ADO-01','no_incluye','Suministro de adoquines.',1),
  ('ADO-01','no_incluye','Retiro de pavimentos existentes.',2),
  ('ADO-01','no_incluye','Retiro de escombros.',3),
  ('ADO-01','no_incluye','Obras de drenaje.',4),
  ('ADO-01','no_incluye','Soluciones para suelos inestables.',5),
  ('ADO-01','no_incluye','Diseños especiales o patrones personalizados.',6),
  ('ADO-01','no_incluye','Fletes de materiales.',7),
  ('ADO-01','no_incluye','Sellos o tratamientos posteriores.',8),

  -- PAS-02 · Pastelones sobre radier existente ------------------------------
  ('PAS-02','incluye','Limpieza de la superficie.',1),
  ('PAS-02','incluye','Replanteo.',2),
  ('PAS-02','incluye','Mortero de pega.',3),
  ('PAS-02','incluye','Instalación de pastelones.',4),
  ('PAS-02','incluye','Nivelación propia del adhesivo.',5),
  ('PAS-02','incluye','Aplicación de fragüe (mano de obra).',6),
  ('PAS-02','incluye','Limpieza final.',7),
  ('PAS-02','no_incluye','Suministro de pastelones.',1),
  ('PAS-02','no_incluye','Compra del fragüe.',2),
  ('PAS-02','no_incluye','Reparación del radier.',3),
  ('PAS-02','no_incluye','Nivelaciones importantes.',4),
  ('PAS-02','no_incluye','Demoliciones.',5),
  ('PAS-02','no_incluye','Retiro de escombros.',6),
  ('PAS-02','no_incluye','Fletes.',7),

  -- PAS-03 · Pastelones sobre radier con nivelación -------------------------
  ('PAS-03','incluye','Limpieza de la superficie.',1),
  ('PAS-03','incluye','Replanteo.',2),
  ('PAS-03','incluye','Mortero de pega.',3),
  ('PAS-03','incluye','Instalación de pastelones.',4),
  ('PAS-03','incluye','Nivelación propia del adhesivo.',5),
  ('PAS-03','incluye','Aplicación de fragüe (mano de obra).',6),
  ('PAS-03','incluye','Regularización y nivelación menor del radier.',7),
  ('PAS-03','incluye','Limpieza final.',8),
  ('PAS-03','no_incluye','Suministro de pastelones.',1),
  ('PAS-03','no_incluye','Compra del fragüe.',2),
  ('PAS-03','no_incluye','Reparaciones estructurales del radier.',3),
  ('PAS-03','no_incluye','Nivelaciones mayores.',4),
  ('PAS-03','no_incluye','Demoliciones.',5),
  ('PAS-03','no_incluye','Retiro de escombros.',6),
  ('PAS-03','no_incluye','Fletes.',7),

  -- PAS-04 · Instalación completa de pastelones -----------------------------
  ('PAS-04','incluye','Replanteo.',1),
  ('PAS-04','incluye','Excavación.',2),
  ('PAS-04','incluye','Compactación de subrasante.',3),
  ('PAS-04','incluye','Base estabilizada.',4),
  ('PAS-04','incluye','Cama de arena.',5),
  ('PAS-04','incluye','Mortero de pega.',6),
  ('PAS-04','incluye','Instalación de pastelones.',7),
  ('PAS-04','incluye','Cortes simples.',8),
  ('PAS-04','incluye','Limpieza final.',9),
  ('PAS-04','no_incluye','Suministro de pastelones.',1),
  ('PAS-04','no_incluye','Retiro de pavimentos existentes.',2),
  ('PAS-04','no_incluye','Retiro de escombros.',3),
  ('PAS-04','no_incluye','Obras de drenaje.',4),
  ('PAS-04','no_incluye','Contenciones.',5),
  ('PAS-04','no_incluye','Paisajismo.',6),
  ('PAS-04','no_incluye','Sellos posteriores.',7),
  ('PAS-04','no_incluye','Fletes.',8),

  -- PAS-05A · Pastelones por unidad, formatos hasta 50×50 -------------------
  ('PAS-05A','incluye','Replanteo.',1),
  ('PAS-05A','incluye','Mortero de pega.',2),
  ('PAS-05A','incluye','Instalación.',3),
  ('PAS-05A','incluye','Nivelación.',4),
  ('PAS-05A','incluye','Ajustes de posición.',5),
  ('PAS-05A','incluye','Limpieza final.',6),
  ('PAS-05A','no_incluye','Suministro de pastelones.',1),
  ('PAS-05A','no_incluye','Excavaciones.',2),
  ('PAS-05A','no_incluye','Base estabilizada.',3),
  ('PAS-05A','no_incluye','Fabricación de radier.',4),
  ('PAS-05A','no_incluye','Retiro de escombros.',5),
  ('PAS-05A','no_incluye','Cortes especiales.',6),
  ('PAS-05A','no_incluye','Fletes.',7),

  -- PAS-05B · Pastelones por unidad, formatos sobre 50×50 ------------------
  ('PAS-05B','incluye','Replanteo.',1),
  ('PAS-05B','incluye','Mortero de pega.',2),
  ('PAS-05B','incluye','Instalación.',3),
  ('PAS-05B','incluye','Nivelación.',4),
  ('PAS-05B','incluye','Ajustes de posición.',5),
  ('PAS-05B','incluye','Limpieza final.',6),
  ('PAS-05B','no_incluye','Suministro de pastelones.',1),
  ('PAS-05B','no_incluye','Excavaciones.',2),
  ('PAS-05B','no_incluye','Base estabilizada.',3),
  ('PAS-05B','no_incluye','Fabricación de radier.',4),
  ('PAS-05B','no_incluye','Retiro de escombros.',5),
  ('PAS-05B','no_incluye','Cortes especiales.',6),
  ('PAS-05B','no_incluye','Fletes.',7),

  -- PIS-06 · Bordes de piscina de hormigón ---------------------------------
  ('PIS-06','incluye','Replanteo.',1),
  ('PIS-06','incluye','Adhesivo DA.',2),
  ('PIS-06','incluye','Instalación.',3),
  ('PIS-06','incluye','Nivelación.',4),
  ('PIS-06','incluye','Aplicación de fragüe (mano de obra).',5),
  ('PIS-06','incluye','Limpieza final.',6),
  ('PIS-06','no_incluye','Suministro de bordes de piscina.',1),
  ('PIS-06','no_incluye','Compra del fragüe.',2),
  ('PIS-06','no_incluye','Fabricación del radier perimetral.',3),
  ('PIS-06','no_incluye','Reparación del radier existente.',4),
  ('PIS-06','no_incluye','Impermeabilización.',5),
  ('PIS-06','no_incluye','Reparaciones de la piscina.',6),
  ('PIS-06','no_incluye','Retiro de escombros.',7),
  ('PIS-06','no_incluye','Fletes.',8),

  -- TER-07 · Terrazas o extensiones, sin radier -----------------------------
  ('TER-07','incluye','Replanteo.',1),
  ('TER-07','incluye','Excavación.',2),
  ('TER-07','incluye','Compactación de subrasante.',3),
  ('TER-07','incluye','Base estabilizada.',4),
  ('TER-07','incluye','Cama de arena.',5),
  ('TER-07','incluye','Mortero de pega cuando corresponda.',6),
  ('TER-07','incluye','Instalación.',7),
  ('TER-07','incluye','Cortes simples.',8),
  ('TER-07','incluye','Limpieza final.',9),
  ('TER-07','no_incluye','Suministro de los productos.',1),
  ('TER-07','no_incluye','Retiro de pavimentos existentes.',2),
  ('TER-07','no_incluye','Retiro de escombros.',3),
  ('TER-07','no_incluye','Paisajismo.',4),
  ('TER-07','no_incluye','Obras de drenaje.',5),
  ('TER-07','no_incluye','Soluciones para suelos inestables.',6),
  ('TER-07','no_incluye','Sellos posteriores.',7),
  ('TER-07','no_incluye','Fletes.',8),

  -- TER-08 · Terrazas sobre radier existente --------------------------------
  ('TER-08','incluye','Limpieza de superficie.',1),
  ('TER-08','incluye','Adhesivo DA.',2),
  ('TER-08','incluye','Instalación.',3),
  ('TER-08','incluye','Nivelación.',4),
  ('TER-08','incluye','Aplicación de fragüe (mano de obra).',5),
  ('TER-08','incluye','Limpieza final.',6),
  ('TER-08','no_incluye','Suministro de los productos.',1),
  ('TER-08','no_incluye','Compra del fragüe.',2),
  ('TER-08','no_incluye','Reparación del radier.',3),
  ('TER-08','no_incluye','Nivelaciones mayores.',4),
  ('TER-08','no_incluye','Demoliciones.',5),
  ('TER-08','no_incluye','Retiro de escombros.',6),
  ('TER-08','no_incluye','Fletes.',7),

  -- PIS-09 · Bordes para piscina de fibra -----------------------------------
  ('PIS-09','incluye','Replanteo.',1),
  ('PIS-09','incluye','Fabricación de radier perimetral de hasta 25 cm de ancho por 12 cm de profundidad.',2),
  ('PIS-09','incluye','Adhesivo DA.',3),
  ('PIS-09','incluye','Instalación.',4),
  ('PIS-09','incluye','Nivelación.',5),
  ('PIS-09','incluye','Aplicación de fragüe (mano de obra).',6),
  ('PIS-09','incluye','Limpieza final.',7),
  ('PIS-09','no_incluye','Suministro de bordes de piscina.',1),
  ('PIS-09','no_incluye','Compra del fragüe.',2),
  ('PIS-09','no_incluye','Radieres perimetrales con dimensiones superiores a las indicadas.',3),
  ('PIS-09','no_incluye','Reparaciones de la fibra.',4),
  ('PIS-09','no_incluye','Modificaciones estructurales de la piscina.',5),
  ('PIS-09','no_incluye','Retiro de escombros.',6),
  ('PIS-09','no_incluye','Fletes.',7),

  -- FAC-10 · Fachaletas sobre superficie plana ------------------------------
  ('FAC-10','incluye','Limpieza de la superficie.',1),
  ('FAC-10','incluye','Replanteo.',2),
  ('FAC-10','incluye','Adhesivo DA.',3),
  ('FAC-10','incluye','Instalación.',4),
  ('FAC-10','incluye','Aplicación de fragüe (mano de obra).',5),
  ('FAC-10','incluye','Limpieza final.',6),
  ('FAC-10','no_incluye','Suministro de fachaletas.',1),
  ('FAC-10','no_incluye','Compra del fragüe.',2),
  ('FAC-10','no_incluye','Retiro de revestimientos existentes.',3),
  ('FAC-10','no_incluye','Nivelación del muro.',4),
  ('FAC-10','no_incluye','Reparaciones del muro.',5),
  ('FAC-10','no_incluye','Impermeabilización.',6),
  ('FAC-10','no_incluye','Pinturas.',7),
  ('FAC-10','no_incluye','Retiro de escombros.',8),
  ('FAC-10','no_incluye','Fletes.',9),

  -- FAC-11 · Fachaletas sobre superficie irregular --------------------------
  ('FAC-11','incluye','Limpieza de la superficie.',1),
  ('FAC-11','incluye','Replanteo.',2),
  ('FAC-11','incluye','Regularización y nivelación menor del muro.',3),
  ('FAC-11','incluye','Adhesivo DA.',4),
  ('FAC-11','incluye','Instalación.',5),
  ('FAC-11','incluye','Aplicación de fragüe (mano de obra).',6),
  ('FAC-11','incluye','Limpieza final.',7),
  ('FAC-11','no_incluye','Suministro de fachaletas.',1),
  ('FAC-11','no_incluye','Compra del fragüe.',2),
  ('FAC-11','no_incluye','Retiro de revestimientos existentes.',3),
  ('FAC-11','no_incluye','Reparaciones estructurales del muro.',4),
  ('FAC-11','no_incluye','Tratamientos de humedad.',5),
  ('FAC-11','no_incluye','Impermeabilización.',6),
  ('FAC-11','no_incluye','Pinturas.',7),
  ('FAC-11','no_incluye','Retiro de escombros.',8),
  ('FAC-11','no_incluye','Fletes.',9)
) as t(codigo, tipo, texto, orden)
join lineas l on l.codigo = t.codigo;

-- ---------------------------------------------------------------------------
-- Condiciones generales (cierre del tarifario)
-- ---------------------------------------------------------------------------
delete from condiciones_generales;

insert into condiciones_generales (texto, orden) values
  ('Todos los valores corresponden a mano de obra y son más IVA.', 1),
  ('Los valores publicados son referenciales y podrán ajustarse una vez realizada la visita técnica.', 2),
  ('Los materiales principales (adoquines, pastelones, bordes de piscina, fachaletas y demás productos) no están incluidos, salvo que se indique expresamente en la propuesta comercial.', 3),
  ('Los trabajos consideran condiciones normales de acceso para personal, herramientas y materiales.', 4),
  ('Trabajos con acceso restringido, pendientes pronunciadas, izaje de materiales, uso de grúa u otras condiciones especiales serán cotizados por separado.', 5),
  ('Diseños especiales, patrones decorativos, radios, curvas o cortes complejos podrán generar un costo adicional.', 6),
  ('El retiro de escombros, el transporte de materiales y los fletes no están incluidos, salvo indicación expresa en la propuesta.', 7),
  ('El inicio de los trabajos estará sujeto a disponibilidad de agenda, condiciones climáticas y cumplimiento de los requisitos de la obra.', 8),
  ('La garantía cubre únicamente la correcta ejecución de la instalación realizada por Terra Concept y no considera daños ocasionados por movimientos del terreno, asentamientos, intervenciones de terceros, impactos, uso indebido, falta de mantención o causas ajenas a la instalación.', 9);

-- ---------------------------------------------------------------------------
-- Parámetros y textos del documento
-- Editables sin tocar código. Los textos salen de la imagen de referencia.
-- ---------------------------------------------------------------------------
insert into parametros (clave, valor, descripcion) values
  ('iva_pct', '19', 'Porcentaje de IVA aplicado al neto.'),
  ('validez_dias', '7', 'Días de validez por defecto de la propuesta.'),
  ('visita_tecnica_uf', '1', 'Valor en UF de la visita técnica.'),
  ('plazo_ejecucion_default', '5 días hábiles', 'Plazo de ejecución sugerido.'),

  ('empresa_telefono', '+56 9 3616 4525', 'Teléfono del pie del documento.'),
  ('empresa_email', 'ventas@terraconcept.cl', 'Correo del pie del documento.'),
  ('empresa_web', 'terraconcept.cl', 'Sitio del pie del documento.'),
  ('empresa_tagline', 'EXTERIORES QUE PERDURAN', 'Bajada bajo el logo.'),

  ('portada_titular', 'Transformamos espacios exteriores en experiencias que perduran.',
   'Titular del bloque inferior de la portada.'),
  ('portada_parrafo', 'En Terra Concept instalamos soluciones de hormigón arquitectónico con precisión y técnica, creando ambientes funcionales, estéticos y hechos para durar.',
   'Párrafo del bloque inferior de la portada.'),

  ('atributo_1_titulo', 'MATERIALES PREMIUM', 'Atributo 1 de la portada.'),
  ('atributo_1_texto',  'Hormigón de alta calidad y terminaciones superiores.', 'Atributo 1 de la portada.'),
  ('atributo_2_titulo', 'INSTALACIÓN EXPERTA', 'Atributo 2 de la portada.'),
  ('atributo_2_texto',  'Equipos especializados y procesos estandarizados.', 'Atributo 2 de la portada.'),
  ('atributo_3_titulo', 'DURABILIDAD GARANTIZADA', 'Atributo 3 de la portada.'),
  ('atributo_3_texto',  'Soluciones pensadas para resistir el paso del tiempo.', 'Atributo 3 de la portada.'),
  ('atributo_4_titulo', 'DISEÑO QUE INTEGRA', 'Atributo 4 de la portada.'),
  ('atributo_4_texto',  'Armonía entre arquitectura, paisajismo y entorno.', 'Atributo 4 de la portada.'),

  ('nota_valores', 'Valores netos. No incluyen IVA.',
   'Glosa bajo el total, en la página de presupuesto.'),
  ('nota_alcance', 'Los valores presentados son referenciales. Se requiere visita técnica para confirmar medidas y condiciones del proyecto.',
   'Nota al pie de la página de alcance.'),
  ('nota_visita_tecnica', 'Es necesario realizar una visita técnica a terreno para verificar medidas y condiciones del proyecto. El valor de la visita es de 1 UF, el cual será abonado al monto total en caso de aprobar la propuesta.',
   'Aviso de visita técnica en la página de presupuesto.'),
  ('nota_importante', 'Este presupuesto es estimativo. El valor final será confirmado después de la visita técnica y validación del proyecto.',
   'Aviso final en la página de presupuesto.'),
  ('cierre_documento', 'GRACIAS POR CONFIAR EN TERRA CONCEPT', 'Cierre de la página de presupuesto.')
on conflict (clave) do update set
  valor       = excluded.valor,
  descripcion = excluded.descripcion;
