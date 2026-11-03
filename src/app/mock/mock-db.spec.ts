import { renombrarUsuarios } from './mock-db';

describe('mock-db', () => {
  describe('renombrarUsuarios (datos guardados con los nombres anteriores de la demo)', () => {
    it('cambia el nombre de quien firmó, sin tocar lo demás', () => {
      const guardado = { id: 'sol-1', creador: { id: 'usr-ana', nombres: 'Ana', apellidoPaterno: 'Torres', apellidoMaterno: 'Díaz' } };
      expect(renombrarUsuarios(guardado)).toEqual({
        id: 'sol-1',
        creador: { id: 'usr-ana', nombres: 'Victoria', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Paredes' },
      });
    });

    it('cambia el nombre completo dentro de los textos (también en mayúsculas)', () => {
      expect(renombrarUsuarios(['Aprobado por Luis Ramírez Soto', 'ROSA QUISPE HUAMÁN'])).toEqual([
        'Aprobado por Mateo Flores Gutiérrez',
        'SANTIAGO CASTILLO VARGAS',
      ]);
    });

    it('deja igual a quien no cambió de nombre', () => {
      const sistema = { nombres: 'SIAF RP', apellidoPaterno: '', apellidoMaterno: '' };
      expect(renombrarUsuarios(sistema)).toEqual(sistema);
    });

    it('cambia también a la usuaria oculta de dos perfiles', () => {
      expect(renombrarUsuarios({ nombres: 'Carla', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Ríos' })).toEqual({
        nombres: 'Ariana', apellidoPaterno: 'Ramírez', apellidoMaterno: 'Vega',
      });
    });
  });
});
