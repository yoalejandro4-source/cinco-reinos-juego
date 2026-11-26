/* Arrastrar una carta de la mano al tablero para jugarla (con el dedo o el mouse).
 * Si la carta necesita objetivo, al soltarla queda elegida y se marca a quién apuntar.
 * Convive con la lupa (mantener apretado sin mover) y con el toque normal. */
(function (raiz) {
  'use strict';
  const { UI } = raiz;
  if (!UI) return;

  const UMBRAL_PX = 14;          // cuánto hay que mover para que sea arrastre
  const TRAGAR_CLIC_MS = 400;    // el clic que sigue a soltar no hace nada más
  const app = document.getElementById('app');
  let arr = null;                // { i, origen, fantasma, x0, y0, dx, dy, activo }
  let soltadoEn = 0;

  const zona = () => app.querySelector('.mesa-propia');
  function sobreZona(x, y) {
    const z = zona();
    if (!z) return false;
    const r = z.getBoundingClientRect();
    // También vale soltarla sobre la mesa del rival o en el medio: lo que no vale es volver a la mano.
    const mano = app.querySelector('.mano');
    const limite = mano ? mano.getBoundingClientRect().top : r.bottom;
    return y < limite - 8 && x > 0 && x < raiz.innerWidth;
  }

  function empezar(e) {
    const carta = e.target.closest && e.target.closest('.mano .carta');
    if (!carta || UI.estado.pantalla !== 'batalla' || !UI.puedoJugar()) return;
    arr = { i: Number(carta.dataset.mano), origen: carta, x0: e.clientX, y0: e.clientY, activo: false, id: e.pointerId };
  }

  function mover(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const dx = e.clientX - arr.x0;
    const dy = e.clientY - arr.y0;
    if (!arr.activo) {
      if (Math.hypot(dx, dy) < UMBRAL_PX || dy > 0) return; // hay que tirar hacia arriba
      arr.activo = true;
      const r = arr.origen.getBoundingClientRect();
      const f = arr.origen.cloneNode(true);
      f.classList.add('carta-arrastrada');
      Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(f);
      arr.fantasma = f;
      arr.origen.classList.add('levantada');
      if (raiz.Lupa) raiz.Lupa.ocultar();
      UI.sonar('tela');
    }
    e.preventDefault();
    arr.fantasma.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-12, Math.min(12, dx / 12))}deg) scale(1.12)`;
    const z = zona();
    if (z) z.classList.toggle('zona-soltar', sobreZona(e.clientX, e.clientY));
  }

  function terminar(e) {
    if (!arr || (e && e.pointerId !== arr.id)) return;
    const a = arr;
    arr = null;
    const z = zona();
    if (z) z.classList.remove('zona-soltar');
    if (!a.activo) return;
    soltadoEn = Date.now();
    const jugar = e && e.type === 'pointerup' && sobreZona(e.clientX, e.clientY);
    a.origen.classList.remove('levantada');
    if (jugar) {
      a.fantasma.remove();
      UI.jugarArrastrada(a.i);
      return;
    }
    // No llegó al tablero: vuelve a la mano
    const vuelta = a.fantasma.animate([{ transform: a.fantasma.style.transform }, { transform: 'translate(0,0) scale(1)' }], { duration: 180, easing: 'ease-out' });
    vuelta.finished.then(() => a.fantasma.remove()).catch(() => a.fantasma.remove());
  }

  app.addEventListener('pointerdown', empezar);
  window.addEventListener('pointermove', mover, { passive: false });
  window.addEventListener('pointerup', terminar);
  window.addEventListener('pointercancel', terminar);
  app.addEventListener('click', (e) => {
    if (Date.now() - soltadoEn < TRAGAR_CLIC_MS) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  raiz.Arrastre = Object.freeze({ arrastrando: () => !!(arr && arr.activo) });
})(this);
