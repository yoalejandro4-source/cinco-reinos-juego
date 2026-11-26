/* Cuenta obligatoria: el juego abre con Entrar / Crear cuenta y todo el progreso
 * (cartas, oro, mazo, tienda, aventura) se guarda en la cuenta, en el servidor.
 * Si una vez entraste, podés seguir jugando aunque el servidor esté apagado: lo
 * que cambies se sube cuando vuelva. */
(function (raiz) {
  'use strict';
  const { UI, Red, Fx } = raiz;
  if (!UI || !Red || !raiz.Perfil) return;

  const CLAVE_PENDIENTE = 'cinco-reinos-nube-pendiente';
  const SUBIR_CADA_MS = 2500;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = { cargando: false, error: '', modo: 'entrar', nube: 'sin-datos' };
  let relojSubida = null;

  // ---- Pantalla de entrar ---------------------------------------------------------------------
  function estadoServidor() {
    const d = Red.servidor();
    if (d.encendido === true) return '<span class="cu-servidor ok">🟢 Servidor encendido</span>';
    if (d.encendido === false) return '<span class="cu-servidor apagado">🔴 El servidor está apagado ahora</span>';
    return '<span class="cu-servidor">⏳ Buscando el servidor…</span>';
  }

  function pantallaCuenta() {
    const crear = st.modo === 'crear';
    return `<div class="pantalla cuenta">
      <div class="cu-fondo" aria-hidden="true"></div>
      <div class="cu-tarjeta">
        <img class="cu-logo" src="arte/portada-chica.webp" alt="Guerra de los Cinco Reinos">
        <div class="cu-pestanas">
          <button class="cu-pestana ${crear ? '' : 'activa'}" data-accion="cu-modo" data-modo="entrar">Entrar</button>
          <button class="cu-pestana ${crear ? 'activa' : ''}" data-accion="cu-modo" data-modo="crear">Crear cuenta</button>
        </div>
        ${estadoServidor()}
        <label class="cu-campo"><span>👤 Nombre</span><input id="cu-nombre" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Tu nombre de jugador"></label>
        <label class="cu-campo"><span>🔑 Clave</span><input id="cu-clave" type="password" maxlength="64" autocomplete="${crear ? 'new-password' : 'current-password'}" placeholder="Mínimo 6 caracteres"></label>
        ${crear ? '<label class="cu-campo"><span>🔑 Repetí la clave</span><input id="cu-clave2" type="password" maxlength="64" autocomplete="new-password"></label>' : ''}
        ${st.error ? `<p class="cu-error">${esc(st.error)}</p>` : ''}
        <button class="boton cu-ir" data-accion="cu-ir" ${st.cargando ? 'disabled' : ''}>${st.cargando ? 'Conectando…' : (crear ? '⚔️ Crear mi cuenta' : '⚔️ Entrar al reino')}</button>
        <p class="cu-nota">${crear ? 'Tu cuenta guarda tus cartas, oro, mazos y progreso. Entrás desde cualquier celular o PC.' : '¿Primera vez? Tocá <b>Crear cuenta</b>.'}</p>
      </div>
    </div>`;
  }

  // ---- Progreso en la nube ----------------------------------------------------------------------
  const marcarPendiente = (si) => { try { if (si) raiz.localStorage.setItem(CLAVE_PENDIENTE, '1'); else raiz.localStorage.removeItem(CLAVE_PENDIENTE); } catch (e) { /* sin almacenamiento */ } };
  const hayPendiente = () => { try { return raiz.localStorage.getItem(CLAVE_PENDIENTE) === '1'; } catch (e) { return false; } };

  async function subir() {
    clearTimeout(relojSubida);
    relojSubida = null;
    if (!Red.sesion()) return false;
    const r = await Red.pedir('/api/perfil', 'PUT', { perfil: raiz.Perfil.actual() });
    marcarPendiente(!r.ok);
    st.nube = r.ok ? 'ok' : 'pendiente';
    return r.ok;
  }

  function programarSubida() {
    marcarPendiente(true);
    clearTimeout(relojSubida);
    relojSubida = setTimeout(subir, SUBIR_CADA_MS);
  }

  /** Trae el progreso de la cuenta; si la cuenta es nueva, sube el de este dispositivo. */
  async function sincronizar() {
    const s = Red.sesion();
    if (!s) return;
    const clave = s.nombre.toLowerCase();
    const local = raiz.Perfil.actual();
    if (hayPendiente() && local.cuenta === clave) { await subir(); return; } // cambios hechos sin conexión
    const r = await Red.pedir('/api/perfil');
    if (r.ok && r.perfil) {
      raiz.Perfil.reemplazar({ ...r.perfil, nombre: s.nombre, cuenta: clave }, { sinAvisar: true });
      st.nube = 'ok';
      return;
    }
    if (r.ok) {
      // Cuenta nueva: se lleva el progreso de este dispositivo solo si no era de otra cuenta.
      const base = !local.cuenta || local.cuenta === clave ? local : raiz.Perfil.nuevo();
      raiz.Perfil.reemplazar({ ...base, nombre: s.nombre, cuenta: clave }, { sinAvisar: true });
      await subir();
      return;
    }
    st.nube = 'pendiente'; // servidor apagado o todavía sin esta función: se sigue con lo guardado acá
  }

  /** Regalos del dueño del servidor (gemas u oro): se suman al progreso y se guardan en la cuenta. */
  async function cobrarRegalos() {
    if (!Red.sesion()) return;
    const r = await Red.pedir('/api/regalos/cobrar', 'POST');
    if (!r.ok || !Array.isArray(r.regalos) || !r.regalos.length) return;
    const gemas = r.regalos.reduce((t, g) => t + (g.gemas || 0), 0);
    const oro = r.regalos.reduce((t, g) => t + (g.oro || 0), 0);
    const p = raiz.Perfil.actual();
    raiz.Perfil.guardar({ ...p, gemas: p.gemas + gemas, oro: p.oro + oro }, { sinAvisar: true });
    await subir();
    UI.render();
    UI.sonar('victoria');
    Fx.aviso(`🎁 ¡Recibiste un regalo! ${gemas ? `+${gemas} 💎 ` : ''}${oro ? `+${oro} 💰` : ''}`);
  }

  async function alEntrar() {
    Red.conectar();
    await sincronizar();
    UI.ir('inicio');
    await cobrarRegalos();
  }

  // ---- Acciones -------------------------------------------------------------------------------------
  async function ir() {
    const nombre = ((document.getElementById('cu-nombre') || {}).value || '').trim();
    const clave = (document.getElementById('cu-clave') || {}).value || '';
    const crear = st.modo === 'crear';
    if (crear && clave !== ((document.getElementById('cu-clave2') || {}).value || '')) { st.error = 'Las claves no coinciden.'; UI.render(); return; }
    st.cargando = true;
    st.error = '';
    UI.render();
    const r = await Red.entrar(nombre, clave, crear);
    st.cargando = false;
    if (!r.ok) { st.error = r.error; UI.render(); return; }
    UI.sonar('victoria');
    await alEntrar();
  }

  async function cerrarSesion() {
    if (relojSubida) await subir();
    await Red.salir();
    UI.ir('cuenta');
  }

  UI.agregar({
    vistas: { cuenta: pantallaCuenta },
    acciones: {
      'cu-modo': (el) => { st.modo = el.dataset.modo; st.error = ''; UI.render(); },
      'cu-ir': ir,
    },
  });
  UI.guardia = (pantalla) => (Red.sesion() ? pantalla : 'cuenta');

  // Enter en la clave = entrar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && UI.estado.pantalla === 'cuenta' && e.target.closest && e.target.closest('.cu-tarjeta')) ir();
  });

  raiz.Perfil.alGuardar(() => { if (Red.sesion()) programarSubida(); });
  Red.escuchar('regalo', () => cobrarRegalos());
  document.addEventListener('visibilitychange', () => { if (document.hidden && relojSubida) subir(); });

  raiz.Cuenta = Object.freeze({ cerrarSesion, subir, estadoNube: () => st.nube });

  // Al abrir el juego: si ya había sesión, se sincroniza; si no, se busca el servidor para la pantalla de entrar.
  if (Red.sesion()) alEntrar();
  else Red.descubrir(true).finally(() => { if (UI.estado.pantalla === 'cuenta') UI.render(); });
  UI.render();
})(this);
