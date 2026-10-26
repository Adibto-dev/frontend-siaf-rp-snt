import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeViewComponent, TreeViewNode } from './tree-view.component';

const NODOS: TreeViewNode[] = [
  {
    id: 'a',
    label: 'Contabilidad',
    expanded: true,
    children: [
      { id: 'a1', label: 'Plan de cuentas' },
      { id: 'a2', label: 'Próximamente', disabled: true },
    ],
  },
  { id: 'b', label: 'Tesorería', icon: 'folder_open', children: [{ id: 'b1', label: 'Cuentas bancarias' }] },
];

describe('TreeViewComponent', () => {
  let fixture: ComponentFixture<TreeViewComponent>;
  let activados: string[];

  const el = (): HTMLElement => fixture.nativeElement;
  const item = (id: string): HTMLElement => el().querySelector(`[data-tree-id="${id}"]`)!;
  const fila = (id: string): HTMLElement => item(id).querySelector('.siaf-tree-row')!;
  const visibles = (): string[] => Array.from(el().querySelectorAll<HTMLElement>('[role="treeitem"]')).map((i) => i.dataset['treeId']!);
  const tecla = async (key: string): Promise<void> => {
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TreeViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(TreeViewComponent);
    fixture.componentRef.setInput('nodes', NODOS);
    fixture.componentRef.setInput('ariaLabel', 'Procesos');
    activados = [];
    fixture.componentInstance.nodeActivated.subscribe((n) => activados.push(n.id));
    fixture.detectChanges();
    document.body.appendChild(el());
  });

  afterEach(() => el().remove());

  it('es un árbol con nivel, posición y aria-expanded; solo la rama abierta muestra sus hijos', () => {
    expect(el().querySelector('[role="tree"]')!.getAttribute('aria-label')).toBe('Procesos');
    expect(visibles()).toEqual(['a', 'a1', 'a2', 'b']);
    expect(item('a').getAttribute('aria-expanded')).toBe('true');
    expect(item('b').getAttribute('aria-expanded')).toBe('false');
    expect(item('a1').getAttribute('aria-expanded')).toBeNull();
    expect(item('a1').getAttribute('aria-level')).toBe('2');
    expect(item('a2').getAttribute('aria-posinset')).toBe('2');
    expect(item('a2').getAttribute('aria-setsize')).toBe('2');
    expect(item('a2').getAttribute('aria-disabled')).toBe('true');
    expect(item('a').querySelector('[role="group"]')).not.toBeNull();
  });

  it('ítem del Figma: flecha arrow_right de 20 px, 8 px de relleno, radio de 4 px y Body 2', () => {
    const flecha = item('a').querySelector('siaf-icon')!;
    expect(flecha.textContent!.trim()).toBe('arrow_right');
    expect(Math.round(flecha.getBoundingClientRect().width)).toBe(20);
    const estilo = getComputedStyle(fila('a1'));
    expect(estilo.paddingLeft).toBe('8px');
    expect(estilo.borderTopLeftRadius).toBe('4px');
    expect(fila('a1').querySelector('span:last-child')!.classList).toContain('siaf-text-body-2');
    expect(item('b').querySelectorAll('siaf-icon').length).withContext('flecha + ícono propio').toBe(2);
  });

  it('un solo punto de Tab: el primero, o el elegido si hay uno', () => {
    expect(visibles().filter((id) => item(id).tabIndex === 0)).toEqual(['a']);
    fixture.componentRef.setInput('selectedId', 'a1');
    fixture.detectChanges();
    expect(visibles().filter((id) => item(id).tabIndex === 0)).toEqual(['a1']);
  });

  it('el elegido va activado: aria-selected, capa activated y texto en negrita', () => {
    fixture.componentRef.setInput('selectedId', 'a1');
    fixture.detectChanges();
    expect(item('a1').getAttribute('aria-selected')).toBe('true');
    expect(fila('a1').classList).toContain('siaf-tree-row--activado');
    expect(fila('a1').querySelector('span:last-child')!.classList).toContain('siaf-text-body-2-bold');
    expect(getComputedStyle(fila('a1').querySelector('span:last-child')!).fontWeight).toBe('700');
    expect(getComputedStyle(fila('a').querySelector('span:last-child')!).fontWeight).toBe('400');
  });

  it('flechas: ↓ ↑ recorren lo visible, → abre y entra, ← cierra y sube, Inicio / Fin', async () => {
    item('a').focus();
    await tecla('ArrowDown');
    expect(document.activeElement).toBe(item('a1'));
    await tecla('ArrowLeft');
    expect(document.activeElement).withContext('← en una hoja sube al padre').toBe(item('a'));
    await tecla('ArrowLeft');
    expect(visibles()).withContext('← en una rama abierta la cierra').toEqual(['a', 'b']);
    await tecla('End');
    expect(document.activeElement).toBe(item('b'));
    await tecla('ArrowRight');
    expect(visibles()).toEqual(['a', 'b', 'b1']);
    await tecla('ArrowRight');
    expect(document.activeElement).toBe(item('b1'));
    await tecla('Home');
    expect(document.activeElement).toBe(item('a'));
    await tecla('ArrowUp');
    expect(document.activeElement).toBe(item('a'));
  });

  it('Enter y clic eligen; un nodo deshabilitado no emite', async () => {
    item('a1').focus();
    await tecla('Enter');
    expect(activados).toEqual(['a1']);
    expect(item('a1').getAttribute('aria-selected')).toBe('true');

    item('a2').click();
    fixture.detectChanges();
    expect(activados).toEqual(['a1']);
    expect(item('a2').getAttribute('aria-selected')).toBeNull();
  });

  it('expandAll abre todas las ramas y no deja cerrarlas; las ramas recuerdan su estado al cambiar los nodos', () => {
    fixture.componentRef.setInput('expandAll', true);
    fixture.detectChanges();
    expect(visibles()).toEqual(['a', 'a1', 'a2', 'b', 'b1']);
    item('a').click();
    fixture.detectChanges();
    expect(visibles()).toContain('a1');

    fixture.componentRef.setInput('expandAll', false);
    fixture.componentRef.setInput('nodes', [...NODOS]);
    fixture.detectChanges();
    expect(visibles()).toEqual(['a', 'a1', 'a2', 'b']);
  });
});
