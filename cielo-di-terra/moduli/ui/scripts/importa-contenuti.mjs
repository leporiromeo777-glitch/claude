// Copia nella demo una fotografia dei contenuti veri (content/*.json del design), così la demo resta
// autonoma anche quando il modulo verrà spostato. Uso: npm run importa-contenuti [-- <cartella content>]
// Predefinita: ../../content rispetto al modulo.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const modulo = path.resolve(qui, '..');
const sorgente = path.resolve(modulo, process.argv[2] ?? '../../content');
const destinazione = path.join(modulo, 'demo', 'contenuti');

const FILE = ['testi.json', 'taccuino.json', 'capisaldi.json', 'luoghi.json', 'personaggi.json', 'dialoghi.json', 'fade_fase1.json'];
/** Di fade_fase1.json servono solo le particelle, gli elementi mobili e il resoconto. */
const FILTRI = {
  'fade_fase1.json': (d) => ({ _nota: d._nota, griglia: d.griglia, particelle: d.particelle, elementi_mobili: d.elementi_mobili, resoconto_del_mattino: d.resoconto_del_mattino }),
};

await mkdir(destinazione, { recursive: true });
let copiati = 0;
for (const f of FILE) {
  try {
    const dati = JSON.parse(await readFile(path.join(sorgente, f), 'utf8'));
    const ridotti = FILTRI[f] ? FILTRI[f](dati) : dati;
    await writeFile(path.join(destinazione, f), JSON.stringify(ridotti, null, 1) + '\n');
    copiati++;
    console.log('copiato', f);
  } catch (err) {
    console.warn('manca o non si legge', f, '-', err.message);
  }
}
console.log(`${copiati} file in ${path.relative(modulo, destinazione)}`);
