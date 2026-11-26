/* Controlador: maneja pantallas, clics del jugador y el turno de la IA. */
(function (raiz) {
  'use strict';
  const { Datos: D, Motor: M, IA, Render: R, Fx, Combate } = raiz;
  const sonar = (nombre) => raiz.Sonido && raiz.Sonido.efecto(nombre);
  const VIDA_TENSA = 8; // con un héroe en esta vida o menos, la música de batalla se pone tensa
  const ACCIONES_CON_CLIC = ['ajustes', 'rendirse', 'ir', 'reino', 'empezar', 'tab', 'revancha', 'terminar', 'fusion-modo', 'fusionar', 'audio'];
  const HUMANO = 0;
  const RIVAL = 1;
  const PAUSA = Object.freeze({ ia: 650, impacto: 480, maxAccionesIA: 40, detalle: 2600 });
  const app = document.getElementById('app');

  const ui = {
    pantalla: 'inicio', estado: null, partida: 0, sel: null, modoFusion: false, fusion: [],
    ocupado: false, elegidos: [], tab: 'bosque', reinosJugador: null,
  };

  // Pantallas; otros módulos (economía, tienda) agregan o reemplazan vistas con UI.agregar().
  const VISTAS = {
    inicio: () => R.pantallaInicio(),
    elegir: () => R.pantallaElegir(ui.elegidos),
    coleccion: () => R.pantallaColeccion(ui.tab),
    ayuda: () => R.pantallaAyuda(),
    batalla: () => R.pantallaBatalla(ui.estado, {
      sel: ui.sel, modoFusion: ui.modoFusion, fusion: ui.fusion, premio: ui.premio, vistaPrevia: ui.vistaPrevia,
      online: !!ui.remoto, espectador: !!(ui.remoto && ui.remoto.espectador),
    }),
  };

  function render() {
    // Sin cuenta iniciada solo se ve la pantalla de entrar (js/cuenta.js pone la guardia).
    if (typeof UI.guardia === 'function') ui.pantalla = UI.guardia(ui.pantalla);
    const enBatalla = ui.pantalla === 'batalla';
    const html = (VISTAS[ui.pantalla] || VISTAS.inicio)() + (enBatalla ? '' : R.htmlBotonAudio('flotante'));
    // En la batalla se cambia solo lo que cambió (mucho más liviano en el celular).
    const firma = `${ui.pantalla}|${ui.partida}`;
    if (enBatalla && raiz.Morph && app.dataset.firma === firma) raiz.Morph.morfar(app, html);
    else app.innerHTML = html;
    app.dataset.firma = firma;
    document.body.dataset.pantalla = ui.pantalla;
    actualizarCampoFondo();
    actualizarFondoVivo();
    actualizarMusica();
    actualizarReloj();
  }

  /** Fondo vivo de los menús: la escena de la portada en movimiento, desenfocada y oscura. */
  function actualizarFondoVivo() {
    const fondo = document.getElementById('fondo');
    if (!fondo) return;
    const ver = ui.pantalla !== 'inicio' && ui.pantalla !== 'batalla';
    let v = fondo.querySelector('video');
    if (ver && !v) {
      v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, src: 'videos/fondo-menu.mp4' });
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('aria-hidden', 'true');
      v.className = 'fondo-video';
      v.addEventListener('playing', () => v.classList.add('lista'), { once: true });
      fondo.appendChild(v);
    }
    if (!v) return;
    if (ver) { if (v.paused) v.play().catch(() => {}); } else v.pause();
  }

  /** 80 segundos por turno: al agotarse se cierra la jugada y se pasa el turno. */
  function actualizarReloj() {
    if (!raiz.RelojTurno) return;
    const s = ui.estado;
    const activo = ui.pantalla === 'batalla' && s && s.ganador === null && s.turno === HUMANO && !espectando();
    raiz.RelojTurno.actualizar(activo ? `${ui.partida}-${s.numeroTurno}` : null, () => {
      if (!puedoActuar()) return ui.pantalla === 'batalla' && ui.estado && ui.estado.turno === HUMANO && ui.estado.ganador === null ? false : true;
      limpiarSeleccion();
      Fx.ocultarInspector();
      Fx.aviso('⏳ Se terminó el tiempo');
      accionHumana({ tipo: 'terminar' });
      return true;
    });
  }

  function actualizarMusica() {
    const S = raiz.Sonido;
    if (!S) return;
    const enBatalla = ui.pantalla === 'batalla' && ui.estado;
    if (!enBatalla) { S.musica('menu'); return; }
    if (ui.estado.ganador !== null) { S.musica(null); return; }
    S.musica('batalla');
    S.tension(ui.estado.jugadores.some((p) => p.vida <= VIDA_TENSA));
  }

  // El fondo animado vive fuera de #app y solo cambia cuando cambian los reinos de la partida.
  function actualizarCampoFondo() {
    let fondo = document.getElementById('campo-fondo');
    if (ui.pantalla !== 'batalla' || !ui.estado) {
      if (fondo) fondo.remove();
      return;
    }
    const clave = R.claveCampo(ui.estado);
    if (fondo && fondo.dataset.clave === clave) return;
    if (!fondo) {
      fondo = document.createElement('div');
      fondo.id = 'campo-fondo';
      fondo.setAttribute('aria-hidden', 'true');
      document.body.prepend(fondo);
    }
    fondo.dataset.clave = clave;
    fondo.innerHTML = R.htmlCampoFondo(ui.estado);
  }

  function limpiarSeleccion() { ui.sel = null; ui.modoFusion = false; ui.fusion = []; ui.vistaPrevia = null; }

  const esTactil = () => !!(raiz.matchMedia && raiz.matchMedia('(hover: none), (pointer: coarse)').matches);

  const espectando = () => !!(ui.remoto && ui.remoto.espectador);
  const puedoActuar = () => ui.pantalla === 'batalla' && !ui.ocupado && ui.estado && !espectando()
    && ui.estado.turno === HUMANO && ui.estado.ganador === null;

  function buscar(ref) {
    if (!ref) return null;
    if (ref.heroe) return app.querySelector(`.heroe[data-lado="${ref.jIdx}"]`);
    return app.querySelector(`.ficha[data-uid="${ref.uid}"]`);
  }

  function reinosAlAzar() {
    const lista = Object.keys(D.REINOS).sort(() => Math.random() - 0.5);
    return [lista[0], lista[1]];
  }

  /**
   * Empieza una partida contra la IA, con 2 reinos o con un mazo propio (lista de ids).
   * `rival` (opcional, Modo Aventura): { nombre, reinos, mazo, vida, aventura }.
   */
  async function empezarPartida(reinos, mazoPropio, rival) {
    ui.partida += 1;
    ui.remoto = null;
    ui.premio = null;
    ui.reinosJugador = reinos.slice();
    ui.rival = rival || null;
    ui.ultimaPartida = { reinos: reinos.slice(), mazo: mazoPropio ? mazoPropio.slice() : null, rival: ui.rival };
    ui.estado = M.nuevaPartida({
      nombres: [UI.nombreJugador || 'Vos', rival ? rival.nombre : 'Rival IA'], reinos: [reinos, rival ? rival.reinos : reinosAlAzar()],
      mazos: [mazoPropio || null, rival ? rival.mazo : null], vidas: [null, rival ? rival.vida : null], ia: [false, true],
    });
    // El rival de la aventura se muestra con su propio personaje al lado del nombre
    if (rival && rival.retrato) ui.estado.jugadores[RIVAL].retrato = rival.retrato;
    limpiarSeleccion();
    ui.ocupado = true;
    ui.pantalla = 'batalla';
    render();
    await Fx.banner(ui.estado.turno === HUMANO ? '¡Empezás vos!' : 'Empieza el rival');
    ui.ocupado = false;
    if (ui.estado.turno === RIVAL) turnoIA();
  }

  // ---- Reproducción animada de una acción -----------------------------------
  const claveRef = (r) => (r.heroe ? `h${r.jIdx}` : r.uid);

  // Hechizos y efectos "Al jugar": un proyectil del héroe hacia cada objetivo dañado o congelado.
  async function lanzarProyectiles(eventos, quien, reino) {
    const refs = eventos.filter((e) => ['dano', 'congelar', 'destruir'].includes(e.tipo) && e.ref && e.ref.jIdx !== quien).map((e) => e.ref);
    const unicos = [...new Map(refs.map((r) => [claveRef(r), r])).values()];
    const destinos = unicos.map(buscar).filter(Boolean);
    if (destinos.length) await Combate.proyectiles(buscar({ jIdx: quien, heroe: true }), destinos, reino);
  }

  /** Animaciones previas al redibujo. Devuelve si ya mostró los eventos (null si no). */
  async function mostrarAntes(res, accion, quien) {
    let mostrados = null;
    if (res.eventos.some((e) => e.tipo === 'jugar')) sonar('carta');
    const mostrar = () => {
      if (mostrados === null) mostrados = Fx.animarEventos(res.eventos, buscar);
      return mostrados;
    };
    if (accion.tipo === 'atacar') {
      const atacante = buscar({ jIdx: quien, uid: accion.uid });
      const fuerza = Number(atacante && atacante.querySelector('.gema-atq') && atacante.querySelector('.gema-atq').textContent) || 2;
      sonar('desenvainar');
      await Combate.embestida(atacante, buscar(accion.objetivo), atacante && atacante.dataset.reino, fuerza, mostrar);
    }
    const evFusion = res.eventos.find((e) => e.tipo === 'fusion');
    if (evFusion) {
      const titulo = quien === HUMANO ? '¡FUSIÓN!' : '¡El rival fusionó!';
      sonar('fusion');
      const res2 = evFusion.resultado;
      const color = (id) => (raiz.Datos.REINOS[id] || raiz.Datos.REINOS.arcano).c1;
      if (raiz.Cine) {
        await raiz.Cine.fusion({ a: R.htmlCarta(evFusion.a), b: R.htmlCarta(evFusion.b), resultado: R.htmlCarta(res2),
          nombre: res2.nombre, titulo, colorA: color(evFusion.a.reino), colorB: color(evFusion.b.reino) });
      } else {
        await Fx.mostrarFusion(R.htmlCarta(evFusion.a), R.htmlCarta(evFusion.b), R.htmlCarta(res2), titulo);
      }
    }
    const evJugar = res.eventos.find((e) => e.tipo === 'jugar');
    if (evJugar && quien === RIVAL) await Fx.mostrarJugada(R.htmlCarta(evJugar.carta));
    if (evJugar) await lanzarProyectiles(res.eventos, quien, evJugar.carta.reino);
    return mostrados;
  }

  async function reproducir(res, accion, quien) {
    const partida = ui.partida;
    ui.ocupado = true;
    try {
      const mostrados = await mostrarAntes(res, accion, quien);
      if (partida !== ui.partida) return;
      const hubo = mostrados === null ? Fx.animarEventos(res.eventos, buscar) : mostrados;
      if (hubo) await Fx.espera(PAUSA.impacto);
      if (partida !== ui.partida) return;
      const terminoAhora = ui.estado.ganador === null && res.estado.ganador !== null;
      if (terminoAhora && typeof UI.alTerminar === 'function') ui.premio = UI.alTerminar(res.estado.ganador === HUMANO);
      ui.estado = res.estado;
      render();
      Fx.animarAparicion(res.eventos, buscar);
      if (res.eventos.some((e) => e.tipo === 'invocar')) sonar('invocar');
      if (terminoAhora) sonar(res.estado.ganador === HUMANO ? 'victoria' : 'derrota');
      const evTurno = res.eventos.find((e) => e.tipo === 'turno');
      if (evTurno && res.estado.ganador === null) {
        sonar(evTurno.jIdx === HUMANO ? 'turno' : 'turno-rival');
        await Fx.banner(evTurno.jIdx === HUMANO ? 'TU TURNO' : 'TURNO DEL RIVAL');
      }
    } finally {
      if (partida === ui.partida) ui.ocupado = false;
    }
  }

  async function accionHumana(accion) {
    if (!puedoActuar()) return;
    if (ui.remoto) { await accionRemota(accion); return; }
    const res = M.ejecutar(ui.estado, HUMANO, accion);
    if (!res.ok) { Fx.aviso(res.error); return; }
    limpiarSeleccion();
    Fx.ocultarInspector();
    await reproducir(res, accion, HUMANO);
    if (ui.estado.turno === RIVAL && ui.estado.ganador === null && !ui.remoto) turnoIA();
  }

  // ---- Rendirse: 15 segundos para arrepentirse (que no se toque por error) ----------------
  const SEGUNDOS_RENDIRSE = 15;
  const rendicion = { id: null, fin: 0 };
  const enPartidaViva = () => ui.pantalla === 'batalla' && ui.estado && ui.estado.ganador === null;

  function cancelarRendicion() {
    clearInterval(rendicion.id);
    rendicion.id = null;
    const el = document.getElementById('cuenta-rendirse');
    if (el) el.remove();
  }

  function pedirRendicion() {
    if (rendicion.id || !enPartidaViva()) return;
    rendicion.fin = Date.now() + SEGUNDOS_RENDIRSE * 1000;
    const el = document.createElement('div');
    el.id = 'cuenta-rendirse';
    el.innerHTML = `<div class="cr-caja"><span class="cr-titulo">🏳️ Te rendís en <b class="cr-seg">${SEGUNDOS_RENDIRSE}</b> s</span>
      <div class="cr-barra"><i></i></div><button class="boton boton-chico secundario" type="button">Cancelar</button></div>`;
    el.querySelector('button').addEventListener('click', () => { sonar('click'); cancelarRendicion(); });
    document.body.appendChild(el);
    rendicion.id = setInterval(tickRendicion, 200);
    tickRendicion();
  }

  function tickRendicion() {
    const el = document.getElementById('cuenta-rendirse');
    if (!el || !enPartidaViva()) { cancelarRendicion(); return; }
    const resta = Math.max(0, rendicion.fin - Date.now());
    el.querySelector('.cr-seg').textContent = String(Math.ceil(resta / 1000));
    el.querySelector('.cr-barra i').style.transform = `scaleX(${(resta / (SEGUNDOS_RENDIRSE * 1000)).toFixed(3)})`;
    if (resta > 0 || ui.ocupado) return;
    cancelarRendicion();
    rendirseYa();
  }

  async function rendirseYa() {
    if (typeof UI.alRendirse === 'function') { UI.alRendirse(); return; }
    const res = M.ejecutar(ui.estado, HUMANO, { tipo: 'rendirse' });
    if (!res.ok) { Fx.aviso(res.error); return; }
    limpiarSeleccion();
    Fx.ocultarInspector();
    await reproducir(res, { tipo: 'rendirse' }, HUMANO);
  }

  // ---- Partidas online: el servidor manda; acá solo se envían jugadas y se animan las respuestas ----
  async function accionRemota(accion) {
    ui.ocupado = true;
    const r = await ui.remoto.enviar(accion);
    ui.ocupado = false;
    if (!r.ok) { Fx.aviso(r.error || 'No se pudo enviar la jugada'); return; }
    limpiarSeleccion();
    Fx.ocultarInspector();
  }

  /** Empieza una partida contra otra persona con el estado que manda el servidor. */
  async function empezarRemota({ estado, rival, enviar, espectador, titulo }) {
    ui.partida += 1;
    ui.premio = null;
    ui.rival = null;
    ui.remoto = { enviar, rival, espectador: !!espectador };
    ui.ultimaPartida = null;
    ui.estado = estado;
    limpiarSeleccion();
    ui.ocupado = true;
    ui.pantalla = 'batalla';
    render();
    await Fx.banner(titulo || `⚔️ ${rival.nombre} (${rival.elo})`);
    ui.ocupado = false;
    render();
  }

  /** Anima una jugada que llega del servidor (propia o del rival). */
  async function aplicarRemoto({ estado, eventos, accion, quien }) {
    if (!ui.remoto || ui.pantalla !== 'batalla') return;
    const res = { ok: true, estado, eventos: eventos || [] };
    await reproducir(res, accion || { tipo: 'terminar' }, quien === 'yo' ? HUMANO : RIVAL);
  }

  async function turnoIA() {
    const partida = ui.partida;
    const sigue = () => partida === ui.partida && ui.pantalla === 'batalla'
      && ui.estado.ganador === null && ui.estado.turno === RIVAL;
    for (let n = 0; n < PAUSA.maxAccionesIA && sigue(); n++) {
      await Fx.espera(PAUSA.ia);
      if (!sigue()) return;
      let accion = IA.siguienteAccion(ui.estado, RIVAL) || { tipo: 'terminar' };
      let res = M.ejecutar(ui.estado, RIVAL, accion);
      if (!res.ok) {
        accion = { tipo: 'terminar' };
        res = M.ejecutar(ui.estado, RIVAL, accion);
      }
      await reproducir(res, accion, RIVAL);
    }
    if (sigue()) await reproducir(M.ejecutar(ui.estado, RIVAL, { tipo: 'terminar' }), { tipo: 'terminar' }, RIVAL);
  }

  // ---- Clics en la batalla ----------------------------------------------------
  function mostrarDetalle(ref) {
    const u = M.unidadPorRef(ui.estado, ref);
    if (u) Fx.inspector(R.htmlCarta(u), PAUSA.detalle);
  }

  function clickCarta(i) {
    if (!puedoActuar()) return;
    const s = ui.estado;
    const carta = s.jugadores[HUMANO].mano[i];
    if (!carta) return;
    if (ui.modoFusion) {
      if (carta.rareza !== 'comun') { Fx.aviso('Solo se fusionan cartas comunes'); return; }
      ui.fusion = ui.fusion.includes(i) ? ui.fusion.filter((x) => x !== i) : ui.fusion.concat(i).slice(-2);
      render();
      return;
    }
    if (ui.sel && ui.sel.tipo === 'carta' && ui.sel.manoIdx === i) { ui.sel = null; render(); return; }
    // En pantallas táctiles no hay "pasar el mouse": el primer toque muestra la carta grande.
    if (esTactil() && ui.vistaPrevia !== i) {
      ui.vistaPrevia = i;
      if (raiz.Lupa) raiz.Lupa.mostrar(carta); else Fx.inspector(R.htmlCarta(carta));
      Fx.aviso(M.motivoNoJugable(s, HUMANO, i) || 'Tocá de nuevo para jugarla');
      render();
      return;
    }
    ui.vistaPrevia = null;
    Fx.ocultarInspector();
    const motivo = M.motivoNoJugable(s, HUMANO, i);
    if (motivo) { Fx.aviso(motivo); return; }
    const tipo = M.tipoObjetivo(carta);
    const validos = tipo ? M.objetivosDeEfecto(s, HUMANO, tipo, carta.uid) : [];
    if (validos.length) {
      ui.sel = { tipo: 'carta', manoIdx: i, validos };
      render();
      Fx.aviso('Elegí un objetivo');
      return;
    }
    accionHumana({ tipo: 'jugar', manoIdx: i, objetivo: null });
  }

  function usarObjetivo(ref) {
    if (!puedoActuar() || !ui.sel) return;
    const sel = ui.sel;
    if (sel.tipo === 'carta') accionHumana({ tipo: 'jugar', manoIdx: sel.manoIdx, objetivo: ref });
    else accionHumana({ tipo: 'atacar', uid: sel.uid, objetivo: ref });
  }

  const esValido = (ref) => !!ui.sel && ui.sel.validos.some((v) => M.mismoRef(v, ref));

  function clickFicha(uid, lado) {
    const ref = { jIdx: lado, uid };
    if (esValido(ref)) { usarObjetivo(ref); return; }
    if (puedoActuar() && ui.sel && ui.sel.tipo === 'atacante' && lado === RIVAL) {
      Fx.aviso('Primero tenés que atacar a las unidades con Guardia 🛡️');
      return;
    }
    if (!puedoActuar() || lado !== HUMANO) { mostrarDetalle(ref); return; }
    if (ui.sel && ui.sel.uid === uid) { ui.sel = null; render(); return; }
    const u = M.unidadPorRef(ui.estado, ref);
    if (!M.puedeAtacar(u)) {
      Fx.aviso(u.congelada ? 'Está congelada ❄️' : (u.atq <= 0 ? 'No tiene ataque' : 'Todavía no puede atacar'));
      mostrarDetalle(ref);
      return;
    }
    limpiarSeleccion();
    ui.sel = { tipo: 'atacante', uid, validos: M.objetivosDeAtaque(ui.estado, HUMANO) };
    render();
  }

  function clickHeroe(lado) {
    const ref = { jIdx: lado, heroe: true };
    if (esValido(ref)) usarObjetivo(ref);
    else if (ui.sel && ui.sel.tipo === 'atacante' && lado === RIVAL) Fx.aviso('Primero tenés que atacar a las unidades con Guardia 🛡️');
  }

  function alternarFusion() {
    if (!puedoActuar()) return;
    const activar = !ui.modoFusion;
    limpiarSeleccion();
    ui.modoFusion = activar;
    render();
    if (activar) Fx.aviso('Elegí 2 cartas comunes para fusionar');
  }

  function elegirReino(id) {
    if (ui.elegidos.includes(id)) ui.elegidos = ui.elegidos.filter((x) => x !== id);
    else ui.elegidos = ui.elegidos.length < 2 ? ui.elegidos.concat(id) : [ui.elegidos[1], id];
    render();
  }

  const acciones = {
    ir: (el) => {
      if (el.dataset.destino === 'elegir') ui.elegidos = ui.reinosJugador ? ui.reinosJugador.slice() : [];
      ir(el.dataset.destino);
    },
    reino: (el) => elegirReino(el.dataset.reino),
    empezar: () => { if (ui.elegidos.length === 2) empezarPartida(ui.elegidos); },
    tab: (el) => { ui.tab = el.dataset.tab; render(); },
    revancha: () => {
      const u = ui.ultimaPartida;
      if (u) empezarPartida(u.reinos, u.mazo, u.rival); else empezarPartida(ui.reinosJugador);
    },
    terminar: () => accionHumana({ tipo: 'terminar' }),
    rendirse: pedirRendicion,
    'fusion-modo': alternarFusion,
    fusionar: () => { if (ui.fusion.length === 2) accionHumana({ tipo: 'fusionar', a: ui.fusion[0], b: ui.fusion[1] }); },
    'carta-mano': (el) => clickCarta(Number(el.dataset.mano)),
    ficha: (el) => clickFicha(el.dataset.uid, Number(el.dataset.lado)),
    heroe: (el) => clickHeroe(Number(el.dataset.lado)),
    ajustes: () => { if (raiz.Ajustes) raiz.Ajustes.abrirPanel(); },
    audio: () => {
      if (!raiz.Sonido) return;
      const modo = raiz.Sonido.alternarModo();
      Fx.aviso({ todo: '🔊 Música y efectos', efectos: '🔉 Solo efectos', nada: '🔇 Silencio' }[modo]);
      render();
    },
  };

  function cancelar() {
    if (ui.pantalla !== 'batalla') return;
    if (ui.vistaPrevia !== null && ui.vistaPrevia !== undefined) Fx.ocultarInspector();
    if (ui.sel || ui.modoFusion || ui.vistaPrevia !== null) { limpiarSeleccion(); render(); }
  }

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el) { cancelar(); return; }
    if (el.disabled) return;
    if (ACCIONES_CON_CLIC.includes(el.dataset.accion)) sonar('click');
    const accion = acciones[el.dataset.accion];
    if (accion) accion(el);
  });
  app.addEventListener('contextmenu', (e) => { if (ui.pantalla === 'batalla') { e.preventDefault(); cancelar(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelar(); });

  app.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || ui.pantalla !== 'batalla') return;
    const f = e.target.closest('.ficha');
    if (!f) return;
    const u = M.unidadPorRef(ui.estado, { jIdx: Number(f.dataset.lado), uid: f.dataset.uid });
    if (u) Fx.inspector(R.htmlCarta(u));
  });
  app.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const f = e.target.closest('.ficha');
    if (f && !f.contains(e.relatedTarget)) Fx.ocultarInspector();
  });

  /** Saca todo lo que las animaciones dejan sueltas en la página (clones, pedazos, carteles). */
  const RESTOS = '.fantasma, .pedazo, .tajo, .proyectil, .overlay-jugada, .overlay-fusion, .banner, .flotante, .cine';
  function limpiarRestos() {
    Fx.ocultarInspector();
    if (raiz.Lupa) raiz.Lupa.ocultar();
    document.querySelectorAll(RESTOS).forEach((el) => el.remove());
    const capa = document.getElementById('capa-apertura');
    if (capa) capa.remove();
  }

  function ir(pantalla) {
    ui.partida += 1;
    ui.ocupado = false;
    ui.pantalla = pantalla;
    if (pantalla !== 'batalla') ui.remoto = null;
    cancelarRendicion();
    limpiarRestos();
    render();
  }

  /** Punto de extensión para otros módulos: suman pantallas y acciones al controlador. */
  const UI = {
    estado: ui, render, ir, empezarPartida, empezarRemota, aplicarRemoto, sonar,
    /** Jugar una carta de la mano soltándola en el tablero (js/arrastre.js): sin el toque de vista previa. */
    jugarArrastrada(i) { if (!puedoActuar()) return false; ui.vistaPrevia = i; clickCarta(i); return true; },
    puedoJugar: () => puedoActuar(),
    alTerminar: null, nombreJugador: null, guardia: null,
    agregar({ vistas, acciones: nuevas }) {
      Object.assign(VISTAS, vistas || {});
      Object.assign(acciones, nuevas || {});
      (nuevas ? Object.keys(nuevas) : []).forEach((n) => { if (!ACCIONES_CON_CLIC.includes(n)) ACCIONES_CON_CLIC.push(n); });
    },
  };
  raiz.UI = UI;

  Fx.iniciarParticulas();
  Fx.activarInclinacion();
  render();
})(this);
