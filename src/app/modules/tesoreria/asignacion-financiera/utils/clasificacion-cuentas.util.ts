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
  Áncash: {
    Santa: ['Chimbote', 'Nuevo Chimbote', 'Coishco'],
  },
  Callao: {
    Callao: ['Callao', 'Bellavista', 'La Perla'],
  },
};

/**
 * Grupo y subgrupo del Clasificador Institucional (`02-analisis/clasificador-institucional.md`). La demostración usa
 * solo 1.1 Gobierno Nacional, 1.2 Fondo de Seguridad Social, 2.1 Gobierno Regional y 2.2 Gobiernos Locales.
 */
const GRUPOS: { grupo: string; subgrupos: string[] }[] = [
  { grupo: '1 - Gobierno Central', subgrupos: ['1 - Gobierno Nacional', '2 - Fondo de Seguridad Social'] },
  { grupo: '2 - Instancias Descentralizadas', subgrupos: ['1 - Gobierno Regional', '2 - Gobiernos Locales'] },
];

/**
 * Fuente → subfuente → concepto de la data de Cuentas de Registro v1.8 (`02-analisis/estructura-cuentas-de-registro.md`):
 * fuentes 1, 2 y 5; las 1 y 2 sin subfuente (segmento «00» del número), y solo la subfuente 18 se desagrega por
 * concepto (la 08 se registra a nivel agregado). Los códigos de concepto son los de la data (1, 3, 5, 6, 8, 9 y 10).
 * El concepto es un dato de la cuenta de registro aprobado por el equipo (2026-11-27).
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


/** Abreviaturas con que se escribe a veces el recurso en el nombre de la cuenta (para mostrar la fragilidad). */
const ABREVIADO: [RegExp, string][] = [
  [/Canon y Sobrecanon/g, 'Can. y Sobrec.'],
  [/Canon/g, 'Can.'],
  [/Regalías?/g, 'Reg.'],
  [/Renta de Aduanas/g, 'Rta. Aduanas'],
  [/Fondo de Compensación/g, 'F. Comp.'],
  [/Recursos/g, 'Rec.'],
];

/** Errores de tilde: la búsqueda ignora tildes, así que estas cuentas sí se encuentran. */
const TILDE_ERRADA: [RegExp, string][] = [
  [/Canon/, 'Canón'],
  [/Regalía/, 'Regalia'],
  [/Gasífero/, 'Gasifero'],
  [/Compensación/, 'Compensacion'],
  [/Público/, 'Publico'],
];

/** Errores de escritura: la búsqueda no los corrige y la cuenta no aparece al buscar el término bien escrito. */
const ERRATA: [RegExp, string][] = [
  [/Canon/, 'Cannon'],
  [/Minera/, 'Minería'],
  [/Gasífero/, 'Gasífro'],
  [/Renta de Aduanas/, 'Renta Aduanas'],
  [/Compensación/, 'Compensacón'],
  [/FONCOR/, 'FONCORR'],
  [/Recursos/, 'Recurzos'],
];

/**
 * Nombres errados del recurso de cada concepto de la sub fuente 18. En la demo todas las cuentas de la 18 tienen el
 * nombre mal escrito, abreviado o genérico, para que se vea en vivo que la búsqueda por nombre no las encuentra.
 */
const ERRATA_18: Record<string, string[]> = {
  '1': ['Cannon Minero', 'Kanon Minero', 'Canom Minero'],
  '3': ['Canom Gasífero', 'Caon Gasífero', 'Cannon Gasífero'],
  '5': ['Cannon Gasífero – Regalías', 'Kanon Gasífero – Regalas'],
  '6': ['Cannon y Sobrecannon Petrolero', 'Kanon y Sobrekanon Petrolero', 'Cann. y Sobrec. Petrolero'],
  '8': ['Regalía Minería', 'Regalya Minera', 'Rregalía Minera'],
  '9': ['Renta Aduanas', 'Renta de Aduana', 'Rentas de Aduanas'],
  '10': ['Renta de Aduanas – Ley de Chimbote', 'Renta Aduanas – Ley del Chimbote', 'Renta de Aduanas – Ley del Chimbot'],
};

const aplicar = (texto: string, cambios: [RegExp, string][]) => cambios.reduce((t, [re, nuevo]) => t.replace(re, nuevo), texto);

/**
 * IDs de las cuentas de registro de la «MEF - Cuenta Única del Tesoro» (`CUENTA_DEMOSTRACION`): las 6 propias (032 a
 * 037) y las 30 de demostración (100 a 129). Se repiten aquí para no importar el modelo de saldos (dependencia circular).
 */
const IDS_CUT = [...Array.from({ length: 6 }, (_, k) => 32 + k), ...Array.from({ length: 30 }, (_, k) => 100 + k)];

/**
 * En la CUT, la primera cuenta de cada concepto de la sub fuente 18 lleva el nombre bien escrito: la búsqueda por nombre
 * encuentra esa y ninguna otra del concepto; el filtro Concepto encuentra todas.
 */
const BIEN_ESCRITAS_18 = new Set(
  [...IDS_CUT.reduce((primera, n) => {
    const concepto = FUENTES[(n * 7) % FUENTES.length].concepto;
    if (concepto && !primera.has(concepto)) primera.set(concepto, n);
    return primera;
  }, new Map<string, number>()).values()],
);

/**
 * Recurso escrito a mano en algunas cuentas de la Ley del Chimbote (concepto 10), para que solo la 101 de la CUT diga
 * «Ley del Chimbote» bien escrito: la 125 corrige «Renta de Aduanas» y yerra el Chimbote; la 053 yerra los dos.
 */
const RECURSO_FIJO: Record<number, string> = {
  125: 'Renta de Aduanas – Ley del Chinbote',
  53: 'Renta Aduanas – Ley Chimbote',
};

/**
 * Nombre de prueba de la cuenta de registro, fijo para su ID: el recurso (concepto, sub fuente o fuente) y la entidad,
 * p. ej. «Canon Minero – Gobierno Regional de Cusco». Para la demo, una de cada nueve queda genérica («Cuenta Fondo
 * Tesoro Público 13»), otra con el recurso abreviado («Can. Minero – …») y otra con un error de escritura («Cannon
 * Minero», «Regalía Minería»): la búsqueda por nombre no las encuentra. Otra más tiene la tilde errada («Canón»,
 * «Regalia»), que la búsqueda sí tolera. Las de la sub fuente 18 llevan siempre el recurso errado (`ERRATA_18`).
 */
export function nombreCuentaRegistro(idCorrelativo: string): string {
  const n = Number(idCorrelativo) || 0;
  const c = clasificacionDe(idCorrelativo);
  if (RECURSO_FIJO[n]) return `${RECURSO_FIJO[n]} – ${c.entidad}`;
  if (BIEN_ESCRITAS_18.has(n)) return `${c.concepto.split(' - ').slice(1).join(' - ')} – ${c.entidad}`;
  if (n % 9 === 4) return `Cuenta Fondo Tesoro Público ${n}`;
  const nombreDe = (valor: string) => valor.split(' - ').slice(1).join(' - ');
  const recurso = nombreDe(c.concepto || c.subfuente || c.fuente);
  const nombre = `${recurso} – ${c.entidad}`;
  if (n % 9 === 7) return aplicar(nombre, ABREVIADO);
  if (c.concepto) {
    const errados = ERRATA_18[codigo(c.concepto)];
    return `${errados[Math.floor(n / FUENTES.length) % errados.length]} – ${c.entidad}`;
  }
  if (n % 9 === 1) return aplicar(nombre, TILDE_ERRADA);
  if (n % 9 === 5) return aplicar(nombre, ERRATA);
  return nombre;
}

type Par = (typeof PARES)[number];
type Lugar = (typeof UBICACIONES)[number];
const parDe = (subgrupo: string): Par => PARES.find((p) => p.subgrupo === subgrupo)!;
const GOB_REGIONAL = parDe('1 - Gobierno Regional');
const GOB_LOCAL = parDe('2 - Gobiernos Locales');
const lugaresEn = (...provincias: string[]): Lugar[] => UBICACIONES.filter((u) => provincias.includes(u.provincia));
/** Provincias con aduana en la demo (régimen general y Callao). */
const PROVINCIAS_CON_ADUANA = ['Callao', 'Piura', 'Arequipa', 'Huaral'];

/**
 * Tipo de entidad y lugares posibles de una cuenta según su recurso, para que la demo no contradiga la normativa
 * (`02-analisis/estructura-cuentas-de-registro.md` §6): FONCOMUN e impuestos municipales, solo gobiernos locales;
 * FONCOR, solo gobiernos regionales; canon y regalías, regionales o locales; Renta de Aduanas, el Gobierno Regional del
 * Callao o municipalidades de provincias con aduana; Ley del Chimbote, solo municipalidades de la provincia del Santa.
 * Recursos Ordinarios y Directamente Recaudados, cualquier entidad.
 */
function destinoDe(f: (typeof FUENTES)[number], n: number): { par: Par; lugares: Lugar[] } {
  // Las cuentas de un mismo concepto se repiten cada 12 IDs (7 · 12 ≡ 0 mód. 14): se alterna con la vuelta.
  const vuelta = Math.floor(n / FUENTES.length);
  const conceptoCod = f.concepto ? codigo(f.concepto) : '';
  const subfuenteCod = f.subfuente ? codigo(f.subfuente) : '';
  // Endeudamiento: lo registra el MEF (Gobierno Nacional, en Lima).
  if (f === FUENTE_ENDEUDAMIENTO) return { par: parDe('1 - Gobierno Nacional'), lugares: lugaresEn('Lima').slice(0, 1) };
  if (conceptoCod === '10') return { par: GOB_LOCAL, lugares: lugaresEn('Santa') };
  if (conceptoCod === '9') {
    return vuelta % 2 ? { par: GOB_REGIONAL, lugares: lugaresEn('Callao') } : { par: GOB_LOCAL, lugares: lugaresEn(...PROVINCIAS_CON_ADUANA) };
  }
  if (conceptoCod) return { par: vuelta % 2 ? GOB_REGIONAL : GOB_LOCAL, lugares: UBICACIONES };
  if (subfuenteCod === '07' || subfuenteCod === '08') return { par: GOB_LOCAL, lugares: UBICACIONES };
  if (subfuenteCod === '15') return { par: GOB_REGIONAL, lugares: UBICACIONES };
  return { par: PARES[n % PARES.length], lugares: UBICACIONES };
}

/** Clasificación de prueba de una cuenta de registros, fija para su ID correlativo y coherente con su recurso. */
export function clasificacionDe(idCorrelativo: string): ClasificacionCuenta {
  const n = Number(idCorrelativo) || 0;
  const fuente = FINANCIAMIENTO[n] ? FUENTE_ENDEUDAMIENTO : FUENTES[(n * 7) % FUENTES.length];
  const { par, lugares } = destinoDe(fuente, n);
  const lugar = lugares === UBICACIONES ? lugares[(n * 7) % lugares.length] : lugares[(n + Math.floor(n / FUENTES.length)) % lugares.length];
  return { ...fuente, ...par, ...lugar, entidad: entidadDe(par.subgrupo, lugar, n).nombre };
}

/** Ministerios de prueba con su pliego (4 dígitos del Clasificador Institucional). */
const MINISTERIOS: [string, string][] = [
  ['Ministerio de Economía y Finanzas', '0009'],
  ['Ministerio de Educación', '0010'],
  ['Ministerio de Salud', '0011'],
  ['Ministerio de Transportes y Comunicaciones', '0036'],
];
/** Entidades de prueba del Fondo de Seguridad Social con su pliego. */
const SEGURIDAD_SOCIAL: [string, string][] = [
  ['Oficina de Normalización Previsional', '0002'],
  ['Caja de Pensiones Militar Policial', '0003'],
  ['Fondo Consolidado de Reservas Previsionales', '0004'],
];
/** Pliego de prueba del gobierno regional de cada departamento. */
const PLIEGO_REGIONAL: Record<string, string> = { Lima: '0463', Cusco: '0447', Arequipa: '0443', Piura: '0457', Áncash: '0441', Callao: '0464' };
/** «del» delante del nombre de algunas provincias: «Municipalidad Provincial del Santa». */
const CON_ARTICULO = ['Santa', 'Callao'];

/** Municipalidad de prueba del lugar: la provincial en la capital (primer distrito), si no la distrital. */
function municipalidadDe(l: Lugar): { nombre: string; pliego: string } {
  const capital = UBIGEO[l.departamento][l.provincia][0] === l.distrito;
  // Se busca por sus datos: el lugar llega copiado en la clasificación y no es el mismo objeto de UBICACIONES.
  const indice = UBICACIONES.findIndex((u) => u.departamento === l.departamento && u.provincia === l.provincia && u.distrito === l.distrito);
  const pliego = String(3000 + indice);
  if (capital) return { nombre: `Municipalidad Provincial ${CON_ARTICULO.includes(l.provincia) ? 'del' : 'de'} ${l.provincia}`, pliego };
  return { nombre: `Municipalidad Distrital de ${l.distrito}`, pliego };
}

/** Entidad (pliego) de prueba, coherente con su subgrupo y su ubicación. */
function entidadDe(subgrupo: string, l: Lugar, n: number): { nombre: string; pliego: string } {
  switch (subgrupo) {
    case '1 - Gobierno Nacional': {
      const [nombre, pliego] = FINANCIAMIENTO[n] ? MINISTERIOS[0] : MINISTERIOS[n % MINISTERIOS.length];
      return { nombre, pliego };
    }
    case '2 - Fondo de Seguridad Social': {
      const [nombre, pliego] = SEGURIDAD_SOCIAL[n % SEGURIDAD_SOCIAL.length];
      return { nombre, pliego };
    }
    case '2 - Gobiernos Locales': return municipalidadDe(l);
    default: return { nombre: `Gobierno Regional ${l.departamento === 'Callao' ? 'del' : 'de'} ${l.departamento}`, pliego: PLIEGO_REGIONAL[l.departamento] ?? '0440' };
  }
}

/**
 * Sector, Subsector, Grupo, Subgrupo y Área del Clasificador Institucional (5 dígitos): 11111 Poder Ejecutivo,
 * 11121 Seguro Social, 11211 Gobiernos Regionales y 11221 Gobiernos Locales.
 */
const AMBITO: Record<string, string> = {
  '1 - Gobierno Nacional': '11111',
  '2 - Fondo de Seguridad Social': '11121',
  '1 - Gobierno Regional': '11211',
  '2 - Gobiernos Locales': '11221',
};

/**
 * Fuente 3 (Recursos por Operaciones Oficiales de Crédito), sin subfuente: la única de la demo con acreedor (organismo
 * financiador) y convenio de financiamiento. La llevan algunas cuentas de la «MEF - DGTP Endeudamiento externo».
 */
const FUENTE_ENDEUDAMIENTO = { fuente: '3 - Recursos por Operaciones Oficiales de Crédito', subfuente: '', concepto: '' };

/**
 * Acreedor (3 dígitos) y convenio de financiamiento (6) de las cuentas con endeudamiento, por ID correlativo. Son del
 * MEF; dos comparten acreedor y convenio: se distinguen por el secuencial (01 y 02).
 */
const FINANCIAMIENTO: Record<number, { acreedor: string; convenio: string }> = {
  12: { acreedor: '001', convenio: '000123' },
  13: { acreedor: '001', convenio: '000123' },
  14: { acreedor: '002', convenio: '000456' },
};

/**
 * Unidad ejecutora (3 dígitos; «000» es el propio pliego). En la demo, ministerios y gobiernos regionales reparten sus
 * cuentas entre el pliego y dos UE; el resto de entidades registran a nivel de pliego.
 */
function unidadEjecutoraDe(subgrupo: string, n: number): string {
  const ues = subgrupo === '1 - Gobierno Nacional' ? ['000', '001', '003'] : subgrupo === '1 - Gobierno Regional' ? ['000', '001', '002'] : ['000'];
  return ues[Math.floor(n / 2) % ues.length];
}

/**
 * Número de la cuenta de registro sin el secuencial, con sus segmentos separados por espacio y solo un punto entre
 * fuente y subfuente: sector, subsector, grupo, subgrupo y área (5) · entidad (4) · UE (3, «000» = pliego) · fuente y
 * subfuente (1.2, «00» sin subfuente) · acreedor (3) · convenio de financiamiento (6). Ej.: «11211 0447 001 5.15 000
 * 000000». El secuencial lo agrega `numerarCuentasRegistro`.
 */
export function prefijoCuentaRegistro(idCorrelativo: string): string {
  const n = Number(idCorrelativo) || 0;
  const c = clasificacionDe(idCorrelativo);
  const { pliego } = entidadDe(c.subgrupo, c, n);
  const subfuente = c.subfuente ? codigo(c.subfuente) : '00';
  const { acreedor, convenio } = FINANCIAMIENTO[n] ?? { acreedor: '000', convenio: '000000' };
  return [AMBITO[c.subgrupo] ?? '11111', pliego, unidadEjecutoraDe(c.subgrupo, n), `${codigo(c.fuente)}.${subfuente}`, acreedor, convenio].join(' ');
}

/**
 * Pone el número completo a cada cuenta: su prefijo más un secuencial de 2 dígitos, correlativo (01, 02…) entre las
 * cuentas que comparten ámbito institucional, entidad, UE, fuente y subfuente, acreedor y convenio, en el orden de su
 * ID correlativo. Así ningún número se repite. Ej.: «11211 0447 001 5.15 000 000000 01».
 */
export function numerarCuentasRegistro<T extends { idCorrelativo: string }>(cuentas: T[]): (T & { numero: string })[] {
  const usados = new Map<string, number>();
  const numeros = new Map<string, string>();
  for (const c of [...cuentas].sort((a, b) => a.idCorrelativo.localeCompare(b.idCorrelativo))) {
    const prefijo = prefijoCuentaRegistro(c.idCorrelativo);
    const sec = (usados.get(prefijo) ?? 0) + 1;
    usados.set(prefijo, sec);
    numeros.set(c.idCorrelativo, `${prefijo} ${String(sec).padStart(2, '0')}`);
  }
  return cuentas.map((c) => ({ ...c, numero: numeros.get(c.idCorrelativo)! }));
}

/** Código de un valor «2 - Instancias Descentralizadas» → «2». */
export function codigo(valor: string): string {
  return valor.split(' - ')[0];
}

/**
 * Un destino de la asignación debe tener la misma Fuente y Sub fuente que la cuenta de origen y, si el origen tiene
 * Concepto, el mismo Concepto (propuesta, duda 66 para la DGTP). Un origen sin concepto no restringe por concepto.
 * Sin origen, toda cuenta es compatible.
 */
export function mismaFuente(origen: string, destino: string): boolean {
  if (!origen) return true;
  const o = clasificacionDe(origen);
  const d = clasificacionDe(destino);
  return o.fuente === d.fuente && o.subfuente === d.subfuente && (!o.concepto || o.concepto === d.concepto);
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

/** Una parte del recurso como etiqueta codificada: «Concepto» · «1» · «Canon Minero». */
export interface ParteRecurso {
  rotulo: 'Fuente' | 'Sub fuente' | 'Concepto';
  codigo: string;
  nombre: string;
}

/** Fuente, sub fuente y concepto de la cuenta (los que tenga), para explicar por qué un destino es compatible. */
export function partesRecurso(idCorrelativo: string): ParteRecurso[] {
  const c = clasificacionDe(idCorrelativo);
  const parte = (rotulo: ParteRecurso['rotulo'], valor: string): ParteRecurso[] =>
    valor ? [{ rotulo, codigo: codigo(valor), nombre: valor.split(' - ').slice(1).join(' - ') }] : [];
  return [...parte('Fuente', c.fuente), ...parte('Sub fuente', c.subfuente), ...parte('Concepto', c.concepto)];
}

/** Recurso completo de la cuenta, con el concepto si lo tiene: «5 - … / 18 - … / 1 - Canon Minero». */
export function textoRecurso(idCorrelativo: string): string {
  const c = clasificacionDe(idCorrelativo);
  return [c.fuente, c.subfuente, c.concepto].filter(Boolean).join(' / ');
}



/** Valores del panel «Filtros»: vacío = sin filtrar. */
export interface FiltrosCuenta {
  /**
   * Búsqueda por texto en el nombre (descripción) de la cuenta de registro: «canon», «FONCOR». Es la alternativa
   * sugerida al Concepto; depende de cómo se escribió el nombre (genérico o abreviado, la cuenta no aparece).
   */
  descripcionFuente: string;
  fuente: string;
  subfuente: string;
  concepto: string;
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export const FILTROS_VACIOS: FiltrosCuenta = { descripcionFuente: '', fuente: '', subfuente: '', concepto: '', grupo: '', subgrupo: '', departamento: '', provincia: '', distrito: '' };

/** Texto en minúsculas y sin tildes, para comparar búsquedas. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Cumple los filtros elegidos (vacío = sin filtrar). La descripción se busca en el nombre de la cuenta de registro
 * (`nombre`; por defecto, el de prueba de su ID).
 */
export function cumpleFiltros(idCorrelativo: string, f: FiltrosCuenta, nombre = nombreCuentaRegistro(idCorrelativo)): boolean {
  const c = clasificacionDe(idCorrelativo);
  const texto = normalizar(f.descripcionFuente);
  if (texto && !normalizar(nombre).includes(texto)) return false;
  return (Object.keys(f) as (keyof FiltrosCuenta)[])
    .filter((campo) => campo !== 'descripcionFuente')
    .every((campo) => !f[campo] || c[campo as keyof ClasificacionCuenta] === f[campo]);
}

/** Campo que, al cambiar, limpia los que dependen de él. */
/** Sub grupo con el que se habilita la ubicación geográfica en los filtros de destino. */
export const SUBGRUPO_GOBIERNOS_LOCALES = '2 - Gobiernos Locales';

export const DEPENDIENTES: Partial<Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]>> = {
  fuente: ['subfuente', 'concepto'],
  subfuente: ['concepto'],
  grupo: ['subgrupo', 'departamento', 'provincia', 'distrito'],
  subgrupo: ['departamento', 'provincia', 'distrito'],
  departamento: ['provincia', 'distrito'],
  provincia: ['distrito'],
};

/** Campos de los que depende cada filtro: solo ellos acotan sus opciones. */
const PADRES: Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]> = {
  descripcionFuente: [],
  fuente: [],
  subfuente: ['fuente'],
  concepto: ['fuente', 'subfuente'],
  grupo: [],
  subgrupo: ['grupo'],
  departamento: ['subgrupo'],
  provincia: ['subgrupo', 'departamento'],
  distrito: ['subgrupo', 'departamento', 'provincia'],
};

/**
 * Opciones de un filtro: los valores de las cuentas del panel que cumplen sus campos padre (Sub fuente según Fuente, Concepto según Sub fuente, Sub grupo según Grupo;
 * Provincia y Distrito según la ubicación). Fuente, Grupo y Departamento muestran siempre todas sus opciones, aunque haya
 * otros filtros elegidos.
 */
export function opcionesFiltro(ids: string[], f: FiltrosCuenta, campo: keyof ClasificacionCuenta & keyof FiltrosCuenta): TextFieldOption[] {
  const cumplePadres = (id: string) => {
    const c = clasificacionDe(id);
    return PADRES[campo].every((padre) => !f[padre] || c[padre as keyof ClasificacionCuenta] === f[padre]);
  };
  const valores = new Set(ids.filter(cumplePadres).map((id) => clasificacionDe(id)[campo]).filter(Boolean));
  return [...valores].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).map((v) => ({ label: v, value: v }));
}
