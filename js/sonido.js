/* Sonido del juego. Música orquestal y efectos de foley en archivos CC0 (audio/,
 * ver audio/CREDITOS.txt) más capas sintetizadas con Web Audio para la magia y
 * los golpes según el reino. Si un archivo no carga, suena la versión sintetizada. */
(function (raiz) {
  'use strict';
  const CLAVE_MODO = 'cinco-reinos-sonido';
  const MODOS = ['todo', 'efectos', 'nada'];
  const VOLUMEN = Object.freeze({ maestro: 0.85, musica: 0.5, efectos: 0.9, reverb: 0.35 });
  const ESPACIO_MS = 45; // mínimo entre dos sonidos iguales

  let ctx = null;
  let maestro = null;
  let busMusica = null;
  let busEfectos = null;
  let envioReverb = null;
  let bufRuido = null;
  let desbloqueado = false;
  let modo = leerModo();
  // Volumen elegido en Ajustes (0 a 1), se multiplica por los volúmenes base
  const factor = { musica: 1, efectos: 1 };
  const ultimo = {};

  function leerModo() {
    try {
      const m = raiz.localStorage.getItem(CLAVE_MODO);
      return MODOS.includes(m) ? m : 'todo';
    } catch (e) {
      return 'todo';
    }
  }

  function guardarModo() {
    try { raiz.localStorage.setItem(CLAVE_MODO, modo); } catch (e) { /* sin almacenamiento: queda solo en memoria */ }
  }

  // ---- Arranque ---------------------------------------------------------------------
  function respuestaReverb(segundos) {
    const largo = Math.floor(ctx.sampleRate * segundos);
    const buf = ctx.createBuffer(2, largo, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2.6);
    }
    return buf;
  }

  function iniciar() {
    if (ctx) return ctx;
    const AC = raiz.AudioContext || raiz.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    maestro = ctx.createGain();
    busMusica = ctx.createGain();
    busEfectos = ctx.createGain();
    envioReverb = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = respuestaReverb(2.8);
    envioReverb.gain.value = VOLUMEN.reverb;
    busMusica.connect(maestro);
    busEfectos.connect(maestro);
    envioReverb.connect(reverb);
    reverb.connect(maestro);
    maestro.connect(comp);
    comp.connect(ctx.destination);
    bufRuido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = bufRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    aplicarModo();
    return ctx;
  }

  function aplicarModo() {
    if (!ctx) return;
    const t = ctx.currentTime;
    maestro.gain.setTargetAtTime(modo === 'nada' ? 0 : VOLUMEN.maestro, t, 0.05);
    busMusica.gain.setTargetAtTime(modo === 'todo' ? VOLUMEN.musica * factor.musica : 0, t, 0.15);
    busEfectos.gain.setTargetAtTime(VOLUMEN.efectos * factor.efectos, t, 0.05);
  }

  // El navegador solo deja sonar después de un toque o una tecla.
  function desbloquear() {
    if (desbloqueado || !iniciar()) return;
    ctx.resume();
    desbloqueado = true;
    if (temaPedido) arrancar(temaPedido);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, desbloquear, { capture: true, passive: true }));

  function pausar() { if (ctx) ctx.suspend(); if (pista) pista.pause(); }
  function reanudar() {
    if (ctx && desbloqueado) ctx.resume();
    if (pista && pistaActiva && modo === 'todo') pista.play().catch(() => {});
  }

  // ---- Archivos: muestras de foley y pistas de música ----------------------------------
  const RUTA_SFX = 'audio/sfx/';
  const VOL_MUESTRA = 0.75;
  // Efecto del juego -> archivo. Los que están en SOLO_MUESTRA no suman la capa sintetizada.
  const MUESTRA = Object.freeze({
    click: 'metalClick', carta: 'bookPlace1', invocar: 'clothBelt', escudo: 'metalLatch', romper: 'metalPot1',
    voltear: 'bookFlip2', sobre: 'bookOpen', tic: 'metalClick', monedas: 'handleCoins', desenvainar: 'drawKnife1', tela: 'cloth2',
    'golpe-heroe': 'golpe-heroe', dano: 'golpe-dano',
  });
  const SOLO_MUESTRA = Object.freeze(['tic', 'click', 'carta', 'voltear', 'sobre', 'monedas', 'desenvainar', 'tela', 'golpe-heroe', 'dano']);
  // Los golpes (tools/hacer_golpes.py) traen el silbido del arma antes del impacto: se tocan
  // desde un poco antes del impacto para que el golpe caiga justo cuando la carta pega.
  const DESDE = Object.freeze({ 'golpe-ligero': 0.1, 'golpe-fuerte': 0.18, 'golpe-heroe': 0.15 });
  const muestras = {};
  function muestra(archivo, vol) {
    const desde = DESDE[archivo] || 0;
    if (!desbloqueado || modo === 'nada' || typeof Audio === 'undefined') return;
    try {
      const base = muestras[archivo] || (muestras[archivo] = new Audio(RUTA_SFX + archivo + '.ogg'));
      const a = base.paused ? base : base.cloneNode();
      a.volume = Math.min(1, (vol || 1) * VOL_MUESTRA * factor.efectos);
      a.currentTime = desde;
      a.play().catch(() => {});
    } catch (e) { avisarFallo(archivo, e); }
  }

  const MUSICA_ARCHIVO = Object.freeze({ menu: 'audio/menu.ogg', batalla: 'audio/batalla.ogg' });
  const VOL_PISTA = 0.5;
  let pista = null;
  let pistaActiva = null;
  let fundido = null;
  function volumenPista(destino, ms, alFinal) {
    clearInterval(fundido);
    const pasos = Math.max(1, Math.round(ms / 50));
    const inicio = pista.volume;
    let n = 0;
    fundido = setInterval(() => {
      n += 1;
      pista.volume = Math.max(0, Math.min(1, inicio + (destino - inicio) * (n / pasos)));
      if (n >= pasos) { clearInterval(fundido); if (alFinal) alFinal(); }
    }, 50);
  }
  /** Toca la pista del tema; si el archivo falla, cae a la música sintetizada. */
  function tocarPista(nombre) {
    if (typeof Audio === 'undefined') return false;
    if (!pista) {
      pista = new Audio();
      pista.loop = true;
      pista.preload = 'auto';
      pista.addEventListener('error', () => {
        if (!pistaActiva) return;
        const fallo = pistaActiva;
        pistaActiva = null;
        arrancarTema(fallo);
      });
    }
    pistaActiva = nombre;
    tema = null;
    if (!pista.src.endsWith(MUSICA_ARCHIVO[nombre])) { pista.src = MUSICA_ARCHIVO[nombre]; pista.currentTime = 0; }
    pista.volume = 0;
    if (modo === 'todo') pista.play().catch(() => {});
    volumenPista(modo === 'todo' ? VOL_PISTA * factor.musica : 0, 900);
    return true;
  }
  function apagarPista(ms, alFinal) {
    if (!pista || !pistaActiva) { if (alFinal) alFinal(); return; }
    pistaActiva = null;
    volumenPista(0, ms, () => { pista.pause(); if (alFinal) alFinal(); });
  }
  function arrancar(nombre) {
    if (MUSICA_ARCHIVO[nombre] && tocarPista(nombre)) return;
    arrancarTema(nombre);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? pausar() : reanudar()));

  // ---- Piezas de sonido -------------------------------------------------------------
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const COMBO_MS = 2500; // destrucciones seguidas dentro de este tiempo suben de tono
  const COMBO_MAX = 5;
  const combo = { n: 0, ultima: 0 };

  function conectar(nodo, bus, reverb) {
    nodo.connect(bus);
    if (reverb) {
      const envio = ctx.createGain();
      envio.gain.value = reverb;
      nodo.connect(envio);
      envio.connect(envioReverb);
    }
  }

  /** Oscilador con envolvente y filtro opcional. */
  function tono(o) {
    const t = (o.t0 || ctx.currentTime) + (o.delay || 0);
    const dur = o.dur || 0.2;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    let salida = osc;
    if (o.filtro) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.Q.value = o.filtro.q || 0.7;
      fl.frequency.setValueAtTime(o.filtro.f, t);
      if (o.filtro.f1) fl.frequency.exponentialRampToValueAtTime(o.filtro.f1, t + (o.filtro.en || dur));
      osc.connect(fl);
      salida = fl;
    }
    const ataque = o.at || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + ataque);
    if (o.sostener) g.gain.setValueAtTime(o.vol || 0.2, t + Math.max(ataque, dur - (o.rel || 0.3)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    salida.connect(g);
    conectar(g, o.bus || busEfectos, o.reverb);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Ruido filtrado (golpes, soplidos, chispas). */
  function ruido(o) {
    const t = (o.t0 || ctx.currentTime) + (o.delay || 0);
    const dur = o.dur || 0.15;
    const src = ctx.createBufferSource();
    const fl = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = bufRuido;
    src.loop = true;
    fl.type = o.tipo || 'bandpass';
    fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f || 1500, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.at || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl);
    fl.connect(g);
    conectar(g, o.bus || busEfectos, o.reverb);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Tambor grave tipo taiko: golpe con caída de tono más un chasquido. */
  function tambor(f, vol, dur, extra) {
    const o = extra || {};
    tono({ f: f * 2.4, f1: f, dur, vol, tipo: 'sine', at: 0.002, ...o });
    ruido({ dur: 0.06, vol: vol * 0.5, f: 900, tipo: 'lowpass', ...o });
  }

  /** Campana o metal: parciales inarmónicos. */
  function campana(f, vol, dur, extra) {
    [1, 2.76, 5.4, 8.93].forEach((m, i) => tono({ f: f * m, dur: dur / (1 + i * 0.5), vol: vol / (1 + i * 1.3), tipo: 'sine', at: 0.002, ...(extra || {}) }));
  }

  /** Voz de metal/cuerda: varias sierras desafinadas por un filtro que se abre. */
  function voz(f, o) {
    [-7, 0, 7].forEach((det) => tono({
      f, dur: o.dur, vol: (o.vol || 0.06) / 2, tipo: 'sawtooth', detune: det, at: o.at || 0.06, sostener: true, rel: o.rel || 0.4,
      filtro: { f: o.f0 || 400, f1: o.f1 || 1600, en: o.en || 0.25, q: 0.8 }, t0: o.t0, delay: o.delay, bus: o.bus, reverb: o.reverb,
    }));
  }

  const arpegio = (notas, paso, o) => notas.forEach((n, i) => tono({ f: midi(n), dur: o.dur || 0.4, vol: o.vol || 0.06, tipo: o.tipo || 'sine', delay: (o.delay || 0) + i * paso, reverb: o.reverb }));

  // ---- Efectos ---------------------------------------------------------------------------
  const EFECTOS = {
    click: () => { tono({ f: 900, f1: 620, dur: 0.06, vol: 0.06, tipo: 'triangle' }); ruido({ dur: 0.03, vol: 0.04, f: 3000 }); },
    carta: () => { ruido({ dur: 0.14, vol: 0.12, f: 1600, f1: 500, q: 1.5 }); tambor(110, 0.16, 0.14); },
    invocar: () => { ruido({ dur: 0.35, vol: 0.12, f: 300, f1: 1800, tipo: 'lowpass', reverb: 0.4 }); tambor(70, 0.3, 0.45, { delay: 0.22, reverb: 0.3 }); },
    carga: () => ruido({ dur: 0.2, vol: 0.16, f: 500, f1: 3200, q: 2 }),
    dano: () => tambor(90, 0.18, 0.15),
    'golpe-heroe': () => { tambor(42, 0.55, 0.9, { reverb: 0.4 }); ruido({ dur: 0.5, vol: 0.25, f: 900, f1: 120, tipo: 'lowpass' }); },
    escudo: () => campana(880, 0.12, 0.8, { reverb: 0.5 }),
    congelar: () => { [2637, 3136, 3951].forEach((f, i) => tono({ f, dur: 0.4, vol: 0.04, delay: i * 0.03, reverb: 0.5 })); ruido({ dur: 0.25, vol: 0.08, f: 7000, tipo: 'highpass' }); },
    curar: () => arpegio([72, 76, 79, 84], 0.07, { tipo: 'triangle', vol: 0.06, dur: 0.6, reverb: 0.6 }),
    buff: () => { tono({ f: 330, f1: 660, dur: 0.3, vol: 0.07, tipo: 'triangle', reverb: 0.4 }); tono({ f: 494, f1: 988, dur: 0.3, vol: 0.06, tipo: 'triangle', delay: 0.08, reverb: 0.4 }); },
    // Destrucción de una carta: golpe grave + cristal que estalla + campanita de premio que sube.
    // Si caen varias seguidas, cada una suena más aguda (combo).
    romper: () => {
      const ahora = performance.now();
      combo.n = ahora - combo.ultima < COMBO_MS ? Math.min(COMBO_MAX, combo.n + 1) : 0;
      combo.ultima = ahora;
      const sube = combo.n * 2; // semitonos
      tambor(55, 0.5, 0.45);
      tono({ f: 140, f1: 38, dur: 0.35, vol: 0.22, tipo: 'sine' });
      ruido({ dur: 0.18, vol: 0.28, f: 2200, q: 1.6, tipo: 'bandpass' });
      ruido({ dur: 0.5, vol: 0.14, f: 6000, tipo: 'highpass' });
      for (let i = 0; i < 14; i++) tono({ f: 2200 + Math.random() * 4200, dur: 0.04 + Math.random() * 0.14, vol: 0.03, delay: 0.02 + Math.random() * 0.16, tipo: 'triangle' });
      const notas = [76, 79, 84, 88].map((n) => n + sube);
      if (combo.n >= 2) notas.push(91 + sube);
      arpegio(notas, 0.045, { tipo: 'triangle', vol: 0.07, dur: 0.35, delay: 0.08, reverb: 0.5 });
      campana(midi(notas[notas.length - 1] + 12), 0.08, 1.1, { delay: 0.08 + notas.length * 0.045, reverb: 0.7 });
    },
    fusion: () => {
      ruido({ dur: 1.0, vol: 0.14, f: 200, f1: 6000, tipo: 'lowpass', at: 0.6 });
      tono({ f: 110, f1: 440, dur: 1.0, vol: 0.06, tipo: 'sawtooth', at: 0.7, filtro: { f: 300, f1: 3000 } });
      tambor(45, 0.55, 1.4, { delay: 1.05, reverb: 0.6 });
      campana(523, 0.1, 2.2, { delay: 1.05, reverb: 0.7 });
      arpegio([79, 83, 86, 91, 95], 0.06, { delay: 1.15, vol: 0.05, dur: 0.8, reverb: 0.7 });
    },
    turno: () => { campana(98, 0.22, 2.8, { reverb: 0.7 }); tambor(50, 0.35, 0.9, { reverb: 0.4 }); },
    'turno-rival': () => { tambor(45, 0.3, 0.8, { reverb: 0.4 }); tono({ f: midi(38), dur: 1.2, vol: 0.08, tipo: 'sawtooth', at: 0.1, filtro: { f: 300, f1: 200 }, reverb: 0.4 }); },
    victoria: () => {
      [[62, 0], [66, 0.18], [69, 0.36], [74, 0.6]].forEach(([n, d]) => voz(midi(n), { dur: d === 0.6 ? 2.4 : 0.32, vol: 0.12, delay: d, f0: 600, f1: 2600, reverb: 0.5 }));
      [50, 57, 62, 66].forEach((n) => voz(midi(n), { dur: 2.4, vol: 0.06, delay: 0.6, f0: 500, f1: 1800, reverb: 0.6 }));
      tambor(48, 0.5, 1.2, { delay: 0.6, reverb: 0.5 });
      campana(1175, 0.06, 2.5, { delay: 0.6, reverb: 0.7 });
    },
    derrota: () => {
      [[50, 0], [48, 0.45], [46, 0.9], [45, 1.35]].forEach(([n, d]) => voz(midi(n), { dur: 0.9, vol: 0.1, delay: d, f0: 300, f1: 900, reverb: 0.6 }));
      campana(73, 0.25, 3.2, { delay: 1.35, reverb: 0.8 });
    },
  };

  // Golpe característico de cada reino
  const GOLPES = {
    fuego: () => { ruido({ dur: 0.55, vol: 0.26, f: 2200, f1: 160, tipo: 'lowpass', reverb: 0.3 }); tono({ f: 130, f1: 45, dur: 0.35, vol: 0.12, tipo: 'sawtooth' }); },
    hielo: () => { [2093, 2637, 3136, 3951, 4699].forEach((f, i) => tono({ f, dur: 0.3, vol: 0.045, delay: i * 0.025, reverb: 0.4 })); ruido({ dur: 0.3, vol: 0.14, f: 6500, tipo: 'highpass' }); },
    bosque: () => { ruido({ dur: 0.3, vol: 0.16, f: 900, q: 3 }); tono({ f: 230, f1: 110, dur: 0.14, vol: 0.22, tipo: 'triangle' }); },
    arcano: () => { arpegio([81, 88, 93, 97], 0.04, { vol: 0.06, dur: 0.5, reverb: 0.6 }); tono({ f: 440, f1: 1760, dur: 0.3, vol: 0.05, reverb: 0.4 }); },
    corona: () => { campana(1046, 0.1, 0.9, { reverb: 0.4 }); ruido({ dur: 0.07, vol: 0.22, f: 3200, q: 1.5 }); },
  };

  function puede(nombre) {
    if (!ctx || !desbloqueado || modo === 'nada') return false;
    const ahora = performance.now();
    if (ahora - (ultimo[nombre] || 0) < ESPACIO_MS) return false;
    ultimo[nombre] = ahora;
    return true;
  }

  // Un sonido que falla no debe cortar el juego, pero queda registrado.
  function avisarFallo(nombre, e) {
    if (raiz.console) raiz.console.warn('Sonido: falló', nombre, e);
  }

  function efecto(nombre) {
    if ((!EFECTOS[nombre] && !MUESTRA[nombre]) || !puede(nombre)) return;
    if (MUESTRA[nombre]) muestra(MUESTRA[nombre]);
    if (!EFECTOS[nombre] || SOLO_MUESTRA.includes(nombre)) return;
    try { EFECTOS[nombre](); } catch (e) { avisarFallo(nombre, e); }
  }

  /** Impacto de un ataque: golpe sordo según la fuerza más el sonido del reino. */
  function golpe(reino, fuerza) {
    if (!puede('golpe-' + reino)) return;
    try {
      const f = Math.max(1, fuerza || 2);
      muestra(f >= 4 ? 'golpe-fuerte' : 'golpe-ligero', Math.min(1, 0.8 + f * 0.06));
      (GOLPES[reino] || GOLPES.corona)(); // el toque del reino (fuego, hielo...) encima del golpe
    } catch (e) { avisarFallo('golpe-' + reino, e); }
  }

  /** Disparo de un proyectil: soplido que sube, con brillo en el arcano. */
  function lanzar(reino) {
    if (!puede('lanzar')) return;
    try {
      ruido({ dur: 0.38, vol: 0.1, f: 400, f1: 2600, q: 1.4 });
      tono({ f: 300, f1: 900, dur: 0.38, vol: 0.05, tipo: reino === 'fuego' ? 'sawtooth' : 'sine', filtro: { f: 1200 } });
      if (reino === 'arcano' || reino === 'hielo') arpegio([88, 93], 0.05, { vol: 0.04, dur: 0.3 });
    } catch (e) { avisarFallo('lanzar', e); }
  }

  // ---- Música ------------------------------------------------------------------------------
  const MENOR = [0, 3, 7];
  const MAYOR = [0, 4, 7];
  const TAIKO = [1, 0, 0, 0.6, 0, 0, 0.8, 0, 1, 0, 0, 0.6, 0.7, 0, 0.5, 0];

  // Menú: "Himno de los Reinos". Re menor, lento, cuerdas largas y un corno.
  const HIMNO = {
    bpm: 70, compases: 8,
    acordes: [[50, MENOR], [46, MAYOR], [53, MAYOR], [48, MAYOR]],
    melodia: [[[0, 69, 8], [8, 67, 4], [12, 65, 4]], [[0, 62, 16]], [[0, 70, 6], [6, 69, 2], [8, 67, 8]], [[0, 65, 16]],
      [[0, 65, 8], [8, 69, 8]], [[0, 72, 16]], [[0, 67, 6], [6, 65, 2], [8, 64, 8]], [[0, 62, 16]]],
    paso(i, compas, t, spb) {
      const [raizA, tipoA] = this.acordes[Math.floor(compas / 2) % 4];
      const larga = spb * 32;
      if (i === 0 && compas % 2 === 0) {
        tipoA.forEach((s) => voz(midi(raizA + s), { dur: larga, vol: 0.045, at: 0.9, rel: 1.2, f0: 350, f1: 1100, en: 1.5, t0: t, bus: busMusica, reverb: 0.6 }));
        tono({ f: midi(raizA - 12), dur: larga, vol: 0.12, tipo: 'triangle', at: 0.6, sostener: true, rel: 1, t0: t, bus: busMusica, reverb: 0.3 });
      }
      if (i === 0) tambor(55, 0.32, 1.2, { t0: t, bus: busMusica, reverb: 0.5 });
      if (i === 8) tambor(60, 0.18, 0.8, { t0: t, bus: busMusica, reverb: 0.5 });
      if (compas % 2 === 1 && (i === 12 || i === 14)) tambor(70, 0.12, 0.5, { t0: t, bus: busMusica, reverb: 0.4 });
      this.melodia[compas % 8].forEach(([paso, nota, dur]) => {
        if (paso === i) voz(midi(nota), { dur: spb * dur, vol: 0.05, at: 0.12, f0: 500, f1: 1500, t0: t, bus: busMusica, reverb: 0.7 });
      });
    },
  };

  // Batalla: "Choque de Reinos". Ostinato de cuerdas, taikos y metales; capa de tensión.
  const CHOQUE = {
    bpm: 116, compases: 4,
    acordes: [[50, MENOR], [46, MAYOR], [55, MENOR], [57, MAYOR]],
    ostinato: [0, 0, 7, 0, 0, 0, 7, 12],
    paso(i, compas, t, spb) {
      const [raizA, tipoA] = this.acordes[compas % 4];
      if (i % 2 === 0) {
        const n = raizA - 12 + this.ostinato[i / 2];
        tono({ f: midi(n), dur: spb * 1.7, vol: 0.09, tipo: 'sawtooth', filtro: { f: 1100, f1: 300 }, t0: t, bus: busMusica });
      }
      const golpeTaiko = TAIKO[i];
      if (golpeTaiko) tambor(i === 0 ? 46 : 62, 0.32 * golpeTaiko, i === 0 ? 0.9 : 0.35, { t0: t, bus: busMusica, reverb: 0.35 });
      if (i === 4 || i === 12) ruido({ dur: 0.12, vol: 0.06, f: 1600, q: 0.8, t0: t, bus: busMusica, reverb: 0.3 });
      if (i === 0) tipoA.forEach((s) => voz(midi(raizA + s), { dur: spb * 3, vol: 0.05, at: 0.02, rel: 0.2, f0: 700, f1: 2000, en: 0.1, t0: t, bus: busMusica, reverb: 0.5 }));
      if (tension) {
        const nota = raizA + 12 + tipoA[i % 3];
        tono({ f: midi(nota), dur: spb * 0.9, vol: 0.025, tipo: 'sawtooth', filtro: { f: 2600 }, t0: t, bus: busMusica, reverb: 0.3 });
        ruido({ dur: 0.04, vol: 0.03, f: 8000, tipo: 'highpass', t0: t, bus: busMusica });
      }
    },
  };

  const TEMAS = { menu: HIMNO, batalla: CHOQUE };
  let tema = null;
  let temaPedido = null;
  let tension = false;
  let paso = 0;
  let proximo = 0;
  let reloj = null;

  function programar() {
    if (!ctx || !tema) return;
    const spb = 60 / tema.bpm / 4;
    while (proximo < ctx.currentTime + 0.25) {
      tema.paso(paso % 16, Math.floor(paso / 16), proximo, spb);
      proximo += spb;
      paso = (paso + 1) % (16 * tema.compases);
    }
  }

  function arrancarTema(nombre) {
    tema = TEMAS[nombre] || null;
    paso = 0;
    proximo = ctx.currentTime + 0.1;
    if (!reloj) reloj = setInterval(programar, 50);
  }

  /** Cambia la música (menu, batalla o null) con un fundido corto. */
  function musica(nombre) {
    const destino = nombre || null;
    if (destino === temaPedido) return;
    temaPedido = destino;
    if (!ctx || !desbloqueado) return;
    const t = ctx.currentTime;
    busMusica.gain.setTargetAtTime(0, t, 0.25);
    apagarPista(600);
    setTimeout(() => {
      if (temaPedido !== destino) return;
      if (destino) arrancar(destino); else tema = null;
      aplicarModo();
    }, 700);
  }

  function ponerTension(activa) { tension = !!activa; }

  function alternarModo() {
    modo = MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length];
    guardarModo();
    aplicarModo();
    if (pista && pistaActiva) {
      if (modo === 'todo') { pista.play().catch(() => {}); volumenPista(VOL_PISTA * factor.musica, 300); } else volumenPista(0, 300, () => pista.pause());
    }
    return modo;
  }

  /** Ajusta los volúmenes (0 a 1) de música y efectos. */
  function volumenes(musica, efectos) {
    const limitar = (v, antes) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : antes);
    factor.musica = limitar(musica, factor.musica);
    factor.efectos = limitar(efectos, factor.efectos);
    aplicarModo();
    if (pista && pistaActiva && modo === 'todo') volumenPista(VOL_PISTA * factor.musica, 200);
    return { ...factor };
  }

  raiz.Sonido = Object.freeze({
    efecto, volumenes, golpe, lanzar, musica, tension: ponerTension, alternarModo, pausar, reanudar,
    modo: () => modo,
    estado: () => (ctx ? ctx.state : 'sin-iniciar'),
  });
})(this);
