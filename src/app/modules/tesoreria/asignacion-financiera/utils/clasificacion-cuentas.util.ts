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
 * Fuente → subfuente → concepto, según `02-analisis/fuentes-financiamiento.md` (v1.6, `Fuentes_y_Subfuentes.xlsx`): las
 * fuentes 1 a 4 no tienen subfuente, y solo las subfuentes 08 y 18 tienen conceptos. El número de concepto se repite
 * entre subfuentes (1 es Impuesto Predial en la 08 y Canon Minero en la 18).
 */
const RD = '5 - Recursos Determinados';
const CANON = '18 - Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones';
const FUENTES: { fuente: string; subfuente: string; concepto: string }[] = [
  { fuente: '1 - Recursos Ordinarios', subfuente: '', concepto: '' },
  { fuente: '2 - Recursos Directamente Recaudados', subfuente: '', concepto: '' },
  { fuente: '3 - Recursos por Operaciones Oficiales de Crédito', subfuente: '', concepto: '' },
  { fuente: '4 - Donaciones y Transferencias', subfuente: '', concepto: '' },
  { fuente: RD, subfuente: '04 - Contribuciones a Fondos', concepto: '' },
  { fuente: RD, subfuente: '07 - Fondo de Compensación Municipal', concepto: '' },
  ...[
    'Impuesto Predial',
    'Impuesto de Alcabala',
    'Impuesto al Patrimonio Vehicular',
    'Impuesto a las Apuestas',
    'Impuesto a los Juegos',
    'Impuesto a los Espectáculos Públicos no Deportivos',
    'Impuesto a los Juegos de Casino',
    'Impuesto a los Juegos de Máquinas Tragamonedas',
  ].map((nombre, i) => ({ fuente: RD, subfuente: '08 - Impuestos Municipales', concepto: `${i + 1} - ${nombre}` })),
  { fuente: RD, subfuente: '15 - Fondo de Compensación Regional – FONCOR', concepto: '' },
  ...[
    'Canon Minero',
    'Canon Hidroenergético',
    'Canon Gasífero',
    'Canon Pesquero',
    'Canon Gasífero – Regalías',
    'Canon y Sobrecanon Petrolero',
    'Canon Pesquero – Derechos',
    'Regalía Minera',
    'Renta de Aduanas',
    'Renta de Aduanas – Ley del Chimbote',
  ].map((nombre, i) => ({ fuente: RD, subfuente: CANON, concepto: `${i + 1} - ${nombre}` })),
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
  return { ...FUENTES[(n * 7) % FUENTES.length], ...par, ...lugar, entidad: nombreEntidad(par.subgrupo, lugar, n) };
}

const MINISTERIOS = ['Ministerio de Economía y Finanzas', 'Ministerio de Educación', 'Ministerio de Salud', 'Ministerio de Transportes y Comunicaciones'];

/** Nombre de prueba de la entidad, coherente con su subgrupo y su ubicación. */
function nombreEntidad(subgrupo: string, l: { departamento: string; provincia: string; distrito: string }, n: number): string {
  switch (codigo(subgrupo) + '|' + subgrupo) {
    case '1|1 - Gobierno Nacional': return MINISTERIOS[n % MINISTERIOS.length];
    case '2|2 - Fondo de Seguridad Social': return 'Seguro Social de Salud - EsSalud';
    default: return `Gobierno Regional de ${l.departamento}`;
  }
}

/**
 * Segmento FF/SFF del número de la cuenta de registro: fuente y subfuente separadas por punto («5.08»); sin subfuente,
 * «.00» («1.00»). Número completo (Figma 2687:36998): Ámbito institucional · FF/SFF · Org. finan. · Convenio · Sec.
 */
export function segmentoFuente(idCorrelativo: string): string {
  const c = clasificacionDe(idCorrelativo);
  return `${codigo(c.fuente)}.${c.subfuente ? codigo(c.subfuente) : '00'}`;
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

/** Concepto de la cuenta, solo el nombre («Impuesto Predial»); «—» si no tiene. Es un dato de la cuenta, no un filtro. */
export function nombreConcepto(idCorrelativo: string): string {
  const concepto = clasificacionDe(idCorrelativo).concepto;
  return concepto ? concepto.split(' - ').slice(1).join(' - ') : '—';
}

/** «5 - Recursos Determinados / 08 - Impuestos Municipales»: fuente y subfuente de una cuenta. */
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
