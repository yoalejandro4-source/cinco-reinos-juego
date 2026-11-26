/* Lupa de cartas en la batalla: mantené apretada una carta (mano o mesa, tuya o del
 * rival) y aparece grande al costado, con sus palabras clave explicadas. En la PC
 * también sirve el clic derecho sostenido o pasar el mouse (el inspector de siempre). */
(function (raiz) {
  'use strict';
  const { UI, Render: R, Datos: D, Motor: M } = raiz;
  if (!UI || !R) return;

  const MANTENER_MS = 380;      // cuánto hay que sostener el dedo
  const TOLERANCIA_PX = 12;     // si el dedo se mueve más, es un deslizamiento, no una lupa
  const TRAGAR_CLIC_MS = 700;   // el toque que abrió la lupa no juega la carta
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let presion = null;
  let abiertaEn = 0;

  function clavesDe(c) {
    const lista = (c.claves || []).filter((k) => D.CLAVES[k]);
    if (!lista.length) return '';
    return `<ul class="lupa-claves">${lista.map((k) => `<li><b>${D.CLAVES[k].icono} ${esc(D.CLAVES[k].nombre)}</b> ${esc(D.CLAVES[k].desc)}</li>`).join('')}</ul>`;
  }

  /** Muestra la carta grande del lado contrario a `xToque` (para no tapar lo que se mira). */
  function mostrar(carta, xToque) {
    if (!carta) return;
    ocultar();
    const lado = typeof xToque === 'number' && xToque > raiz.innerWidth / 2 ? 'izq' : 'der';
    const fondo = document.createElement('div');
    fondo.id = 'lupa-fondo';
    fondo.addEventListener('pointerdown', ocultar);
    const caja = document.createElement('div');
    caja.id = 'lupa';
    caja.className = lado;
    caja.innerHTML = `<div class="lupa-carta">${R.htmlCarta(carta, { grande: true })}</div>${clavesDe(carta)}<p class="lupa-cerrar">Tocá en cualquier lado para cerrar</p>`;
    caja.addEventListener('pointerdown', ocultar);
    document.body.append(fondo, caja);
    abiertaEn = Date.now();
  }

  function ocultar() {
    ['lupa', 'lupa-fondo'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
  }

  /** Qué carta hay debajo del dedo (mano propia o unidades de la mesa). */
  function cartaBajo(el) {
    const s = UI.estado.estado;
    if (!s || !el) return null;
    const enMano = el.closest('.mano .carta');
    if (enMano) return s.jugadores[0].mano[Number(enMano.dataset.mano)] || null;
    const ficha = el.closest('.ficha');
    if (ficha && M) return M.unidadPorRef(s, { jIdx: Number(ficha.dataset.lado), uid: ficha.dataset.uid });
    return null;
  }

  const app = document.getElementById('app');
  app.addEventListener('pointerdown', (e) => {
    if (UI.estado.pantalla !== 'batalla') return;
    const carta = cartaBajo(e.target);
    if (!carta) return;
    const x = e.clientX;
    const y = e.clientY;
    clearTimeout(presion && presion.reloj);
    presion = { x, y, reloj: setTimeout(() => { presion = null; mostrar(carta, x); }, MANTENER_MS) };
  });
  const soltar = () => { if (presion) { clearTimeout(presion.reloj); presion = null; } };
  app.addEventListener('pointerup', soltar);
  app.addEventListener('pointercancel', soltar);
  app.addEventListener('pointermove', (e) => {
    if (presion && Math.hypot(e.clientX - presion.x, e.clientY - presion.y) > TOLERANCIA_PX) soltar();
  });
  // El clic que sigue a sostener el dedo no debe jugar la carta ni atacar.
  app.addEventListener('click', (e) => {
    if (Date.now() - abiertaEn < TRAGAR_CLIC_MS) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  raiz.Lupa = Object.freeze({ mostrar, ocultar });
})(this);
