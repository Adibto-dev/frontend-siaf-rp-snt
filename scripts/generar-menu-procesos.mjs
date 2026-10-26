// Genera el menú de Procesos desde `docs/menu-procesos.xlsx` (hoja «Menú»; la planilla que se edita en Excel).
//
//   npm run menu:build   → revisa la planilla y escribe src/app/shared/utils/menu-procesos.generado.ts
//   npm run menu:check   → revisa la planilla y falla si el archivo generado no está al día (corre antes de commitear)
//
// Columnas: id, nombre, padre, orden, estado, tipo, ruta, abierto_al_inicio, descripcion. Las listas desplegables de la
// planilla (padre, estado, tipo) evitan errores de escritura; lo demás (ciclos, rutas, ids repetidos) lo revisa este script.
import ExcelJS from 'exceljs';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = process.cwd();
const RUTA_XLSX = join(raiz, 'docs/menu-procesos.xlsx');
const HOJA = 'Menú';
const RUTA_TS = join(raiz, 'src/app/shared/utils/menu-procesos.generado.ts');
const soloRevisar = process.argv.includes('--check');

const ESTADOS = ['activo', 'proximamente', 'oculto'];
const TIPOS = ['proceso', 'subproceso', 'actividad', 'mfd', ''];
const COLUMNAS = ['id', 'nombre', 'padre', 'orden', 'estado', 'tipo', 'ruta', 'abierto_al_inicio', 'descripcion'];
const PROFUNDIDAD_AVISO = 5;

/** Rutas declaradas en los `*.routes.ts` de la app (para avisar si un MFD activo apunta a una pantalla que no existe). */
function rutasDeLaApp(dir = join(raiz, 'src/app')) {
  const rutas = new Set();
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) rutasDeLaApp(ruta).forEach((r) => rutas.add(r));
    else if (n.endsWith('.routes.ts')) for (const m of readFileSync(ruta, 'utf8').matchAll(/path:\s*'([^']*)'/g)) rutas.add('/' + m[1]);
  }
  return rutas;
}

const errores = [];
const avisos = [];

if (!existsSync(RUTA_XLSX)) {
  console.error(`No existe ${relative(raiz, RUTA_XLSX)}.`);
  process.exit(1);
}

/** Texto de una celda, sea texto, número, fórmula o texto con formato. */
function textoDe(celda) {
  const v = celda.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '').trim();
    if ('richText' in v) return v.richText.map((r) => r.text).join('').trim();
    if ('text' in v) return String(v.text).trim();
  }
  return String(v).trim();
}

const libro = new ExcelJS.Workbook();
try {
  await libro.xlsx.readFile(RUTA_XLSX);
} catch (e) {
  console.error(`No se pudo leer ${relative(raiz, RUTA_XLSX)}: ${e.message}. Si está abierto en Excel, cerrarlo y reintentar.`);
  process.exit(1);
}
const hoja = libro.getWorksheet(HOJA);
if (!hoja) {
  console.error(`${relative(raiz, RUTA_XLSX)} no tiene la hoja «${HOJA}».`);
  process.exit(1);
}

const encabezado = [];
hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => { encabezado[col - 1] = textoDe(celda).toLowerCase(); });
for (const col of COLUMNAS.slice(0, 7)) {
  if (!encabezado.includes(col)) errores.push(`Encabezado: falta la columna «${col}».`);
}

const filas = [];
if (!errores.length) {
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    const v = (col) => textoDe(fila.getCell(encabezado.indexOf(col) + 1));
    if (COLUMNAS.every((col) => encabezado.indexOf(col) < 0 || !v(col))) return;
    filas.push({
      numero,
      id: v('id'),
      nombre: v('nombre'),
      padre: v('padre') || null,
      orden: v('orden'),
      estado: v('estado').toLowerCase(),
      tipo: v('tipo').toLowerCase(),
      ruta: v('ruta'),
      abierto: ['si', 'sí', 'x', '1', 'true'].includes(v('abierto_al_inicio').toLowerCase()),
    });
  });
}

const porId = new Map();
for (const f of filas) {
  const donde = `Fila ${f.numero}`;
  if (!f.id) errores.push(`${donde}: falta el id.`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) errores.push(`${donde}: el id «${f.id}» solo puede tener minúsculas, números y guiones (sin tildes ni espacios).`);
  else if (porId.has(f.id)) errores.push(`${donde}: el id «${f.id}» ya está en la fila ${porId.get(f.id).numero}.`);
  else porId.set(f.id, f);
  if (!f.nombre) errores.push(`${donde}: falta el nombre.`);
  if (!/^\d+$/.test(f.orden)) errores.push(`${donde}: el orden «${f.orden}» debe ser un número entero (10, 20, 30…).`);
  if (!ESTADOS.includes(f.estado)) errores.push(`${donde}: el estado «${f.estado}» no existe. Usar: ${ESTADOS.join(', ')}.`);
  if (!TIPOS.includes(f.tipo)) errores.push(`${donde}: el tipo «${f.tipo}» no existe. Usar: ${TIPOS.filter(Boolean).join(', ')} (o vacío).`);
  if (f.ruta && !f.ruta.startsWith('/')) errores.push(`${donde}: la ruta «${f.ruta}» debe empezar con «/».`);
  if (f.abierto && f.padre) avisos.push(`${donde}: «abierto_al_inicio» solo aplica a procesos raíz; se ignora.`);
}

// Padres existentes, sin ciclos, y profundidad.
const rutasApp = rutasDeLaApp();
const conHijos = new Set(filas.map((f) => f.padre).filter(Boolean));
for (const f of filas) {
  if (f.padre && !porId.has(f.padre)) {
    errores.push(`Fila ${f.numero}: el padre «${f.padre}» no existe (revisar que sea un id, no un nombre).`);
    continue;
  }
  const visitados = new Set([f.id]);
  let actual = f;
  let nivel = 1;
  while (actual?.padre) {
    if (visitados.has(actual.padre)) {
      errores.push(`Fila ${f.numero}: «${f.id}» queda dentro de sí mismo (ciclo en la columna padre).`);
      break;
    }
    visitados.add(actual.padre);
    actual = porId.get(actual.padre);
    nivel++;
  }
  if (nivel > PROFUNDIDAD_AVISO) avisos.push(`Fila ${f.numero}: «${f.id}» está en el nivel ${nivel}; en el panel se verá muy angosto.`);

  const esHoja = !conHijos.has(f.id);
  if (f.estado === 'activo' && esHoja && !f.ruta) {
    errores.push(`Fila ${f.numero}: «${f.id}» está activo y no tiene hijos ni ruta: no llevaría a ninguna parte. Poner una ruta o dejarlo como «proximamente».`);
  }
  if (f.estado === 'activo' && f.ruta && !rutasApp.has(f.ruta)) {
    errores.push(`Fila ${f.numero}: la ruta «${f.ruta}» no está en ningún *.routes.ts. Primero hay que crear la pantalla, o dejarlo como «proximamente».`);
  }
}

// Ids que el código usa (migas de pan, título, «Crear documento»): si se borran o renombran en la planilla, la pantalla
// queda con migas incompletas sin que nada falle. Se buscan las constantes `*PROCESS_ID = '…'` y las claves de
// `DATOS_EXTRA_POR_ID` (process-tree.util.ts).
function idsUsadosEnCodigo(dir = join(raiz, 'src/app')) {
  const usados = [];
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) { usados.push(...idsUsadosEnCodigo(ruta)); continue; }
    if (!n.endsWith('.ts') || n.endsWith('.spec.ts') || n.endsWith('.generado.ts')) continue;
    const texto = readFileSync(ruta, 'utf8');
    for (const m of texto.matchAll(/PROCESS_ID\s*=\s*'([^']+)'/g)) usados.push({ id: m[1], ruta });
    const extras = texto.match(/DATOS_EXTRA_POR_ID[^=]*=\s*{([\s\S]*?)\n};/);
    if (extras) for (const m of extras[1].matchAll(/^ {2}'([^']+)'\s*:/gm)) usados.push({ id: m[1], ruta });
  }
  return usados;
}
for (const { id, ruta } of idsUsadosEnCodigo()) {
  if (!porId.has(id)) {
    errores.push(`El código usa el id «${id}» (${relative(raiz, ruta)}) y ya no está en la planilla. Si se renombró, poner el id nuevo en ese archivo.`);
  } else if (porId.get(id).estado === 'oculto') {
    avisos.push(`El código usa el id «${id}» (${relative(raiz, ruta)}), que está oculto en la planilla.`);
  }
}

for (const a of avisos) console.warn(`Aviso · ${a}`);
if (errores.length) {
  console.error(`La planilla ${relative(raiz, RUTA_XLSX)} tiene ${errores.length} error(es):`);
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}

// Archivo generado: una fila por línea, en el mismo orden que la planilla.
const aTexto = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const filasTs = filas.map((f) => {
  const partes = [
    `id: ${aTexto(f.id)}`,
    `nombre: ${aTexto(f.nombre)}`,
    `padre: ${f.padre ? aTexto(f.padre) : 'null'}`,
    `orden: ${Number(f.orden)}`,
    `estado: ${aTexto(f.estado)}`,
  ];
  if (f.tipo) partes.push(`tipo: ${aTexto(f.tipo)}`);
  if (f.ruta) partes.push(`ruta: ${aTexto(f.ruta)}`);
  if (f.abierto && !f.padre) partes.push('abiertoAlInicio: true');
  return `  { ${partes.join(', ')} },`;
});

const contenido = `// ARCHIVO GENERADO: no editar a mano. Se arma desde docs/menu-procesos.xlsx con \`npm run menu:build\`.
import type { FilaMenuProcesos } from './process-tree.util';

export const MENU_PROCESOS_FILAS: FilaMenuProcesos[] = [
${filasTs.join('\n')}
];
`;

const actual = existsSync(RUTA_TS) ? readFileSync(RUTA_TS, 'utf8').replace(/\r\n/g, '\n') : '';
if (soloRevisar) {
  if (actual !== contenido) {
    console.error('El menú generado no está al día con docs/menu-procesos.xlsx. Correr: npm run menu:build');
    process.exit(1);
  }
  console.log(`Menú de procesos al día (${filas.length} filas).`);
} else {
  if (actual !== contenido) writeFileSync(RUTA_TS, contenido);
  console.log(`Menú de procesos generado: ${filas.length} filas → ${relative(raiz, RUTA_TS)}`);
}
