import type { TextFieldOption } from '../../../../shared/ui/text-field/text-field.component';

/**
 * Datos de prueba para filtrar las cuentas de registros en el panel de selección (Figma 789:67652): fuente y subfuente
 * (panel de origen), grupo, subgrupo y ubicación geográfica (panel de destino). Se derivan del ID correlativo, así siempre dan lo mismo y no cambian la forma de `mock-db`.
 */
export interface ClasificacionCuenta {
  fuente: string;
  /** Vacía en las fuentes 1 a 4. */
  subfuente: string;
  /** Solo bajo la subfuente 18. */
  concepto: string;
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  /** Nombre de la entidad (pliego) del Clasificador Institucional: «Gobierno Regional de Cusco». */
  entidad: string;
}

/** Departamento → provincia → distritos. */
export const UBIGEO: Record<string, Record<string, string[]>> = {
  Lima: {
    Lima: ['Cercado de Lima', 'Miraflores', 'San Isidro', 'Ate'],
    Huaral: ['Huaral', 'Chancay'],
  },
  Cusco: {
    Cusco: ['Cusco', 'Wanchaq', 'Santiago'],
    Urubamba: ['Urubamba', 'Ollantaytambo'],
  },
  Arequipa: {
    Arequipa: ['Arequipa', 'Cayma', 'Yanahuara'],
    Camaná: ['Camaná', 'Ocoña'],
  },
  Piura: {
    Piura: ['Piura', 'Castilla'],
    Sullana: ['Sullana', 'Bellavista'],
  },
};

/**
 * Grupo y subgrupo del Clasificador Institucional (`02-analisis/clasificador-institucional.md`). La demostración usa
 * solo 1.1 Gobierno Nacional, 1.2 Fondo de Seguridad Social y 2.1 Gobierno Regional.
 */
const GRUPOS: { grupo: string; subgrupos: string[] }[] = [
  { grupo: '1 - Gobierno Central', subgrupos: ['1 - Gobierno Nacional', '2 - Fondo de Seguridad Social'] },
  { grupo: '2 - Instancias Descentralizadas', subgrupos: ['1 - Gobierno Regional'] },
];

/**
 * Fuente → subfuente → concepto de la data de Cuentas de Registro v1.8 (`02-analisis/estructura-cuentas-de-registro.md`):
 * fuentes 1, 2 y 5; las 1 y 2 sin subfuente (segmento «00» del número), y solo la subfuente 18 se desagrega por
 * concepto (la 08 se registra a nivel agregado). Los códigos de concepto son los de la data (1, 3, 5, 6, 8, 9 y 10).
 */
const RD = '5 - Recursos Determinados';
const CANON = '18 - Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones';
const FUENTES: { fuente: string; subfuente: string; concepto: string }[] = [
  { fuente: '1 - Recursos Ordinarios', subfuente: '', concepto: '' },
  { fuente: '2 - Recursos Directamente Recaudados', subfuente: '', concepto: '' },
  { fuente: RD, subfuente: '07 - Fondo de Compensación Municipal', concepto: '' },
  { fuente: RD, subfuente: '08 - Impuestos Municipales', concepto: '' },
  { fuente: RD, subfuente: '15 - Fondo de Compensación Regional – FONCOR', concepto: '' },
  ...(
    [
      [1, 'Canon Minero'],
      [3, 'Canon Gasífero'],
      [5, 'Canon Gasífero – Regalías'],
      [6, 'Canon y Sobrecanon Petrolero'],
      [8, 'Regalía Minera'],
      [9, 'Renta de Aduanas'],
      [10, 'Renta de Aduanas – Ley del Chimbote'],
    ] as const
  ).map(([n, nombre]) => ({ fuente: RD, subfuente: CANON, concepto: `${n} - ${nombre}` })),
];

/** Cada par grupo / subgrupo del clasificador, para repartirlos entre las cuentas. */
const PARES = GRUPOS.flatMap(({ grupo, subgrupos }) => subgrupos.map((subgrupo) => ({ grupo, subgrupo })));

const UBICACIONES = Object.entries(UBIGEO).flatMap(([departamento, provincias]) =>
  Object.entries(provincias).flatMap(([provincia, distritos]) => distritos.map((distrito) => ({ departamento, provincia, distrito }))),
);

/** Clasificación de prueba de una cuenta de registros, fija para su ID correlativo. */
export function clasificacionDe(idCorrelativo: string): ClasificacionCuenta {
  const n = Number(idCorrelativo) || 0;
  const par = PARES[n % PARES.length];
  const lugar = UBICACIONES[(n * 7) % UBICACIONES.length];
  return { ...FUENTES[(n * 7) % FUENTES.length], ...par, ...lugar, entidad: entidadDe(par.subgrupo, lugar, n).nombre };
}

/** Ministerios de prueba con su pliego (4 dígitos del Clasificador Institucional). */
const MINISTERIOS: [string, string][] = [
  ['Ministerio de Economía y Finanzas', '0009'],
  ['Ministerio de Educación', '0010'],
  ['Ministerio de Salud', '0011'],
  ['Ministerio de Transportes y Comunicaciones', '0036'],
];
/** Pliego de prueba del gobierno regional de cada departamento. */
const PLIEGO_REGIONAL: Record<string, string> = { Lima: '0463', Cusco: '0447', Arequipa: '0443', Piura: '0457' };

/** Entidad (pliego) de prueba, coherente con su subgrupo y su ubicación. */
function entidadDe(subgrupo: string, l: { departamento: string }, n: number): { nombre: string; pliego: string } {
  switch (subgrupo) {
    case '1 - Gobierno Nacional': {
      const [nombre, pliego] = MINISTERIOS[n % MINISTERIOS.length];
      return { nombre, pliego };
    }
    case '2 - Fondo de Seguridad Social': return { nombre: 'Seguro Social de Salud - EsSalud', pliego: '0001' };
    default: return { nombre: `Gobierno Regional de ${l.departamento}`, pliego: PLIEGO_REGIONAL[l.departamento] ?? '0440' };
  }
}

/**
 * Sector, Subsector, Grupo, Subgrupo y Área del Clasificador Institucional (5 dígitos): 11111 Poder Ejecutivo,
 * 11121 Seguro Social y 11211 Gobiernos Regionales.
 */
const AMBITO: Record<string, string> = {
  '1 - Gobierno Nacional': '11111',
  '2 - Fondo de Seguridad Social': '11121',
  '1 - Gobierno Regional': '11211',
};

/**
 * Número de la cuenta de registro con la estructura de la data v1.8 (`estructura-cuentas-de-registro.md`), 8 segmentos
 * separados por punto: ámbito institucional (5) · pliego (4) · UE (3, «000» = pliego) · fuente (1) · subfuente (2, «00»
 * sin subfuente) · acreedor (3) · convenio (6) · secuencial (2; en la subfuente 18, el código del concepto). Ej.:
 * «11211.0440.000.5.15.000.000000.01».
 */
export function numeroCuentaRegistro(idCorrelativo: string, secuencia: number): string {
  const n = Number(idCorrelativo) || 0;
  const c = clasificacionDe(idCorrelativo);
  const { pliego } = entidadDe(c.subgrupo, c, n);
  const sec = c.concepto ? codigo(c.concepto) : String(secuencia);
  const subfuente = c.subfuente ? codigo(c.subfuente) : '00';
  return [AMBITO[c.subgrupo] ?? '11111', pliego, '000', codigo(c.fuente), subfuente, '000', '000000', sec.padStart(2, '0')].join('.');
}

/** Código de un valor «2 - Instancias Descentralizadas» → «2». */
export function codigo(valor: string): string {
  return valor.split(' - ')[0];
}

/**
 * Un destino de la asignación debe tener la misma Fuente y Sub fuente que la cuenta de origen (el concepto puede
 * variar). Sin origen, toda cuenta es compatible.
 */
export function mismaFuente(origen: string, destino: string): boolean {
  if (!origen) return true;
  const o = clasificacionDe(origen);
  const d = clasificacionDe(destino);
  return o.fuente === d.fuente && o.subfuente === d.subfuente;
}

/** Código de fuente y subfuente separados por punto: «5.18»; las fuentes sin subfuente, solo «1». */
export function codigoFuente(idCorrelativo: string): string {
  const c = clasificacionDe(idCorrelativo);
  return [c.fuente, c.subfuente].filter(Boolean).map(codigo).join('.');
}

/** Concepto de la cuenta, solo el nombre («Canon Minero»); «—» si no tiene. Es un dato de la cuenta, no un filtro. */
export function nombreConcepto(idCorrelativo: string): string {
  const concepto = clasificacionDe(idCorrelativo).concepto;
  return concepto ? concepto.split(' - ').slice(1).join(' - ') : '—';
}

/** «5 - Recursos Determinados / 15 - Fondo de Compensación Regional – FONCOR»: fuente y subfuente de una cuenta. */
export function textoFuenteSubfuente(idCorrelativo: string): string {
  const c = clasificacionDe(idCorrelativo);
  return [c.fuente, c.subfuente].filter(Boolean).join(' / ');
}



/** Valores del panel «Filtros»: vacío = sin filtrar. */
export interface FiltrosCuenta {
  fuente: string;
  subfuente: string;
  concepto: string;
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export const FILTROS_VACIOS: FiltrosCuenta = { fuente: '', subfuente: '', concepto: '', grupo: '', subgrupo: '', departamento: '', provincia: '', distrito: '' };

/** Cumple los filtros elegidos (vacío = sin filtrar). */
export function cumpleFiltros(idCorrelativo: string, f: FiltrosCuenta): boolean {
  const c = clasificacionDe(idCorrelativo);
  return (Object.keys(f) as (keyof FiltrosCuenta)[]).every((campo) => !f[campo] || c[campo] === f[campo]);
}

/** Campo que, al cambiar, limpia los que dependen de él. */
export const DEPENDIENTES: Partial<Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]>> = {
  fuente: ['subfuente', 'concepto'],
  subfuente: ['concepto'],
  grupo: ['subgrupo'],
  departamento: ['provincia', 'distrito'],
  provincia: ['distrito'],
};

/** Campos de los que depende cada filtro: solo ellos acotan sus opciones. */
const PADRES: Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]> = {
  fuente: [],
  subfuente: ['fuente'],
  concepto: ['fuente', 'subfuente'],
  grupo: [],
  subgrupo: ['grupo'],
  departamento: [],
  provincia: ['departamento'],
  distrito: ['departamento', 'provincia'],
};

/**
 * Opciones de un filtro: los valores de las cuentas del panel que cumplen sus campos padre (Sub fuente según Fuente, Concepto según Sub fuente, Sub grupo según Grupo;
 * Provincia y Distrito según la ubicación). Fuente, Grupo y Departamento muestran siempre todas sus opciones, aunque haya
 * otros filtros elegidos.
 */
export function opcionesFiltro(ids: string[], f: FiltrosCuenta, campo: keyof FiltrosCuenta): TextFieldOption[] {
  const cumplePadres = (id: string) => {
    const c = clasificacionDe(id);
    return PADRES[campo].every((padre) => !f[padre] || c[padre] === f[padre]);
  };
  const valores = new Set(ids.filter(cumplePadres).map((id) => clasificacionDe(id)[campo]).filter(Boolean));
  return [...valores].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).map((v) => ({ label: v, value: v }));
}
