/* Ajustes del juego: volumen de música y efectos, portada animada o estática,
 * rendimiento (automático, liviano o completo) y cerrar el juego. Se guardan en
 * el dispositivo y el panel se abre con el botón ⚙️. */
(function (raiz) {
  'use strict';
  const CLAVE = 'cinco-reinos-ajustes';
  const POR_DEFECTO = Object.freeze({ musica: 0.8, efectos: 0.9, portada: 'animada', rendimiento: 'auto', servidor: '' });
  const PORTADAS = ['animada', 'estatica'];
  const RENDIMIENTOS = ['auto', 'liviano', 'completo'];
  const ESPERA_CIERRE_MS = 400;
  const tactil = !!(raiz.matchMedia && raiz.matchMedia('(pointer: coarse)').matches);

  function leer() {
    try {
      const d = JSON.parse(raiz.localStorage.getItem(CLAVE) || '{}');
      const num = (v, def) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : def);
      return {
        musica: num(d.musica, POR_DEFECTO.musica),
        efectos: num(d.efectos, POR_DEFECTO.efectos),
        portada: PORTADAS.includes(d.portada) ? d.portada : POR_DEFECTO.portada,
        rendimiento: RENDIMIENTOS.includes(d.rendimiento) ? d.rendimiento : POR_DEFECTO.rendimiento,
        servidor: typeof d.servidor === 'string' ? d.servidor.slice(0, 200) : '',
      };
    } catch (e) {
      return { ...POR_DEFECTO };
    }
  }

  let actual = leer();

  function guardar() {
    try { raiz.localStorage.setItem(CLAVE, JSON.stringify(actual)); } catch (e) { /* sin almacenamiento: queda en memoria */ }
  }

  function aplicar() {
    if (raiz.Sonido) raiz.Sonido.volumenes(actual.musica, actual.efectos);
    const html = document.documentElement;
    html.classList.toggle('portada-estatica', actual.portada === 'estatica');
    const liviano = actual.rendimiento === 'liviano' || (actual.rendimiento === 'auto' && tactil);
    html.classList.toggle('liviano', liviano);
  }

  function cambiar(cambios) {
    actual = { ...actual, ...cambios };
    guardar();
    aplicar();
    return actual;
  }

  /** Cierra el juego: en la APK con el puente de Android; en la PC cierra la ventana. */
  function cerrarJuego() {
    if (raiz.AndroidJuego && typeof raiz.AndroidJuego.cerrar === 'function') { raiz.AndroidJuego.cerrar(); return; }
    raiz.close();
    setTimeout(() => { if (raiz.Fx) raiz.Fx.aviso('Cerrá el juego con la ✕ de la ventana'); }, ESPERA_CIERRE_MS);
  }

  // ---- Panel ------------------------------------------------------------------------------
  const opcion = (grupo, valor, texto, elegido) =>
    `<button type="button" class="aj-opcion ${elegido ? 'activa' : ''}" data-grupo="${grupo}" data-valor="${valor}">${texto}</button>`;

  function htmlPanel() {
    const a = actual;
    const pct = (v) => Math.round(v * 100);
    return `<div class="aj-caja" role="dialog" aria-label="Ajustes">
      <h2>⚙️ Ajustes</h2>
      <label class="aj-fila"><span>🎵 Música <b data-ver="musica">${pct(a.musica)}%</b></span>
        <input type="range" min="0" max="100" step="5" value="${pct(a.musica)}" data-vol="musica"></label>
      <label class="aj-fila"><span>⚔️ Efectos <b data-ver="efectos">${pct(a.efectos)}%</b></span>
        <input type="range" min="0" max="100" step="5" value="${pct(a.efectos)}" data-vol="efectos"></label>
      <div class="aj-fila"><span>🏰 Portada</span><div class="aj-grupo">
        ${opcion('portada', 'animada', 'Animada', a.portada === 'animada')}${opcion('portada', 'estatica', 'Estática', a.portada === 'estatica')}</div></div>
      <div class="aj-fila"><span>⚡ Rendimiento</span><div class="aj-grupo">
        ${opcion('rendimiento', 'auto', 'Automático', a.rendimiento === 'auto')}${opcion('rendimiento', 'liviano', 'Liviano', a.rendimiento === 'liviano')}${opcion('rendimiento', 'completo', 'Completo', a.rendimiento === 'completo')}</div></div>
      <div class="aj-botones">
        <button type="button" class="boton secundario boton-chico" data-aj="cerrar-panel">Listo</button>
        ${raiz.Cuenta && raiz.Red && raiz.Red.sesion() ? '<button type="button" class="boton secundario boton-chico" data-aj="cerrar-sesion">👤 Cerrar sesión</button>' : ''}
        <button type="button" class="boton boton-chico" data-aj="salir-juego">🚪 Cerrar el juego</button>
      </div>
    </div>`;
  }

  function cerrarPanel() {
    const p = document.getElementById('panel-ajustes');
    if (p) p.remove();
  }

  function abrirPanel() {
    cerrarPanel();
    const p = document.createElement('div');
    p.id = 'panel-ajustes';
    p.innerHTML = htmlPanel();
    p.addEventListener('click', (e) => {
      if (e.target === p) { cerrarPanel(); return; }
      const op = e.target.closest('.aj-opcion');
      if (op) {
        cambiar({ [op.dataset.grupo]: op.dataset.valor });
        p.querySelectorAll(`.aj-opcion[data-grupo="${op.dataset.grupo}"]`).forEach((b) => b.classList.toggle('activa', b === op));
        if (op.dataset.grupo === 'portada' && raiz.UI && raiz.UI.estado.pantalla === 'inicio') raiz.UI.render();
        return;
      }
      const accion = e.target.closest('[data-aj]');
      if (!accion) return;
      if (accion.dataset.aj === 'cerrar-panel') cerrarPanel();
      if (accion.dataset.aj === 'salir-juego') cerrarJuego();
      if (accion.dataset.aj === 'cerrar-sesion' && raiz.Cuenta) { cerrarPanel(); raiz.Cuenta.cerrarSesion(); }
    });
    p.addEventListener('input', (e) => {
      const tipo = e.target.dataset.vol;
      if (!tipo) return;
      const v = Number(e.target.value) / 100;
      cambiar({ [tipo]: v });
      const ver = p.querySelector(`[data-ver="${tipo}"]`);
      if (ver) ver.textContent = `${Math.round(v * 100)}%`;
      if (tipo === 'efectos' && raiz.Sonido) raiz.Sonido.efecto('click');
    });
    document.body.appendChild(p);
  }

  aplicar();
  raiz.Ajustes = Object.freeze({ actual: () => ({ ...actual }), cambiar, abrirPanel, cerrarPanel, cerrarJuego });
})(this);
