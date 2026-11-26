/* Conexión con el servidor online: dirección, sesión guardada, pedidos a la API
 * y avisos en vivo (Server-Sent Events). */
(function (raiz) {
  'use strict';
  const CLAVE_SESION = 'cinco-reinos-sesion';
  const ESPERA_MS = 10000;
  // La PC del dueño publica acá su dirección actual cada vez que prende el servidor.
  const AVISO_SERVIDOR = 'https://api.github.com/gists/6c3028e6bd22115f6ced46115235dff0';
  const DIRECCION_VALIDA = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
  let descubierta = { url: '', encendido: null, hora: 0 };
  const VIGENCIA_MS = 60000;

  /** Dirección elegida a mano en Ajustes, o la del propio servidor si el juego vino de ahí. */
  function base() {
    const elegida = raiz.Ajustes ? raiz.Ajustes.actual().servidor.trim() : '';
    if (elegida) return elegida.replace(/\/+$/, '');
    const l = raiz.location;
    const vieneDelServidor = /^https?:$/.test(l.protocol) && (/\.trycloudflare\.com$/.test(l.hostname) || l.port === '8799');
    if (vieneDelServidor) return l.origin;
    return descubierta.url;
  }

  // Dos caminos: el archivo crudo (sin límite de consultas) y, si falla, la API de GitHub.
  const AVISO_CRUDO = 'https://gist.githubusercontent.com/yoalejandro4-source/6c3028e6bd22115f6ced46115235dff0/raw/servidor.json';
  async function leerAviso() {
    try {
      const r = await fetch(`${AVISO_CRUDO}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(ESPERA_MS) });
      if (r.ok) return await r.json();
    } catch (e) { /* se prueba con la API */ }
    const r = await fetch(AVISO_SERVIDOR, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(ESPERA_MS) });
    const g = await r.json();
    return JSON.parse(g.files['servidor.json'].content);
  }

  /** Lee el aviso de GitHub: ¿está prendido el servidor y en qué dirección? */
  async function descubrir(forzar) {
    if (!forzar && descubierta.hora && Date.now() - descubierta.hora < VIGENCIA_MS) return descubierta;
    try {
      const d = await leerAviso();
      const url = typeof d.url === 'string' && DIRECCION_VALIDA.test(d.url) ? d.url : '';
      descubierta = { url, encendido: !!d.encendido && !!url, hora: Date.now() };
    } catch (e) {
      descubierta = { ...descubierta, encendido: descubierta.url ? descubierta.encendido : null, hora: Date.now() };
    }
    return descubierta;
  }

  /** La dirección a usar: manual, propia o la publicada (si la sesión quedó con una vieja, la renueva). */
  async function resolver() {
    const fija = base() && base() !== descubierta.url ? base() : '';
    if (fija) return fija;
    const d = await descubrir();
    if (sesion && d.url && sesion.base !== d.url) guardarSesion({ ...sesion, base: d.url });
    return d.url;
  }

  function leerSesion() {
    try {
      const s = JSON.parse(raiz.localStorage.getItem(CLAVE_SESION) || 'null');
      return s && typeof s.token === 'string' ? s : null;
    } catch (e) {
      return null;
    }
  }
  let sesion = leerSesion();

  function guardarSesion(s) {
    sesion = s;
    try {
      if (s) raiz.localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
      else raiz.localStorage.removeItem(CLAVE_SESION);
    } catch (e) { /* sin almacenamiento: dura hasta cerrar el juego */ }
  }

  /** Pedido a la API. Nunca tira: devuelve { ok, error, ... }. */
  async function pedir(ruta, metodo, cuerpo, reintento) {
    const b = await resolver();
    if (!b) return { ok: false, error: descubierta.encendido === false ? 'El servidor está apagado ahora. Probá más tarde.' : 'No encontré el servidor. Revisá tu internet.' };
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), ESPERA_MS);
    try {
      const r = await fetch(b + ruta, {
        method: metodo || 'GET', signal: control.signal,
        headers: { 'Content-Type': 'application/json', ...(sesion ? { Authorization: `Bearer ${sesion.token}` } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const datos = await r.json().catch(() => ({ ok: false, error: `El servidor respondió ${r.status}.` }));
      if (r.status === 401 && sesion) guardarSesion(null);
      return datos;
    } catch (e) {
      // Puede que la PC haya cambiado de dirección: se vuelve a buscar una vez.
      if (!reintento) { await descubrir(true); return pedir(ruta, metodo, cuerpo, true); }
      return { ok: false, error: e.name === 'AbortError' ? 'El servidor no responde.' : 'No me pude conectar al servidor.' };
    } finally {
      clearTimeout(corte);
    }
  }

  async function entrar(nombre, clave, crear) {
    sesion = null;
    const b = await resolver();
    if (!b) return { ok: false, error: descubierta.encendido === false ? 'El servidor está apagado ahora. Probá más tarde.' : 'No encontré el servidor. Revisá tu internet.' };
    sesion = { base: b, token: '' };
    const r = await pedir(crear ? '/api/registro' : '/api/entrar', 'POST', { nombre, clave });
    guardarSesion(r.ok ? { base: b, token: r.token, nombre: r.usuario.nombre } : null);
    return r;
  }

  async function salir() {
    await pedir('/api/salir', 'POST');
    desconectar();
    guardarSesion(null);
  }

  // ---- Avisos en vivo: una sola conexión para todo el juego, cada módulo escucha lo suyo -------------
  let fuente = null;
  let conectadoAhora = false;
  const oyentes = {}; // tipo de aviso ('chat', 'invitacion', ...) o '*' -> [funciones]
  function escuchar(tipo, fn) { (oyentes[tipo] = oyentes[tipo] || []).push(fn); }
  function repartir(msg) {
    [...(oyentes[msg.tipo] || []), ...(oyentes['*'] || [])].forEach((fn) => {
      try { fn(msg); } catch (err) { if (raiz.console) raiz.console.warn('Falló un aviso del servidor', msg.tipo, err); }
    });
  }

  // Los avisos se piden con "espera larga": el servidor contesta apenas hay algo nuevo
  // (o a los ~20 s). Anda a través del túnel de internet, que retiene los avisos en vivo.
  const ESPERA_LARGA_MS = 30000;
  const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  function avisarConexion(si) {
    if (conectadoAhora === si) return;
    conectadoAhora = si;
    repartir({ tipo: 'conexion', conectado: si });
  }

  function conectar() {
    desconectar();
    if (!sesion || !sesion.base) return false;
    const ciclo = { activo: true, ultimo: 0, control: null };
    fuente = ciclo;
    (async () => {
      let fallos = 0;
      while (ciclo.activo && sesion) {
        ciclo.control = new AbortController();
        const corte = setTimeout(() => ciclo.control.abort(), ESPERA_LARGA_MS);
        try {
          const b = await resolver();
          const r = await fetch(`${b}/api/espera?desde=${ciclo.ultimo}`, {
            headers: { Authorization: `Bearer ${sesion.token}` }, signal: ciclo.control.signal, cache: 'no-store',
          });
          if (r.status === 401) { guardarSesion(null); avisarConexion(false); break; }
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || 'sin respuesta');
          fallos = 0;
          avisarConexion(true);
          ciclo.ultimo = d.ultimo;
          d.mensajes.forEach(repartir);
        } catch (e) {
          if (!ciclo.activo) break;
          fallos += 1;
          avisarConexion(false);
          if (fallos >= 2) await descubrir(true); // la PC pudo cambiar de dirección
          await pausa(Math.min(10000, 1000 * fallos));
        } finally {
          clearTimeout(corte);
        }
      }
    })();
    return true;
  }
  function desconectar() {
    if (!fuente) return;
    fuente.activo = false;
    if (fuente.control) fuente.control.abort();
    fuente = null;
    avisarConexion(false);
  }

  raiz.Red = Object.freeze({
    base, descubrir, pedir, entrar, salir, conectar, desconectar, escuchar,
    enLinea: () => conectadoAhora,
    servidor: () => ({ ...descubierta }),
    sesion: () => (sesion ? { ...sesion } : null),
    conectado: () => !!fuente,
  });
})(this);
