/**
 * Filtri SVG condivisi (bordi sfrangiati della carta, tratto a matita).
 * Si inseriscono una volta sola per documento, in un <svg> invisibile dentro la radice.
 */
const ID_CONTENITORE = 'ui-filtri-svg';

export function assicuraFiltri(radice: HTMLElement): void {
  const doc = radice.ownerDocument;
  if (doc.getElementById(ID_CONTENITORE)) return;
  const div = doc.createElement('div');
  div.innerHTML = `
<svg id="${ID_CONTENITORE}" width="0" height="0" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <!-- Bordo di carta sfrangiato: il disegno del foglio viene spostato da un rumore a bassa frequenza. -->
    <filter id="ui-f-bordo" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="11" result="rumore"/>
      <feDisplacementMap in="SourceGraphic" in2="rumore" scale="9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <!-- Bordo più fine, per i cartellini e le etichette piccole. -->
    <filter id="ui-f-bordo-fine" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="5" result="rumore"/>
      <feDisplacementMap in="SourceGraphic" in2="rumore" scale="4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <!-- Tratto a matita: contorni che tremano un poco e grana di grafite. -->
    <filter id="ui-f-matita" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="grana"/>
      <feDisplacementMap in="SourceGraphic" in2="grana" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="mosso"/>
      <feComposite in="mosso" in2="grana" operator="in"/>
    </filter>
  </defs>
</svg>`;
  const svg = div.firstElementChild;
  if (svg) radice.append(svg);
}
