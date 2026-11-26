/* Efectos visuales: partículas de fondo, números flotantes, embestidas y avisos. */
(function (raiz) {
  'use strict';
  const reducido = !!(raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Modo liviano: en celulares y tablets se apagan los efectos que más cuestan (ver css/liviano.css).
  const liviano = !!(raiz.matchMedia && raiz.matchMedia('(pointer: coarse)').matches);
  if (liviano && raiz.document) raiz.document.documentElement.classList.add('liviano');
  const esLiviano = () => !!raiz.document && raiz.document.documentElement.classList.contains('liviano');

  // En modo liviano las animaciones no animan "filter" (brillo, desenfoque): en el celular
  // cada cuadro con filtro se repinta entero. Se queda el movimiento, que es barato.
  if (raiz.Element && raiz.Element.prototype.animate) {
    const animarOriginal = raiz.Element.prototype.animate;
    raiz.Element.prototype.animate = function (cuadros, opciones) {
      const sinFiltro = esLiviano() && Array.isArray(cuadros)
        ? cuadros.map((c) => { if (!c || !('filter' in c)) return c; const { filter, ...resto } = c; return resto; })
        : cuadros;
      return animarOriginal.call(this, sinFiltro, opciones);
    };
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  function centro(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function flotante(el, texto, clase) {
    if (!el) return;
    const c = centro(el);
    const d = document.createElement('div');
    d.className = 'flotante ' + clase;
    d.textContent = texto;
    d.style.left = (c.x + (Math.random() - 0.5) * 24) + 'px';
    d.style.top = c.y + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  function impacto(el) {
    if (!el) return;
    const c = centro(el);
    const d = document.createElement('div');
    d.className = 'impacto';
    d.style.left = c.x + 'px';
    d.style.top = c.y + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }

  function sacudir(el) {
    if (!el || !el.animate) return;
    el.animate([
      { transform: 'translate(0,0)' }, { transform: 'translate(-7px,3px) rotate(-2deg)' },
      { transform: 'translate(7px,-3px) rotate(2deg)' }, { transform: 'translate(-4px,0)' }, { transform: 'translate(0,0)' },
    ], { duration: 340 });
  }

  const GOLPE_FUERTE = 3;

  // Sacude toda la pantalla cuando un héroe recibe un golpe fuerte.
  function temblor() {
    const app = document.getElementById('app');
    if (reducido || !app || !app.animate) return;
    if (esLiviano()) { // sacudir toda la pantalla repinta todo en el celular: queda solo el destello
      const d = document.createElement('div');
      d.className = 'destello-rojo';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 500);
      return;
    }
    app.animate([
      { transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(9px,-7px)' },
      { transform: 'translate(-6px,-4px)' }, { transform: 'translate(5px,5px)' }, { transform: 'translate(0,0)' },
    ], { duration: 420, easing: 'ease-out' });
    const destello = document.createElement('div');
    destello.className = 'destello-rojo';
    document.body.appendChild(destello);
    setTimeout(() => destello.remove(), 500);
  }

  const SONIDO_EVENTO = Object.freeze({ curar: 'curar', escudo: 'escudo', congelar: 'congelar', buff: 'buff' });

  function sonarEvento(ev) {
    const S = raiz.Sonido;
    if (!S) return;
    if (ev.tipo === 'dano') S.efecto(ev.ref && ev.ref.heroe && ev.n >= GOLPE_FUERTE ? 'golpe-heroe' : 'dano');
    else if (SONIDO_EVENTO[ev.tipo]) S.efecto(SONIDO_EVENTO[ev.tipo]);
  }

  /** Muestra los eventos sobre el tablero actual. Devuelve true si hubo algo visible. */
  function animarEventos(eventos, buscar) {
    let hubo = false;
    eventos.forEach((ev) => {
      sonarEvento(ev);
      const el = ev.ref ? buscar(ev.ref) : null;
      switch (ev.tipo) {
        case 'dano':
          if (el) {
            flotante(el, '-' + ev.n, ev.n >= 5 ? 'dano fuerte' : 'dano');
            impacto(el);
            if (!el.getAnimations || !el.getAnimations().length) sacudir(el);
            hubo = true;
          }
          if (ev.ref.heroe && ev.n >= GOLPE_FUERTE) temblor();
          break;
        case 'curar': if (el) { flotante(el, '+' + ev.n, 'curar'); hubo = true; } break;
        case 'escudo': if (el) { flotante(el, '¡Bloqueado!', 'escudo'); hubo = true; } break;
        case 'congelar': if (el) { flotante(el, '❄', 'congela'); el.classList.add('congelando'); hubo = true; } break;
        case 'buff': if (el) { flotante(el, `+${ev.atq}/+${ev.vida}`, 'buff'); hubo = true; } break;
        case 'destruir': if (el) { flotante(el, '☠', 'dano'); hubo = true; } break;
        case 'muerte':
          if (el) {
            if (raiz.Combate) raiz.Combate.estallar(el); else el.classList.add('muriendo');
            hubo = true;
          }
          break;
        case 'quemada': aviso(`Mano llena: se quemó ${ev.carta.nombre}`); break;
        case 'fatiga': aviso(`¡Mazo vacío! Fatiga: ${ev.n} de daño`); break;
        default: break;
      }
    });
    return hubo;
  }

  function anilloInvocacion(el) {
    const c = centro(el);
    const d = document.createElement('div');
    d.className = 'anillo-invocacion';
    d.style.left = c.x + 'px';
    d.style.top = c.y + 'px';
    d.style.setProperty('--color', getComputedStyle(el).getPropertyValue('--c1').trim() || '#fff');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }

  function animarAparicion(eventos, buscar) {
    eventos.filter((ev) => ev.tipo === 'invocar').forEach((ev) => {
      const el = buscar(ev.ref);
      if (!el) return;
      el.classList.add('aparece');
      anilloInvocacion(el);
    });
  }

  // ---- Inclinación 3D de las cartas siguiendo el mouse ------------------------------
  const VARIABLES_INCLINACION = ['--rx', '--ry', '--px', '--py', '--mx', '--my'];
  const INCLINACION_MAX = Object.freeze({ x: 14, y: 18 });

  function activarInclinacion() {
    if (reducido || liviano) return;
    let actual = null;
    let ultimo = null;
    let pedido = false;
    const soltar = () => {
      if (!actual) return;
      actual.classList.remove('inclinada');
      VARIABLES_INCLINACION.forEach((v) => actual.style.removeProperty(v));
      actual = null;
    };
    const aplicar = () => {
      pedido = false;
      if (!actual || !ultimo || !actual.isConnected) { soltar(); return; }
      const r = actual.getBoundingClientRect();
      const px = Math.max(-1, Math.min(1, ((ultimo.clientX - r.left) / r.width) * 2 - 1));
      const py = Math.max(-1, Math.min(1, ((ultimo.clientY - r.top) / r.height) * 2 - 1));
      const s = actual.style;
      s.setProperty('--rx', (-py * INCLINACION_MAX.x).toFixed(2) + 'deg');
      s.setProperty('--ry', (px * INCLINACION_MAX.y).toFixed(2) + 'deg');
      s.setProperty('--px', px.toFixed(3));
      s.setProperty('--py', py.toFixed(3));
      s.setProperty('--mx', ((px + 1) * 50).toFixed(1) + '%');
      s.setProperty('--my', ((py + 1) * 50).toFixed(1) + '%');
      actual.classList.add('inclinada');
    };
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const carta = e.target.closest('.carta');
      if (carta !== actual) soltar();
      if (!carta) return;
      actual = carta;
      ultimo = e;
      if (!pedido) { pedido = true; raiz.requestAnimationFrame(aplicar); }
    });
    document.addEventListener('pointerleave', soltar);
  }

  async function overlayTemporal(clase, html, ms) {
    const o = document.createElement('div');
    o.className = clase;
    o.innerHTML = html;
    document.body.appendChild(o);
    await espera(reducido ? Math.min(ms, 900) : ms);
    o.classList.add('saliendo');
    await espera(280);
    o.remove();
  }

  const mostrarFusion = (a, b, r, titulo) => overlayTemporal('overlay-fusion',
    `<div class="fus-rayos"></div><div class="fus-carta fus-a">${a}</div><div class="fus-carta fus-b">${b}</div>
     <div class="fus-destello"></div><div class="fus-carta fus-res">${r}</div><div class="fus-titulo">${titulo}</div>`, 2500);

  const mostrarJugada = (html) => overlayTemporal('overlay-jugada', `<div class="oj-etiqueta">El rival juega</div>${html}`, 1250);

  const banner = (texto) => overlayTemporal('banner', `<span>${texto}</span>`, 900);

  let avisoTimer = null;
  function aviso(texto) {
    let d = document.getElementById('aviso');
    if (!d) { d = document.createElement('div'); d.id = 'aviso'; document.body.appendChild(d); }
    d.textContent = texto;
    d.classList.remove('visible');
    void d.offsetWidth;
    d.classList.add('visible');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => d.classList.remove('visible'), 1900);
  }

  let inspTimer = null;
  function inspector(html, ms) {
    let d = document.getElementById('inspector');
    if (!d) { d = document.createElement('div'); d.id = 'inspector'; document.body.appendChild(d); }
    d.innerHTML = html;
    d.classList.add('visible');
    clearTimeout(inspTimer);
    if (ms) inspTimer = setTimeout(ocultarInspector, ms);
  }
  function ocultarInspector() {
    const d = document.getElementById('inspector');
    if (d) d.classList.remove('visible');
    if (raiz.Lupa) raiz.Lupa.ocultar();
  }

  // Partículas del menú: cada color se dibuja una vez en un "sello" y después solo se estampa
  // (crear degradados en cada cuadro era lo más caro). Se duermen en batalla, con la
  // ventana oculta o en modo liviano, y van a ~30 cuadros por segundo.
  const PARTICULAS = 40;
  const CUADRO_PARTICULAS_MS = 33;
  function selloParticula(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return c;
  }

  function iniciarParticulas() {
    if (reducido || liviano) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'particulas';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const sellos = ['#ffb02e', '#ff4d2e', '#7af4ff', '#ea85ff', '#2bff88', '#ffd84a'].map(selloParticula);
    let w = 0;
    let h = 0;
    const medir = () => {
      w = raiz.innerWidth; h = raiz.innerHeight;
      canvas.width = w; canvas.height = h;
    };
    medir();
    raiz.addEventListener('resize', medir);
    const nueva = (alAzar) => ({
      x: Math.random() * w, y: alAzar ? Math.random() * h : h + 10, r: 1 + Math.random() * 2.4,
      v: 0.5 + Math.random() * 1.4, d: (Math.random() - 0.5) * 0.6, f: Math.random() * 6.28,
      s: sellos[Math.floor(Math.random() * sellos.length)],
    });
    const parts = Array.from({ length: PARTICULAS }, () => nueva(true));
    const dormida = () => document.hidden || esLiviano() || (raiz.UI && raiz.UI.estado && raiz.UI.estado.pantalla === 'batalla');
    let ultimo = 0;
    let vacia = false;
    const paso = (t) => {
      raiz.requestAnimationFrame(paso);
      if (t - ultimo < CUADRO_PARTICULAS_MS) return;
      ultimo = t;
      if (dormida()) {
        if (!vacia) { ctx.clearRect(0, 0, w, h); vacia = true; }
        return;
      }
      vacia = false;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y -= p.v; p.f += 0.04; p.x += p.d + Math.sin(p.f) * 0.6;
        if (p.y < -12) parts[i] = nueva(false);
        const lado = p.r * 8;
        ctx.drawImage(p.s, p.x - lado / 2, p.y - lado / 2, lado, lado);
      }
    };
    raiz.requestAnimationFrame(paso);
  }

  raiz.Fx = Object.freeze({
    espera, animarEventos, animarAparicion, mostrarFusion, mostrarJugada, banner, aviso,
    inspector, ocultarInspector, iniciarParticulas, activarInclinacion, temblor,
  });
})(this);
