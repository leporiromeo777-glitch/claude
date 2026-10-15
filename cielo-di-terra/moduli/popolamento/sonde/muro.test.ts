import { test } from 'vitest';
import { creaMuroSecco } from '../../oggetti/src/oggetti/muri';
import { misura } from '../../oggetti/src/misure';

test('muro', () => {
  for (const det of ['alto', 'basso'] as const) for (const pietra of [0.5, 0.62, 0.8]) {
    const m = creaMuroSecco({ percorso: [[0, 0], [6, 0]], altezza: 3.2, terrapieno: true, dettaglio: det, pietra, spessore: 0.7 });
    console.log(det, pietra, 'tri/m', (misura(m.gruppo).triangoli / 6).toFixed(0));
  }
});
