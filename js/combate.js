/* Efectos de combate: embestidas con peso, proyectiles de hechizos, impactos con
 * partículas según el reino y cartas que se rompen en pedazos al morir. */
(function (raiz) {
  'use strict';
  const reducido = !!(raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const MARGEN_MS = 400;
  // Modo liviano (celular): sin copias de cartas en pantalla y menos partículas.
  const liviano = () => document.documentElement.classList.contains('liviano');
  const PARTICULAS_LIVIANO = 0.35;
  // Espera a que termine una animación, con un tope: si el navegador la congela
  // (pestaña oculta, app en segundo plano) el juego no queda trabado.
  const terminar = (anim, ms) => Promise.race([anim.finished.catch(() => {}), espera(ms + MARGEN_MS)]);

  const TIEMPO = Object.freeze({ impulso: 230, carga: 150, pausa: 70, regreso: 320, proyectil: 420, escalonado: 90, pedazos: 780 });
  const GOLPE_TEMBLOR = 5;

  // Cómo se ve el impacto de cada reino
  const ESTILO = Object.freeze({
    fuego: { colores: ['#fff3a0', '#ffb02e', '#ff5a1a', '#ff2a1a'], forma: 'chispa', gravedad: -0.05, tajo: '#ffb02e' },
    hielo: { colores: ['#ffffff', '#c9f6ff', '#7af4ff', '#3cb8ff'], forma: 'esquirla', gravedad: 0.18, tajo: '#9ff1ff' },
    bosque: { colores: ['#d8ff8a', '#7dff9e', '#2bff88', '#0f9e4f'], forma: 'hoja', gravedad: 0.06, tajo: '#7dff9e' },
    arcano: { colores: ['#ffffff', '#ffb3ff', '#ea85ff', '#9b5cff'], forma: 'estrella', gravedad: -0.02, tajo: '#ea85ff' },
    corona: { colores: ['#fffbe0', '#ffe27a', '#ffc531', '#ff9d00'], forma: 'chispa', gravedad: 0.12, tajo: '#ffe27a' },
  });
  const estiloDe = (reino) => ESTILO[reino] || ESTILO.corona;
  const sonido = () => raiz.Sonido || null;

  const centro = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // ---- Sistema de partículas en un lienzo sobre toda la pantalla -------------------
  const particulas = [];
  let lienzo = null;
  let ctx = null;
  let corriendo = false;

  function asegurarLienzo() {
    if (lienzo) return;
    lienzo = document.createElement('canvas');
    lienzo.id = 'fx-combate';
    document.body.appendChild(lienzo);
    ctx = lienzo.getContext('2d');
    const medir = () => {
      const dpr = liviano() ? 1 : Math.min(2, raiz.devicePixelRatio || 1);
      lienzo.width = raiz.innerWidth * dpr;
      lienzo.height = raiz.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    raiz.addEventListener('resize', medir);
  }

  function dibujarParticula(p, vida) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, vida);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    const t = p.r;
    ctx.beginPath();
    if (p.forma === 'esquirla') {
      ctx.moveTo(0, -t * 2.2); ctx.lineTo(t * 0.7, 0); ctx.lineTo(0, t * 2.2); ctx.lineTo(-t * 0.7, 0);
    } else if (p.forma === 'hoja') {
      ctx.ellipse(0, 0, t * 1.6, t * 0.7, 0, 0, Math.PI * 2);
    } else if (p.forma === 'estrella') {
      for (let i = 0; i < 8; i++) {
        const radio = i % 2 === 0 ? t * 2 : t * 0.6;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * radio, Math.sin(a) * radio);
      }
    } else {
      ctx.arc(0, 0, t, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  function cuadro() {
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= 1;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.vx *= 0.96; p.vy = p.vy * 0.96 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      dibujarParticula(p, p.vida / p.max);
    }
    if (particulas.length) raiz.requestAnimationFrame(cuadro);
    else { corriendo = false; ctx.clearRect(0, 0, lienzo.width, lienzo.height); }
  }

  function estallido(x, y, reino, cantidad, fuerza, direccion) {
    if (reducido) return;
    asegurarLienzo();
    const e = estiloDe(reino);
    const total = liviano() ? Math.ceil(cantidad * PARTICULAS_LIVIANO) : cantidad;
    for (let i = 0; i < total; i++) {
      const base = direccion === undefined ? Math.random() * Math.PI * 2 : direccion + (Math.random() - 0.5) * 2.2;
      const vel = (2 + Math.random() * 7) * fuerza;
      const max = 28 + Math.random() * 30;
      particulas.push({
        x, y, vx: Math.cos(base) * vel, vy: Math.sin(base) * vel, g: e.gravedad,
        r: 1.6 + Math.random() * 2.8, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        color: e.colores[Math.floor(Math.random() * e.colores.length)], forma: e.forma, vida: max, max,
      });
    }
    if (!corriendo) { corriendo = true; raiz.requestAnimationFrame(cuadro); }
  }

  // ---- Piezas visuales del impacto ----------------------------------------------------------
  function tajo(x, y, angulo, color, retraso) {
    const d = document.createElement('div');
    d.className = 'tajo';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.setProperty('--color', color);
    document.body.appendChild(d);
    const anim = d.animate([
      { transform: `translate(-50%, -50%) rotate(${angulo}rad) scaleX(0)`, opacity: 1 },
      { transform: `translate(-50%, -50%) rotate(${angulo}rad) scaleX(1.25)`, opacity: 1, offset: 0.45 },
      { transform: `translate(-50%, -50%) rotate(${angulo}rad) scaleX(1.4)`, opacity: 0 },
    ], { duration: 300, delay: retraso || 0, easing: 'ease-out', fill: 'both' });
    anim.finished.then(() => d.remove()).catch(() => d.remove());
  }

  function retroceso(el, angulo, fuerza) {
    if (!el || !el.animate) return;
    const dist = 10 + fuerza * 3;
    const dx = Math.cos(angulo) * dist;
    const dy = Math.sin(angulo) * dist;
    el.animate([
      { transform: 'translate(0,0)', filter: 'brightness(1)' },
      { transform: `translate(${dx}px, ${dy}px) rotate(${dx > 0 ? 4 : -4}deg)`, filter: 'brightness(2.6) saturate(.4)', offset: 0.2 },
      { transform: `translate(${-dx * 0.25}px, ${-dy * 0.25}px)`, filter: 'brightness(1.3)', offset: 0.6 },
      { transform: 'translate(0,0)', filter: 'brightness(1)' },
    ], { duration: 380, easing: 'ease-out' });
  }

  /** Golpe en un elemento: tajo, partículas, retroceso y, si es fuerte, temblor. */
  function impacto(el, reino, fuerza, angulo) {
    if (!el) return;
    const c = centro(el);
    const e = estiloDe(reino);
    const dir = angulo === undefined ? Math.random() * Math.PI * 2 : angulo;
    tajo(c.x, c.y, dir + 0.6, e.tajo, 0);
    if (fuerza >= 3) tajo(c.x, c.y, dir - 0.6, '#ffffff', 60);
    estallido(c.x, c.y, reino, 18 + fuerza * 6, 0.8 + fuerza * 0.12, dir);
    retroceso(el, dir, fuerza);
    if (fuerza >= GOLPE_TEMBLOR && raiz.Fx && raiz.Fx.temblor) raiz.Fx.temblor();
  }

  // ---- Embestida de una unidad ----------------------------------------------------------------
  function estelas(el, dx, dy) {
    if (liviano()) return; // tres copias de la carta volando: lo más caro del ataque en el celular
    const r = el.getBoundingClientRect();
    [0.25, 0.45, 0.65].forEach((t, i) => {
      const fantasma = el.cloneNode(true);
      fantasma.classList.add('fantasma');
      Object.assign(fantasma.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      document.body.appendChild(fantasma);
      const anim = fantasma.animate([
        { transform: `translate(${dx * t}px, ${dy * t}px) scale(1.12)`, opacity: 0.45 - i * 0.1 },
        { transform: `translate(${dx * t}px, ${dy * t}px) scale(1.05)`, opacity: 0 },
      ], { duration: 260, delay: i * 25, easing: 'ease-out', fill: 'both' });
      anim.finished.then(() => fantasma.remove()).catch(() => fantasma.remove());
    });
  }

  /**
   * La unidad toma impulso, carga contra el objetivo y vuelve.
   * alImpactar() se llama en el instante del golpe (ahí aparecen los números de daño).
   */
  async function embestida(atacante, objetivo, reino, fuerza, alImpactar) {
    const golpear = typeof alImpactar === 'function' ? alImpactar : () => {};
    if (!atacante || !objetivo || !atacante.animate || reducido) { golpear(); return; }
    const a = centro(atacante);
    const b = centro(objetivo);
    const dx = (b.x - a.x) * 0.8;
    const dy = (b.y - a.y) * 0.8;
    const angulo = Math.atan2(b.y - a.y, b.x - a.x);
    const giro = dx >= 0 ? -6 : 6;
    atacante.classList.add('atacando');

    const impulso = atacante.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)' },
      { transform: `translate(${-dx * 0.1}px, ${-dy * 0.1}px) scale(1.2) rotate(${giro}deg)` },
    ], { duration: TIEMPO.impulso, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    await terminar(impulso, TIEMPO.impulso);

    estelas(atacante, dx, dy);
    if (sonido()) sonido().efecto('carga');
    const carga = atacante.animate([
      { transform: `translate(${-dx * 0.1}px, ${-dy * 0.1}px) scale(1.2) rotate(${giro}deg)` },
      { transform: `translate(${dx}px, ${dy}px) scale(1.12) rotate(${-giro / 2}deg)` },
    ], { duration: TIEMPO.carga, easing: 'cubic-bezier(.6,0,1,.6)', fill: 'forwards' });
    await terminar(carga, TIEMPO.carga);

    impacto(objetivo, reino, fuerza, angulo);
    if (sonido()) sonido().golpe(reino, fuerza);
    golpear();
    await espera(TIEMPO.pausa);

    const regreso = atacante.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(1.12) rotate(${-giro / 2}deg)` },
      { transform: `translate(${dx * 0.75}px, ${dy * 0.75}px) scale(1.08) rotate(0deg)`, offset: 0.25 },
      { transform: 'translate(0,0) scale(1) rotate(0deg)' },
    ], { duration: TIEMPO.regreso, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    await terminar(regreso, TIEMPO.regreso);
    impulso.cancel(); carga.cancel(); regreso.cancel();
    atacante.classList.remove('atacando');
  }

  // ---- Proyectiles de hechizos y efectos "Al jugar" -----------------------------------------
  async function proyectil(origen, destino, reino, retraso) {
    await espera(retraso);
    const a = centro(origen);
    const b = centro(destino);
    const e = estiloDe(reino);
    const bola = document.createElement('div');
    bola.className = `proyectil proyectil-${reino}`;
    bola.style.setProperty('--color', e.tajo);
    bola.style.left = a.x + 'px';
    bola.style.top = a.y + 'px';
    document.body.appendChild(bola);
    if (sonido()) sonido().lanzar(reino);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const curva = Math.min(160, Math.hypot(dx, dy) * 0.35) * (dx >= 0 ? -1 : 1);
    const pasos = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const arco = Math.sin(t * Math.PI) * curva;
      return { transform: `translate(calc(-50% + ${dx * t + arco * 0.4}px), calc(-50% + ${dy * t - Math.abs(arco)}px)) scale(${1 + Math.sin(t * Math.PI) * 0.4})` };
    });
    const vuelo = bola.animate(pasos, { duration: TIEMPO.proyectil, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' });
    const rastro = setInterval(() => {
      const c = centro(bola);
      estallido(c.x, c.y, reino, 2, 0.25);
    }, 30);
    await terminar(vuelo, TIEMPO.proyectil);
    clearInterval(rastro);
    bola.remove();
    impacto(destino, reino, 3, Math.atan2(dy, dx));
    if (sonido()) sonido().golpe(reino, 3);
  }

  /** Lanza un proyectil a cada destino (escalonados) y espera a que lleguen todos. */
  async function proyectiles(origen, destinos, reino) {
    if (!origen || !destinos.length || reducido) return;
    await Promise.all(destinos.map((d, i) => proyectil(origen, d, reino, i * TIEMPO.escalonado)));
  }

  // ---- La carta se rompe en pedazos ---------------------------------------------------------------
  const CORTES = [0, 33.3, 66.6];

  function estallar(el) {
    if (!el) return;
    if (reducido) { el.classList.add('muriendo'); return; }
    const r = el.getBoundingClientRect();
    if (liviano()) {
      // En vez de 9 copias recortadas: la misma carta se hunde y se desvanece.
      el.animate([
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(1.15) rotate(-4deg)', opacity: 1, offset: 0.25 },
        { transform: 'scale(.4) rotate(12deg) translateY(30%)', opacity: 0 },
      ], { duration: 420, easing: 'ease-in', fill: 'forwards' });
      estallido(r.left + r.width / 2, r.top + r.height / 2, el.dataset.reino, 30, 1.1);
      if (sonido()) sonido().efecto('romper');
      return;
    }
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    CORTES.forEach((fila) => CORTES.forEach((col) => {
      const pedazo = el.cloneNode(true);
      pedazo.classList.add('pedazo');
      pedazo.classList.remove('muriendo', 'atacando');
      Object.assign(pedazo.style, {
        left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        clipPath: `inset(${fila}% ${100 - col - 33.4}% ${100 - fila - 33.4}% ${col}%)`,
      });
      document.body.appendChild(pedazo);
      const px = r.left + (col + 16.7) / 100 * r.width;
      const py = r.top + (fila + 16.7) / 100 * r.height;
      const ang = Math.atan2(py - c.y, px - c.x) + (Math.random() - 0.5) * 0.6;
      const dist = 50 + Math.random() * 70;
      const anim = pedazo.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'brightness(2)' },
        { transform: `translate(${Math.cos(ang) * dist * 0.6}px, ${Math.sin(ang) * dist * 0.6}px) rotate(${(Math.random() - 0.5) * 50}deg)`, opacity: 1, filter: 'brightness(1.2)', offset: 0.35 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 90}px) rotate(${(Math.random() - 0.5) * 140}deg)`, opacity: 0, filter: 'brightness(.6)' },
      ], { duration: TIEMPO.pedazos, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
      anim.finished.then(() => pedazo.remove()).catch(() => pedazo.remove());
    }));
    el.style.visibility = 'hidden';
    estallido(c.x, c.y, el.dataset.reino, 30, 1.1);
    if (sonido()) sonido().efecto('romper');
  }

  raiz.Combate = Object.freeze({ embestida, proyectiles, impacto, estallar, estallido });
})(this);
