import type { TextFieldOption } from '../../../../shared/ui/text-field/text-field.component';

/**
 * Datos de prueba para filtrar las cuentas de registros en el panel de selección (Figma 789:67652): fuente y subfuente
 * (panel de origen), grupo, subgrupo y ubicación geográfica (panel de destino). Se derivan del ID correlativo, así siempre dan lo mismo y no cambian la forma de `mock-db`.
 */
export interface ClasificacionCuenta {
  fuente: string;
  subfuente: string;
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
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
 * Grupo y subgrupo del Clasificador Institucional v1.4 (subsector 1 Gobierno General), según
 * `02-analisis/clasificador-institucional.md` del análisis funcional del 2.10.6.6.
 */
const GRUPOS: { grupo: string; subgrupos: string[] }[] = [
  { grupo: '1 - Gobierno Central', subgrupos: ['1 - Gobierno Nacional', '2 - Fondo de Seguridad Social', '3 - Extrapresupuestario'] },
  {
    grupo: '2 - Instancias Descentralizadas',
    subgrupos: [
      '1 - Gobierno Regional',
      '2 - Gobierno Local',
      '3 - Organismos públicos de los gob. regionales y locales',
      '4 - Empresas públicas de los gob. regionales y locales',
    ],
  },
];

/**
 * Fuente de financiamiento y subfuente (rubro del Anexo 4 del MEF, 2026), según `02-analisis/fuentes-financiamiento.md`.
 */
const FUENTES: { fuente: string; subfuente: string }[] = [
  { fuente: '1 - Recursos Ordinarios', subfuente: '00 - Recursos Ordinarios' },
  { fuente: '2 - Recursos Directamente Recaudados', subfuente: '09 - Recursos Directamente Recaudados' },
  { fuente: '3 - Recursos por Operaciones Oficiales de Crédito', subfuente: '19 - Recursos por Operaciones Oficiales de Crédito' },
  { fuente: '4 - Donaciones y Transferencias', subfuente: '13 - Donaciones y Transferencias' },
  { fuente: '5 - Recursos Determinados', subfuente: '04 - Contribuciones a Fondos' },
  { fuente: '5 - Recursos Determinados', subfuente: '07 - Fondo de Compensación Municipal' },
  { fuente: '5 - Recursos Determinados', subfuente: '08 - Impuestos Municipales' },
  { fuente: '5 - Recursos Determinados', subfuente: '15 - Fondo de Compensación Regional (FONCOR)' },
  { fuente: '5 - Recursos Determinados', subfuente: '18 - Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones' },
];

/** Cada par grupo / subgrupo del clasificador, para repartirlos entre las cuentas. */
const PARES = GRUPOS.flatMap(({ grupo, subgrupos }) => subgrupos.map((subgrupo) => ({ grupo, subgrupo })));

const UBICACIONES = Object.entries(UBIGEO).flatMap(([departamento, provincias]) =>
  Object.entries(provincias).flatMap(([provincia, distritos]) => distritos.map((distrito) => ({ departamento, provincia, distrito }))),
);

/** Clasificación de prueba de una cuenta de registros, fija para su ID correlativo. */
export function clasificacionDe(idCorrelativo: string): ClasificacionCuenta {
  const n = Number(idCorrelativo) || 0;
  return { ...FUENTES[(n * 5) % FUENTES.length], ...PARES[n % PARES.length], ...UBICACIONES[(n * 7) % UBICACIONES.length] };
}

/** Valores del panel «Filtros»: vacío = sin filtrar. */
export interface FiltrosCuenta {
  fuente: string;
  subfuente: string;
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export const FILTROS_VACIOS: FiltrosCuenta = { fuente: '', subfuente: '', grupo: '', subgrupo: '', departamento: '', provincia: '', distrito: '' };

/** Cumple los filtros elegidos (vacío = sin filtrar). */
export function cumpleFiltros(idCorrelativo: string, f: FiltrosCuenta): boolean {
  const c = clasificacionDe(idCorrelativo);
  return (Object.keys(f) as (keyof FiltrosCuenta)[]).every((campo) => !f[campo] || c[campo] === f[campo]);
}

/** Campo que, al cambiar, limpia los que dependen de él. */
export const DEPENDIENTES: Partial<Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]>> = {
  fuente: ['subfuente'],
  grupo: ['subgrupo'],
  departamento: ['provincia', 'distrito'],
  provincia: ['distrito'],
};

/** Campos de los que depende cada filtro: solo ellos acotan sus opciones. */
const PADRES: Record<keyof FiltrosCuenta, (keyof FiltrosCuenta)[]> = {
  fuente: [],
  subfuente: ['fuente'],
  grupo: [],
  subgrupo: ['grupo'],
  departamento: [],
  provincia: ['departamento'],
  distrito: ['departamento', 'provincia'],
};

/**
 * Opciones de un filtro: los valores de las cuentas del panel que cumplen sus campos padre (Sub fuente según Fuente, Sub grupo según Grupo;
 * Provincia y Distrito según la ubicación). Fuente, Grupo y Departamento muestran siempre todas sus opciones, aunque haya
 * otros filtros elegidos.
 */
export function opcionesFiltro(ids: string[], f: FiltrosCuenta, campo: keyof FiltrosCuenta): TextFieldOption[] {
  const cumplePadres = (id: string) => {
    const c = clasificacionDe(id);
    return PADRES[campo].every((padre) => !f[padre] || c[padre] === f[padre]);
  };
  const valores = new Set(ids.filter(cumplePadres).map((id) => clasificacionDe(id)[campo]));
  return [...valores].sort((a, b) => a.localeCompare(b, 'es')).map((v) => ({ label: v, value: v }));
}
