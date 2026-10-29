import { contieneTodas, palabrasDeBusqueda, tramosResaltados } from './resaltado-busqueda.util';

describe('resaltado-busqueda.util', () => {
  it('separa la búsqueda en palabras normalizadas, sin repetir', () => {
    expect(palabrasDeBusqueda('  Saldos  INICIALES saldos ')).toEqual(['saldos', 'iniciales']);
    expect(palabrasDeBusqueda('   ')).toEqual([]);
  });

  it('no busca con menos de 3 letras', () => {
    expect(palabrasDeBusqueda('s')).toEqual([]);
    expect(palabrasDeBusqueda(' sa ')).toEqual([]);
    expect(palabrasDeBusqueda('sal')).toEqual(['sal']);
  });

  it('ignora conectores y palabras de 1 o 2 letras; solo conectores no busca', () => {
    expect(palabrasDeBusqueda('saldos de li')).toEqual(['saldos']);
    expect(palabrasDeBusqueda('saldos de libro')).toEqual(['saldos', 'libro']);
    expect(palabrasDeBusqueda('cuentas para la entidad')).toEqual(['cuentas', 'entidad']);
    expect(palabrasDeBusqueda('de la')).toEqual([]);
    expect(palabrasDeBusqueda('para con')).toEqual([]);
  });

  it('coincide si están todas las palabras, en cualquier orden y sin importar tildes', () => {
    const etiqueta = 'Registro de saldos iniciales en libro bancos';
    expect(contieneTodas(etiqueta, palabrasDeBusqueda('libro saldos'))).toBeTrue();
    expect(contieneTodas(etiqueta, palabrasDeBusqueda('saldos caja'))).toBeFalse();
    expect(contieneTodas('Gestión de tesorería', palabrasDeBusqueda('gestion TESORERIA'))).toBeTrue();
  });

  it('marca cada palabra conservando el texto original', () => {
    expect(tramosResaltados('Documentos de saldos iniciales', palabrasDeBusqueda('Saldos Iniciales'))).toEqual([
      { texto: 'Documentos de ', marca: false },
      { texto: 'saldos', marca: true },
      { texto: ' ', marca: false },
      { texto: 'iniciales', marca: true },
    ]);
    expect(tramosResaltados('Gestión de tesorería', ['gestion'])).toEqual([
      { texto: 'Gestión', marca: true },
      { texto: ' de tesorería', marca: false },
    ]);
  });

  it('une tramos que se superponen y marca todas las apariciones', () => {
    expect(tramosResaltados('banco bancos', ['banc', 'anco'])).toEqual([
      { texto: 'banco', marca: true },
      { texto: ' ', marca: false },
      { texto: 'banco', marca: true },
      { texto: 's', marca: false },
    ]);
  });

  it('sin palabras devuelve el texto entero sin marcar', () => {
    expect(tramosResaltados('Tesorería', [])).toEqual([{ texto: 'Tesorería', marca: false }]);
  });
});
