import type { TextFieldOption } from '../../../../shared/ui/text-field/text-field.component';

/**
 * Datos de prueba para filtrar las cuentas de registros en el panel de selección (Figma 789:67652): grupo, subgrupo y
 * ubicación geográfica. Se derivan del ID correlativo, así siempre dan lo mismo y no cambian la forma de `mock-db`.
 */
export interface ClasificacionCuenta {
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

const GRUPOS: { grupo: string; subgrupos: string[] }[] = [
  { grupo: 'Gobierno Nacional', subgrupos: ['Ministerios', 'Organismos públicos'] },
  { grupo: 'Gobierno Regional', subgrupos: ['Sedes regionales', 'Unidades ejecutoras'] },
  { grupo: 'Gobierno Local', subgrupos: ['Municipalidades provinciales', 'Municipalidades distritales'] },
];

const UBICACIONES = Object.entries(UBIGEO).flatMap(([departamento, provincias]) =>
  Object.entries(provincias).flatMap(([provincia, distritos]) => distritos.map((distrito) => ({ departamento, provincia, distrito }))),
);

/** Clasificación de prueba de una cuenta de registros, fija para su ID correlativo. */
export function clasificacionDe(idCorrelativo: string): ClasificacionCuenta {
  const n = Number(idCorrelativo) || 0;
  const { grupo, subgrupos } = GRUPOS[n % GRUPOS.length];
  return { grupo, subgrupo: subgrupos[Math.floor(n / GRUPOS.length) % subgrupos.length], ...UBICACIONES[(n * 7) % UBICACIONES.length] };
}

/** Valores del panel «Filtros»: vacío = sin filtrar. */
export interface FiltrosCuenta {
  grupo: string;
  subgrupo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export const FILTROS_VACIOS: FiltrosCuenta = { grupo: '', subgrupo: '', departamento: '', provincia: '', distrito: '' };

const contiene = (valor: string, buscado: string) => !buscado.trim() || valor.toLowerCase().includes(buscado.trim().toLowerCase());

/** Grupo y subgrupo por texto; la ubicación, exacta. */
export function cumpleFiltros(idCorrelativo: string, f: FiltrosCuenta): boolean {
  const c = clasificacionDe(idCorrelativo);
  return contiene(c.grupo, f.grupo) && contiene(c.subgrupo, f.subgrupo)
    && (!f.departamento || c.departamento === f.departamento)
    && (!f.provincia || c.provincia === f.provincia)
    && (!f.distrito || c.distrito === f.distrito);
}

const opciones = (valores: string[]): TextFieldOption[] => valores.map((v) => ({ label: v, value: v }));

export const opcionesDepartamento = (): TextFieldOption[] => opciones(Object.keys(UBIGEO));
export const opcionesProvincia = (departamento: string): TextFieldOption[] => opciones(Object.keys(UBIGEO[departamento] ?? {}));
export const opcionesDistrito = (departamento: string, provincia: string): TextFieldOption[] => opciones(UBIGEO[departamento]?.[provincia] ?? []);
