/* Temporizador de turno: 80 segundos para jugar. Se dibuja como un anillo que se
 * vacía al lado de "Terminar turno"; en los últimos 10 segundos se pone rojo y
 * hace tic. Al llegar a cero, el turno termina solo. */
(function (raiz) {
  'use strict';
  const SEGUNDOS_TURNO = 80;
  const SEGUNDOS_AVISO = 10;
  const CADA_MS = 250;
  const REINTENTO_MS = 300;

  const r = { clave: null, fin: 0, id: null, ultimoSeg: null, alAgotarse: null };

  const restantes = () => Math.max(0, Math.ceil((r.fin - Date.now()) / 1000));

  function pintar() {
    const el = document.getElementById('reloj-turno');
    if (!el) return;
    if (!r.clave) { el.classList.add('oculto'); return; }
    const seg = restantes();
    el.classList.remove('oculto');
    el.classList.toggle('apurado', seg <= SEGUNDOS_AVISO);
    el.style.setProperty('--p', (seg / SEGUNDOS_TURNO).toFixed(3));
    const num = el.querySelector('.rt-num');
    if (num) num.textContent = String(seg);
  }

  function agotar() {
    const llamar = r.alAgotarse;
    if (!llamar) return;
    // Si hay una animación en curso, espera a que termine y vuelve a intentar.
    if (llamar() === false) setTimeout(agotar, REINTENTO_MS);
  }

  function tic() {
    const seg = restantes();
    if (seg !== r.ultimoSeg) {
      r.ultimoSeg = seg;
      if (seg > 0 && seg <= SEGUNDOS_AVISO && raiz.Sonido) raiz.Sonido.efecto('tic');
    }
    pintar();
    if (seg <= 0) {
      clearInterval(r.id);
      r.id = null;
      agotar();
    }
  }

  /**
   * Llamar en cada dibujado. `clave` identifica el turno (cambia cuando empieza
   * otro); con clave null el reloj se apaga. `alAgotarse` devuelve false si
   * todavía no pudo terminar el turno.
   */
  function actualizar(clave, alAgotarse) {
    r.alAgotarse = alAgotarse;
    if (clave !== r.clave) {
      clearInterval(r.id);
      r.id = null;
      r.clave = clave;
      r.ultimoSeg = null;
      if (clave) {
        r.fin = Date.now() + SEGUNDOS_TURNO * 1000;
        r.id = setInterval(tic, CADA_MS);
      }
    }
    pintar();
  }

  const html = () => `<div id="reloj-turno" class="reloj-turno oculto" title="Tiempo del turno">
    <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="rt-fondo" cx="18" cy="18" r="15.5"/><circle class="rt-arco" cx="18" cy="18" r="15.5" pathLength="100"/></svg>
    <span class="rt-num">${SEGUNDOS_TURNO}</span></div>`;

  raiz.RelojTurno = Object.freeze({ actualizar, html, SEGUNDOS_TURNO });
})(this);
