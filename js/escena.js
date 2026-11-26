/* Escena de diálogo (Modo Aventura): retrato grande del personaje, cartel con su
 * nombre y el texto letra por letra. Si existe audio/voces/<id>.webm, se escucha la
 * voz grabada (y la música baja mientras habla). Tocar avanza; "Saltar" termina. */
(function (raiz) {
  'use strict';
  const LETRA_MS = 26;            // velocidad del texto
  const MUSICA_BAJA = 0.3;        // la música baja a este volumen mientras alguien habla
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let voz = null;
  function callarVoz() { if (voz) { voz.pause(); voz = null; } }
  function hablar(id) {
    callarVoz();
    if (typeof Audio === 'undefined') return;
    const a = new Audio(`audio/voces/${id}.webm`);
    const ajustes = raiz.Ajustes ? raiz.Ajustes.actual() : { efectos: 1 };
    a.volume = Math.min(1, ajustes.efectos === undefined ? 1 : ajustes.efectos);
    a.play().catch(() => {}); // si todavía no grabaron esa línea, no pasa nada
    voz = a;
  }

  function bajarMusica(si) {
    if (!raiz.Sonido || !raiz.Ajustes) return;
    const m = raiz.Ajustes.actual().musica;
    raiz.Sonido.volumenes(si ? m * MUSICA_BAJA : m, undefined);
  }

  /**
   * Muestra una serie de líneas y resuelve cuando terminan.
   * personaje: { nombre, retrato (url) } del rival; jugador: { nombre }.
   */
  function reproducir(lineas, personaje, jugador) {
    if (!lineas || !lineas.length) return Promise.resolve();
    return new Promise((terminarEscena) => {
      const capa = document.createElement('div');
      capa.id = 'escena';
      capa.innerHTML = `<div class="es-fondo" style="${personaje.retrato ? `background-image:url('${personaje.retrato}')` : ''}"></div>
        <button class="es-saltar" type="button">Saltar ⏭</button>
        <div class="es-retrato" style="${personaje.retrato ? `background-image:url('${personaje.retrato}')` : ''}"></div>
        <div class="es-caja"><div class="es-nombre"></div><p class="es-texto"></p><span class="es-seguir">▶</span></div>`;
      document.body.appendChild(capa);
      bajarMusica(true);
      let i = -1;
      let escribiendo = null;
      let completo = '';

      function fin() {
        clearInterval(escribiendo);
        callarVoz();
        bajarMusica(false);
        capa.classList.add('saliendo');
        setTimeout(() => { capa.remove(); terminarEscena(); }, 250);
      }

      function mostrarTodo() {
        clearInterval(escribiendo);
        escribiendo = null;
        capa.querySelector('.es-texto').textContent = completo;
        capa.classList.add('listo');
      }

      function siguiente() {
        i += 1;
        if (i >= lineas.length) { fin(); return; }
        const l = lineas[i];
        capa.classList.remove('listo');
        capa.dataset.quien = l.quien;
        const nombre = l.quien === 'rival' ? personaje.nombre : (l.quien === 'heroe' ? (jugador && jugador.nombre) || 'Vos' : '📜 Narrador');
        capa.querySelector('.es-nombre').innerHTML = esc(nombre);
        completo = l.texto;
        const caja = capa.querySelector('.es-texto');
        caja.textContent = '';
        let n = 0;
        clearInterval(escribiendo);
        escribiendo = setInterval(() => {
          n += 1;
          caja.textContent = completo.slice(0, n);
          if (n >= completo.length) mostrarTodo();
        }, LETRA_MS);
        hablar(l.id);
        if (raiz.Sonido && l.quien !== 'narrador') raiz.Sonido.efecto('voltear');
      }

      capa.addEventListener('click', (e) => {
        if (e.target.closest('.es-saltar')) { fin(); return; }
        if (escribiendo) mostrarTodo(); else siguiente();
      });
      siguiente();
    });
  }

  raiz.Escena = Object.freeze({ reproducir });
})(this);
