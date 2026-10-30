import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';

import { PdfViewerComponent } from '../../../../../shared/ui/pdf-viewer/pdf-viewer.component';
import { archivoDeSustento, type SaldoConSustento } from '../../utils/sustento-pdf.util';

/**
 * Documento de sustento de un saldo inicial en el visor de PDF. Se abre al recibir un saldo con sustento y muestra el
 * archivo subido (o el `File` recién elegido, si se pasa en `archivo`); si no hay archivo guardado, el PDF de ejemplo.
 */
@Component({
  selector: 'siaf-saldo-sustento-visor',
  standalone: true,
  imports: [PdfViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <siaf-pdf-viewer [open]="abierto()" [fileName]="nombre()" [source]="pdf()" (closed)="cerrar()" />
  `,
})
export class SustentoVisorComponent {
  /** Archivo recién elegido en el formulario (todavía sin guardar). */
  @Input() archivo: Blob | null = null;
  /** Saldo cuyo sustento se ve; `null` cierra el visor. */
  @Input() set saldo(valor: SaldoConSustento | null) {
    const turno = ++this.turno;
    this.pdf.set(null);
    this.abierto.set(!!valor?.sustento);
    if (!valor?.sustento) return;
    this.nombre.set(valor.sustento);
    void archivoDeSustento(valor, this.archivo).then((pdf) => {
      if (turno === this.turno) this.pdf.set(pdf);
    });
  }

  @Output() closed = new EventEmitter<void>();

  readonly abierto = signal(false);
  readonly nombre = signal('');
  readonly pdf = signal<Blob | null>(null);
  private turno = 0;

  cerrar(): void {
    this.abierto.set(false);
    this.closed.emit();
  }
}
