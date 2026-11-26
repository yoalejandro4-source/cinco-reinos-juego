/* Arena Online: lobby con pestañas (Jugar, Amigos, Chat, Ranking), invitaciones a
 * amistosos que llegan en cualquier pantalla, chat dentro de la partida y modo
 * espectador. Las partidas las arbitra el servidor. */
(function (raiz) {
  'use strict';
  const { UI, Fx, Economia: E, Red } = raiz;
  if (!UI || !Red || !raiz.Perfil) return;

  const REFRESCO_MS = 5000;
  const MAX_MENSAJES = 80;
  const FRASES = ['gg', '¡Buena jugada!', 'Jaja', '¡Suerte!', 'Uff', '¡Bien ahí!', '👍', '🔥'];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = {
    usuario: null, ranking: [], lobby: null, buscando: false, desde: 0, conectado: false, tab: 'jugar',
    chat: [], chatDisponible: true, amigos: [], solicitudes: [], social: true, error: '', cargando: false,
    resultado: null, partida: null, amistoso: false, chatPartida: [], chatAbierto: false, sinLeer: 0, esperandoA: null,
  };
  let cadena = Promise.resolve();
  let reloj = null;
  const liga = (elo) => E.rangoDe(elo);
  const enOnline = () => UI.estado.pantalla === 'online';
  const hora = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // ---- Vistas del lobby ------------------------------------------------------------------------------
  function cabecera(u) {
    const l = liga(u.elo);
    const siguiente = E.RANGOS.find((r) => r.desde > u.elo);
    const progreso = siguiente ? Math.max(0, Math.min(1, (u.elo - l.desde) / (siguiente.desde - l.desde))) : 1;
    const total = u.pvp.victorias + u.pvp.derrotas;
    return `<header class="on-cabecera">
      <div class="on-escudo"><span>${l.icono}</span></div>
      <div class="on-datos">
        <h3>${esc(u.nombre)}</h3>
        <p class="on-liga-nombre">${l.nombre} · <b>${u.elo}</b> Elo</p>
        <div class="on-barra-liga" title="${siguiente ? `Faltan ${siguiente.desde - u.elo} para ${siguiente.nombre}` : 'Liga máxima'}"><i style="--p:${progreso.toFixed(3)}"></i></div>
        <p class="on-stats"><span>🏆 ${u.pvp.victorias}</span><span>💀 ${u.pvp.derrotas}</span>${total ? `<span>📈 ${Math.round((u.pvp.victorias / total) * 100)}%</span>` : ''}<span>🎖️ ${u.gloria}</span></p>
      </div>
      <button class="boton boton-chico secundario on-salir" data-accion="on-salir">Salir</button>
    </header>`;
  }

  const pestana = (id, texto, extra) => `<button class="on-tab ${st.tab === id ? 'activa' : ''}" data-accion="on-tab" data-tab="${id}">${texto}${extra || ''}</button>`;

  function panelJugar() {
    const v = E.validarMazo(raiz.Perfil.actual());
    const l = st.lobby;
    const seg = st.buscando ? Math.floor((Date.now() - st.desde) / 1000) : 0;
    return `<div class="on-jugar">
      <p class="on-estado-red">${st.conectado ? '🟢 Conectado' : '🟠 Conectando…'}${l ? ` · 👥 ${l.enLinea} en línea · ⚔️ ${l.partidas} jugando` : ''}</p>
      ${v.ok ? '' : `<p class="on-error">Tu mazo no está listo: ${esc(v.errores[0] || '')} <button class="boton boton-chico secundario" data-accion="ir" data-destino="mazo">Armar</button></p>`}
      ${st.buscando
    ? `<div class="on-buscando"><div class="on-anillo"><span id="on-tiempo">${seg}</span></div><p>Buscando un rival de tu nivel…</p>
         <button class="boton secundario" data-accion="on-cancelar">Cancelar</button></div>`
    : `<button class="boton on-buscar-boton" data-accion="on-buscar" ${v.ok ? '' : 'disabled'}>⚔️ Buscar partida clasificatoria</button>`}
      <div class="on-ayuda"><span>🏆 Clasificatoria: ganás Elo y 🎖️ Gloria, subís de liga.</span><span>🤝 Amistoso: desafiá a un amigo desde <b>Amigos</b> (no cambia el Elo).</span></div>
    </div>`;
  }

  function filaAmigo(a) {
    const punto = { 'en línea': 'verde', jugando: 'amarillo', desconectado: 'gris' }[a.estado] || 'gris';
    const botones = a.estado === 'jugando'
      ? `<button class="boton boton-chico terciario" data-accion="on-mirar" data-nombre="${esc(a.nombre)}">👁️ Mirar</button>`
      : (a.estado === 'en línea' ? `<button class="boton boton-chico" data-accion="on-desafiar" data-nombre="${esc(a.nombre)}">⚔️ Desafiar</button>` : '');
    return `<li class="on-amigo"><span class="on-punto ${punto}"></span>
      <span class="on-amigo-nombre">${liga(a.elo).icono} ${esc(a.nombre)}<small>${a.estado} · ${a.elo} Elo</small></span>
      <span class="on-amigo-botones">${botones}<button class="on-x" data-accion="on-quitar" data-nombre="${esc(a.nombre)}" title="Quitar">✕</button></span></li>`;
  }

  function panelAmigos() {
    if (!st.social) return '<p class="on-nota">Los amigos se activan con la actualización del servidor (hoy a las 5).</p>';
    return `<div class="on-amigos">
      <div class="on-agregar"><input id="on-amigo-nombre" type="text" maxlength="16" autocapitalize="off" spellcheck="false" placeholder="Nombre de tu amigo">
        <button class="boton boton-chico" data-accion="on-agregar">➕ Agregar</button></div>
      ${st.esperandoA ? `<p class="on-esperando">⏳ Esperando que ${esc(st.esperandoA)} acepte el desafío…</p>` : ''}
      ${st.solicitudes.length ? `<div class="on-solicitudes"><h4>📨 Solicitudes</h4>${st.solicitudes.map((n) => `<div class="on-solicitud"><span>${esc(n)}</span>
        <button class="boton boton-chico" data-accion="on-aceptar" data-nombre="${esc(n)}">Aceptar</button>
        <button class="on-x" data-accion="on-quitar" data-nombre="${esc(n)}" title="Rechazar">✕</button></div>`).join('')}</div>` : ''}
      <ul class="on-lista-amigos">${st.amigos.map(filaAmigo).join('') || '<li class="on-vacio">Todavía no tenés amigos. Agregalos por su nombre.</li>'}</ul>
    </div>`;
  }

  const lineaChat = (m) => `<li><span class="on-chat-hora">${hora(m.hora)}</span><b>${esc(m.de)}</b> ${esc(m.texto)}</li>`;

  function panelChat() {
    if (!st.chatDisponible) return '<p class="on-nota">El chat se activa con la actualización del servidor (hoy a las 5).</p>';
    return `<div class="on-chat">
      <ul class="on-chat-lista" id="on-chat-lista">${st.chat.map(lineaChat).join('') || '<li class="on-vacio">Nadie escribió todavía. ¡Saludá!</li>'}</ul>
      <div class="on-chat-escribir"><input id="on-chat-texto" type="text" maxlength="200" placeholder="Escribí a todos…" autocomplete="off">
        <button class="boton boton-chico" data-accion="on-chat-enviar">Enviar</button></div>
    </div>`;
  }

  function panelRanking() {
    const filas = st.ranking.slice(0, 50).map((u, i) => {
      const yo = st.usuario && u.nombre === st.usuario.nombre;
      return `<li class="${yo ? 'yo' : ''} ${i < 3 ? `podio podio-${i + 1}` : ''}"><span class="on-puesto">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        <span class="on-rk-nombre">${liga(u.elo).icono} ${esc(u.nombre)}</span><span class="on-rk-vd">${u.pvp.victorias}V</span><b>${u.elo}</b></li>`;
    }).join('');
    return `<ol class="on-ranking-lista">${filas || '<li class="on-vacio">Todavía no hay jugadores.</li>'}</ol>`;
  }

  function pantallaOnline() {
    if (!st.usuario) return `<div class="pantalla online"><button class="volver" data-accion="ir" data-destino="inicio">← Volver</button>
      <h2 class="titulo-2">🏟️ Arena Online</h2><div class="on-marco"><p class="on-nota">${esc(st.error || 'Conectando con el servidor…')}</p></div></div>`;
    const paneles = { jugar: panelJugar, amigos: panelAmigos, chat: panelChat, ranking: panelRanking };
    return `<div class="pantalla online">
      <button class="volver" data-accion="ir" data-destino="inicio">← Volver</button>
      <h2 class="titulo-2 on-titulo">🏟️ Arena Online</h2>
      <div class="on-marco">
        ${cabecera(st.usuario)}
        <nav class="on-tabs">${pestana('jugar', '⚔️ Jugar')}${pestana('amigos', '👥 Amigos', st.solicitudes.length ? `<i class="on-globo">${st.solicitudes.length}</i>` : '')}${pestana('chat', '💬 Chat')}${pestana('ranking', '🏆 Ranking')}</nav>
        <section class="on-panel">${paneles[st.tab]()}</section>
      </div>
    </div>`;
  }

  // ---- Datos --------------------------------------------------------------------------------------------
  const redibujar = () => { if (enOnline()) UI.render(); };

  async function cargarAmigos() {
    const r = await Red.pedir('/api/amigos');
    st.social = r.ok || r.error !== 'Ruta desconocida.';
    if (r.ok) { st.amigos = r.amigos; st.solicitudes = r.solicitudes; }
  }

  async function cargarLobby() {
    const [yo, ranking, lob, chat] = await Promise.all([Red.pedir('/api/yo'), Red.pedir('/api/ranking'), Red.pedir('/api/lobby'), Red.pedir('/api/chat')]);
    if (!yo.ok) { st.usuario = null; st.error = yo.error; redibujar(); return; }
    st.usuario = yo.usuario;
    st.buscando = yo.enCola;
    st.ranking = ranking.ok ? ranking.ranking : [];
    st.lobby = lob.ok ? lob : null;
    st.chatDisponible = chat.ok;
    if (chat.ok) st.chat = chat.mensajes.slice(-MAX_MENSAJES);
    await cargarAmigos();
    if (!Red.conectado()) Red.conectar();
    redibujar();
    bajarChat();
  }

  function seguir() {
    clearInterval(reloj);
    let vuelta = 0;
    reloj = setInterval(() => {
      if (!enOnline()) { clearInterval(reloj); reloj = null; return; }
      const t = document.getElementById('on-tiempo');
      if (t) t.textContent = String(Math.floor((Date.now() - st.desde) / 1000));
      vuelta += 1;
      if (vuelta % 5) return;
      Red.pedir('/api/lobby').then((r) => { if (r.ok) st.lobby = r; });
      const escribiendo = document.activeElement && document.activeElement.matches && document.activeElement.matches('input');
      if (st.tab === 'amigos' && !escribiendo) cargarAmigos().then(redibujar);
      if (!Red.conectado()) Red.conectar();
    }, REFRESCO_MS / 5);
  }

  function bajarChat() {
    const l = document.getElementById('on-chat-lista');
    if (l) l.scrollTop = l.scrollHeight;
  }

  // ---- Partidas ----------------------------------------------------------------------------------------
  const enviarA = (partida) => (accion) => Red.pedir('/api/accion', 'POST', { partida, accion });

  function empezar(msg) {
    st.buscando = false;
    st.esperandoA = null;
    st.partida = msg.partida;
    st.amistoso = !!msg.amistoso;
    st.chatPartida = [];
    st.sinLeer = 0;
    cerrarToast();
    UI.sonar('turno');
    UI.alRendirse = () => Red.pedir('/api/accion', 'POST', { partida: msg.partida, accion: { tipo: 'rendirse' } })
      .then((r) => { if (!r.ok) Fx.aviso(r.error); });
    UI.empezarRemota({
      estado: msg.estado, rival: msg.rival, enviar: enviarA(msg.partida),
      titulo: msg.amistoso ? `🤝 Amistoso vs ${msg.rival.nombre}` : null,
    });
  }

  function mirar(msg) {
    st.partida = msg.partida;
    st.amistoso = false;
    st.chatPartida = [];
    UI.alRendirse = null;
    UI.empezarRemota({
      estado: msg.estado, rival: msg.rival, espectador: true, enviar: async () => ({ ok: false, error: 'Estás mirando.' }),
      titulo: `👁️ Mirando a ${msg.jugador}`,
    });
  }

  Red.escuchar('conexion', (m) => { st.conectado = m.conectado; });
  Red.escuchar('emparejado', empezar);
  Red.escuchar('reanudar', (m) => { if (UI.estado.pantalla !== 'batalla' || !UI.estado.remoto) empezar(m); });
  Red.escuchar('espectar', mirar);
  Red.escuchar('estado', (msg) => {
    cadena = cadena.then(() => {
      st.resultado = msg.resultado || null;
      return UI.aplicarRemoto(msg);
    }).catch((e) => { if (raiz.console) raiz.console.warn('No se pudo mostrar la jugada', e); });
  });
  Red.escuchar('amigos', (m) => {
    if (m.accion === 'pedir') Fx.aviso(`📨 ${m.de} quiere ser tu amigo`);
    if (m.accion === 'aceptar') Fx.aviso(`🤝 ${m.de} aceptó tu amistad`);
    cargarAmigos().then(() => { if (enOnline() && st.tab === 'amigos') redibujar(); });
  });
  Red.escuchar('invitacion-rechazada', (m) => { st.esperandoA = null; Fx.aviso(`${m.de} no aceptó el desafío`); redibujar(); });
  Red.escuchar('invitacion', (m) => mostrarToast(m.de));
  Red.escuchar('chat', (m) => {
    if (m.canal === 'partida') { recibirChatPartida(m); return; }
    st.chat = [...st.chat, m].slice(-MAX_MENSAJES);
    const l = document.getElementById('on-chat-lista');
    if (l && enOnline() && st.tab === 'chat') {
      if (l.querySelector('.on-vacio')) l.innerHTML = '';
      l.insertAdjacentHTML('beforeend', lineaChat(m));
      bajarChat();
    }
  });

  // ---- Invitación a amistoso (aparece en cualquier pantalla) -------------------------------------------
  function cerrarToast() { const t = document.getElementById('on-toast'); if (t) t.remove(); }
  function mostrarToast(de) {
    cerrarToast();
    UI.sonar('turno');
    const t = document.createElement('div');
    t.id = 'on-toast';
    t.innerHTML = `<p>⚔️ <b>${esc(de)}</b> te desafía a un amistoso</p>
      <div><button class="boton boton-chico" type="button" data-r="si">Aceptar</button><button class="boton boton-chico secundario" type="button" data-r="no">Rechazar</button></div>`;
    t.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      const acepta = b.dataset.r === 'si';
      const p = raiz.Perfil.actual();
      if (acepta && !E.validarMazo(p).ok) { Fx.aviso('Primero armá tu mazo (Mi mazo)'); return; }
      cerrarToast();
      const r = await Red.pedir('/api/amistoso', 'POST', { accion: 'responder', nombre: de, acepta, mazo: p.mazo });
      if (!r.ok) Fx.aviso(r.error);
    });
    document.body.appendChild(t);
    setTimeout(() => { if (document.getElementById('on-toast') === t) t.remove(); }, 55000);
  }

  // ---- Chat dentro de la partida --------------------------------------------------------------------------
  function htmlChatPartida() {
    return `<div class="cp-caja"><div class="cp-cabeza"><b>💬 Chat de la partida</b><button class="on-x" type="button" data-cp="cerrar">✕</button></div>
      <ul class="cp-lista">${st.chatPartida.map(lineaChat).join('') || '<li class="on-vacio">Mandá un saludo 👋</li>'}</ul>
      <div class="cp-frases">${FRASES.map((f) => `<button type="button" data-cp="frase">${esc(f)}</button>`).join('')}</div>
      <div class="cp-escribir"><input type="text" maxlength="200" placeholder="Escribí…" autocomplete="off"><button class="boton boton-chico" type="button" data-cp="enviar">Enviar</button></div></div>`;
  }

  function abrirChatPartida() {
    let c = document.getElementById('chat-partida');
    if (c) { c.remove(); st.chatAbierto = false; return; }
    st.chatAbierto = true;
    st.sinLeer = 0;
    marcarSinLeer();
    c = document.createElement('div');
    c.id = 'chat-partida';
    c.innerHTML = htmlChatPartida();
    c.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cp]');
      if (!b) return;
      if (b.dataset.cp === 'cerrar') { c.remove(); st.chatAbierto = false; return; }
      const input = c.querySelector('input');
      const texto = b.dataset.cp === 'frase' ? b.textContent : input.value;
      if (b.dataset.cp === 'enviar') input.value = '';
      decirEnPartida(texto);
    });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { decirEnPartida(e.target.value); e.target.value = ''; } });
    document.body.appendChild(c);
    const l = c.querySelector('.cp-lista');
    l.scrollTop = l.scrollHeight;
  }

  async function decirEnPartida(texto) {
    if (!texto || !texto.trim() || !st.partida) return;
    const r = await Red.pedir('/api/chat', 'POST', { texto, partida: st.partida });
    if (!r.ok) Fx.aviso(r.error);
  }

  function marcarSinLeer() {
    const b = document.querySelector('.boton-chat-partida');
    if (b) b.classList.toggle('sin-leer', st.sinLeer > 0);
  }

  function recibirChatPartida(m) {
    if (m.partida !== st.partida) return;
    st.chatPartida = [...st.chatPartida, m].slice(-MAX_MENSAJES);
    const c = document.getElementById('chat-partida');
    if (c) {
      const l = c.querySelector('.cp-lista');
      if (l.querySelector('.on-vacio')) l.innerHTML = '';
      l.insertAdjacentHTML('beforeend', lineaChat(m));
      l.scrollTop = l.scrollHeight;
    } else {
      st.sinLeer += 1;
      marcarSinLeer();
      Fx.aviso(`💬 ${m.de}: ${m.texto}`);
    }
  }

  // ---- Acciones --------------------------------------------------------------------------------------------
  async function buscar() {
    const r = await Red.pedir('/api/cola', 'POST', { mazo: raiz.Perfil.actual().mazo });
    if (!r.ok) { Fx.aviso(r.error); return; }
    st.buscando = true;
    st.desde = Date.now();
    UI.sonar('click');
    redibujar();
  }

  async function social(accion, nombre) {
    const r = await Red.pedir('/api/amigos', 'POST', { accion, nombre });
    if (!r.ok) { Fx.aviso(r.error); return; }
    if (accion === 'pedir') Fx.aviso(`📨 Solicitud enviada a ${nombre}`);
    await cargarAmigos();
    redibujar();
  }

  async function enviarChatGlobal() {
    const input = document.getElementById('on-chat-texto');
    const texto = input ? input.value : '';
    if (!texto.trim()) return;
    const r = await Red.pedir('/api/chat', 'POST', { texto });
    if (!r.ok) { Fx.aviso(r.error); return; }
    input.value = '';
    input.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !enOnline() || !e.target.matches) return;
    if (e.target.matches('#on-chat-texto')) enviarChatGlobal();
    if (e.target.matches('#on-amigo-nombre') && e.target.value.trim()) social('pedir', e.target.value.trim());
  });

  UI.agregar({
    vistas: {
      online: () => {
        if (!st.usuario && !st.cargando) { st.cargando = true; cargarLobby().finally(() => { st.cargando = false; seguir(); }); }
        return pantallaOnline();
      },
    },
    acciones: {
      'on-tab': async (el) => {
        st.tab = el.dataset.tab;
        if (st.tab === 'amigos') await cargarAmigos();
        if (st.tab === 'ranking') { const r = await Red.pedir('/api/ranking'); if (r.ok) st.ranking = r.ranking; }
        UI.render();
        bajarChat();
      },
      'on-buscar': buscar,
      'on-cancelar': async () => { await Red.pedir('/api/cola', 'DELETE'); st.buscando = false; redibujar(); },
      'on-salir': async () => { st.usuario = null; if (raiz.Cuenta) await raiz.Cuenta.cerrarSesion(); else { await Red.salir(); UI.render(); } },
      'on-agregar': () => { const n = ((document.getElementById('on-amigo-nombre') || {}).value || '').trim(); if (n) social('pedir', n); },
      'on-aceptar': (el) => social('aceptar', el.dataset.nombre),
      'on-quitar': (el) => social('borrar', el.dataset.nombre),
      'on-desafiar': async (el) => {
        const p = raiz.Perfil.actual();
        if (!E.validarMazo(p).ok) { Fx.aviso('Primero armá tu mazo (Mi mazo)'); return; }
        const r = await Red.pedir('/api/amistoso', 'POST', { accion: 'invitar', nombre: el.dataset.nombre, mazo: p.mazo });
        if (!r.ok) { Fx.aviso(r.error); return; }
        st.esperandoA = el.dataset.nombre;
        redibujar();
      },
      'on-mirar': async (el) => { const r = await Red.pedir('/api/espectar', 'POST', { nombre: el.dataset.nombre }); if (!r.ok) Fx.aviso(r.error); },
      'on-chat-enviar': enviarChatGlobal,
      'chat-partida': abrirChatPartida,
      'dejar-mirar': async () => { await Red.pedir('/api/espectar', 'DELETE'); UI.ir('online'); },
    },
  });

  // ---- Premios: Elo y Gloria del servidor; los amistosos y mirar no dan nada -----------------------------------
  const premioPrevio = UI.alTerminar;
  UI.alTerminar = (gano) => {
    const remoto = UI.estado.remoto;
    if (!remoto) return typeof premioPrevio === 'function' ? premioPrevio(gano) : null;
    UI.alRendirse = null;
    const cp = document.getElementById('chat-partida');
    if (cp) cp.remove();
    if (remoto.espectador) return { oro: 0, gemas: 0, online: '👁️ Terminó la partida que estabas mirando', enOnline: true };
    if (st.amistoso) return { oro: 0, gemas: 0, online: '🤝 Amistoso: no cambia el Elo', enOnline: true };
    const base = typeof premioPrevio === 'function' ? premioPrevio(gano) : { oro: 0, gemas: 0 };
    const r = st.resultado;
    if (r && st.usuario) st.usuario = { ...st.usuario, elo: r.eloDespues, gloria: st.usuario.gloria + (r.gloria || 0) };
    const l = r ? liga(r.eloDespues) : null;
    const texto = r ? `🏆 Elo ${r.cambio >= 0 ? '+' : ''}${r.cambio} (${r.eloDespues}) · ${l.icono} ${l.nombre} · +${r.gloria || 0} 🎖️ Gloria` : '';
    return { ...base, online: texto, enOnline: true };
  };
})(this);
