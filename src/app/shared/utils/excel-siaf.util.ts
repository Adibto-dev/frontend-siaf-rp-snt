import type { Workbook, Worksheet } from 'exceljs';

/**
 * Formato SIAF-RP de los archivos Excel (Figma «Saldos iniciales», nodos 23870:89734 «Resumen» y 23870:89401
 * «Resultado»): un libro **Resumen** con título, fecha de creación, logo y los datos de la consulta, y un libro
 * **Resultado** con la tabla: cabecera en un solo azul (Figma «Registro de operaciones en las libretas», 2435:45553),
 * y cuerpo en blanco con bordes grises.
 *
 * Excel no lee los tokens CSS del kit: los colores van en ARGB, tomados del diseño de Figma.
 */
export const EXCEL_COLORES = {
  /** Título, línea bajo el encabezado y subtítulos del Resumen (brand primary). */
  marca: 'FF014899',
  /** Cabecera de la tabla: un solo color en todas sus filas y columnas. */
  cabecera: 'FF1C4794',
  /** Bordes de la tabla. */
  borde: 'FF808080',
  separador: 'FF8C9AB3',
  texto: 'FF000000',
  blanco: 'FFFFFFFF',
} as const;

const FUENTE = 'Calibri';

/** Logo de la cabecera del Resumen (se rasteriza a PNG: Excel no admite SVG). */
const LOGO_SVG = 'assets/figma/logos/siaf-rp-default-color.svg';

export interface ColumnaExcel {
  /** Texto de la cabecera (el término completo, no la abreviatura). */
  titulo: string;
  clave: string;
  /** Ancho en caracteres. Por defecto, según el título (mínimo 18). */
  ancho?: number;
  /** Formato numérico de Excel, p. ej. `#,##0.00`. */
  formato?: string;
  /** Cabecera agrupadora: las columnas seguidas con el mismo texto comparten una celda arriba. */
  grupo?: string;
}

export interface DatoConsulta {
  etiqueta: string;
  valor: string;
}

export interface ExportacionExcel {
  /** Título del Resumen, p. ej. «Documentos de saldos iniciales» (se muestra en mayúsculas). */
  titulo: string;
  /** Filtros y datos con que se armó la consulta: se listan en «Datos de la consulta». */
  consulta: DatoConsulta[];
  columnas: ColumnaExcel[];
  filas: Record<string, unknown>[];
  /** Nombre del archivo sin extensión. */
  archivo: string;
}

/** Carga exceljs al usarlo: así no pesa en la pantalla hasta que se exporta. */
export async function crearLibro(): Promise<Workbook> {
  // Según el empaquetado, el constructor llega directo o dentro de `default`.
  const mod = (await import('exceljs')) as typeof import('exceljs') & { default?: typeof import('exceljs') };
  const Workbook = mod.Workbook ?? mod.default!.Workbook;
  const libro = new Workbook();
  libro.creator = 'SIAF-RP';
  libro.created = new Date();
  return libro;
}

/** Exporta una consulta con los libros Resumen y Resultado y la descarga. */
export async function exportarConsultaExcel(datos: ExportacionExcel): Promise<void> {
  const libro = await crearLibro();
  const resumen = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  const resultado = libro.addWorksheet('Resultado');

  await armarResumen(libro, resumen, datos);
  escribirTabla(resultado, datos.columnas, datos.filas);

  await descargarLibro(libro, datos.archivo);
}

/**
 * Escribe la tabla con el formato SIAF desde la fila 1: cabecera (una o dos filas si hay grupos) y cuerpo.
 * Devuelve la última fila escrita.
 */
export function escribirTabla(hoja: Worksheet, columnas: ColumnaExcel[], filas: Record<string, unknown>[]): number {
  const conGrupos = columnas.some((c) => c.grupo);
  columnas.forEach((c, i) => {
    hoja.getColumn(i + 1).width = c.ancho ?? Math.max(18, c.titulo.length + 6);
    if (c.formato) hoja.getColumn(i + 1).numFmt = c.formato;
  });

  if (conGrupos) {
    hoja.addRow(columnas.map((c) => c.grupo ?? c.titulo));
    hoja.addRow(columnas.map((c) => (c.grupo ? c.titulo : '')));
    columnas.forEach((c, i) => {
      if (!c.grupo) hoja.mergeCells(1, i + 1, 2, i + 1);
      else if (columnas[i - 1]?.grupo !== c.grupo) {
        let fin = i;
        while (columnas[fin + 1]?.grupo === c.grupo) fin++;
        if (fin > i) hoja.mergeCells(1, i + 1, 1, fin + 1);
      }
    });
  } else {
    hoja.addRow(columnas.map((c) => c.titulo));
  }

  const filasCabecera = conGrupos ? [1, 2] : [1];
  estilarCabecera(hoja, filasCabecera, columnas.length);

  filas.forEach((fila) => hoja.addRow(columnas.map((c) => valorCelda(fila[c.clave]))));
  const ultima = filasCabecera.length + filas.length;
  estilarCuerpo(hoja, filasCabecera.length + 1, ultima, columnas.length);

  hoja.views = [{ state: 'frozen', ySplit: filasCabecera.length }];
  return ultima;
}

/** Cabecera azul de un solo color, texto blanco en negrita, centrado y con bordes. */
export function estilarCabecera(hoja: Worksheet, filas: number[], columnas: number): void {
  for (const n of filas) {
    const fila = hoja.getRow(n);
    fila.height = 32;
    for (let c = 1; c <= columnas; c++) {
      const celda = fila.getCell(c);
      celda.font = { name: FUENTE, size: 11, bold: true, color: { argb: EXCEL_COLORES.blanco } };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORES.cabecera } };
      celda.border = bordes();
    }
  }
}

/** Cuerpo: fondo blanco, centrado y con bordes grises. */
export function estilarCuerpo(hoja: Worksheet, desde: number, hasta: number, columnas: number): void {
  for (let n = desde; n <= hasta; n++) {
    const fila = hoja.getRow(n);
    fila.height = 24;
    for (let c = 1; c <= columnas; c++) {
      const celda = fila.getCell(c);
      celda.font = { name: FUENTE, size: 10, color: { argb: EXCEL_COLORES.texto } };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      celda.border = bordes();
    }
  }
}

export async function descargarLibro(libro: Workbook, archivo: string): Promise<void> {
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${archivo}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** «Documentos de autorización» → «documentos-de-autorizacion». */
export function nombreArchivo(texto: string): string {
  const base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'proceso';
}

/** dd/mm/aaaa  hh:mm:ss, como «Creado 16/07/2026  07:07:07» del diseño. */
export function fechaHoraCreacion(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}  ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
}

// ── Resumen ─────────────────────────────────────────────────────────

/** Columnas B…Q del Resumen; los datos de la consulta van de a dos por fila (B y F). */
const RESUMEN_PRIMERA_COL = 2;
const RESUMEN_ULTIMA_COL = 17;
const RESUMEN_COLUMNAS_DATO = [2, 6];

async function armarResumen(libro: Workbook, hoja: Worksheet, datos: ExportacionExcel): Promise<void> {
  hoja.getColumn(1).width = 3;
  for (let c = RESUMEN_PRIMERA_COL; c <= RESUMEN_ULTIMA_COL; c++) hoja.getColumn(c).width = 10;

  const titulo = hoja.getCell(2, 2);
  titulo.value = datos.titulo.toUpperCase();
  titulo.font = { name: FUENTE, size: 18, bold: true, color: { argb: EXCEL_COLORES.marca } };

  const creado = hoja.getCell(4, 2);
  creado.value = `Creado ${fechaHoraCreacion()}`;
  creado.font = { name: FUENTE, size: 12, italic: true };

  lineaInferior(hoja, 6, 'medium', EXCEL_COLORES.marca);
  await agregarLogo(libro, hoja);

  let fila = 9;
  subtitulo(hoja, fila, 'Datos de la consulta');
  fila += 2;
  for (let i = 0; i < datos.consulta.length; i += RESUMEN_COLUMNAS_DATO.length) {
    datos.consulta.slice(i, i + RESUMEN_COLUMNAS_DATO.length).forEach((dato, j) => {
      const col = RESUMEN_COLUMNAS_DATO[j];
      const etiqueta = hoja.getCell(fila, col);
      etiqueta.value = `${dato.etiqueta}:`;
      etiqueta.font = { name: FUENTE, size: 11, bold: true };
      const valor = hoja.getCell(fila + 1, col);
      valor.value = dato.valor;
      valor.font = { name: FUENTE, size: 11 };
    });
    fila += 3;
  }

  subtitulo(hoja, fila, 'Resultado');
  const total = hoja.getCell(fila + 2, 2);
  total.value = `${datos.filas.length} ${datos.filas.length === 1 ? 'registro' : 'registros'} en el libro «Resultado».`;
  total.font = { name: FUENTE, size: 11 };
}

function subtitulo(hoja: Worksheet, fila: number, texto: string): void {
  const celda = hoja.getCell(fila, 2);
  celda.value = texto;
  celda.font = { name: FUENTE, size: 14, bold: true, color: { argb: EXCEL_COLORES.marca } };
  lineaInferior(hoja, fila, 'dotted', EXCEL_COLORES.separador);
}

function lineaInferior(hoja: Worksheet, fila: number, estilo: 'medium' | 'dotted', color: string): void {
  for (let c = RESUMEN_PRIMERA_COL; c <= RESUMEN_ULTIMA_COL; c++) {
    hoja.getCell(fila, c).border = { bottom: { style: estilo, color: { argb: color } } };
  }
}

/** Logo arriba a la derecha. Si no se puede rasterizar (p. ej. en pruebas), el Resumen sale sin logo. */
async function agregarLogo(libro: Workbook, hoja: Worksheet): Promise<void> {
  const base64 = await svgAPng(LOGO_SVG, 280, 80).catch(() => null);
  if (!base64) return;
  const imagen = libro.addImage({ base64, extension: 'png' });
  hoja.addImage(imagen, { tl: { col: RESUMEN_ULTIMA_COL - 3, row: 1 }, ext: { width: 140, height: 40 } });
}

function svgAPng(url: string, ancho: number, alto: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      if (!ctx) return reject(new Error('sin canvas'));
      const escala = Math.min(ancho / img.width, alto / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, ancho - w, (alto - h) / 2, w, h);
      resolve(lienzo.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('no se cargó el logo'));
    img.src = url;
  });
}

function bordes() {
  const linea = { style: 'thin' as const, color: { argb: EXCEL_COLORES.borde } };
  return { top: linea, left: linea, bottom: linea, right: linea };
}

function valorCelda(valor: unknown): string | number | Date {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' || valor instanceof Date) return valor;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
}
