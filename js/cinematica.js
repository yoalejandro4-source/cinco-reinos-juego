/* Escenas cinematográficas: la fusión de dos cartas y la revelación de una carta
 * según su rareza (al abrir sobres). Todo es CSS animado por fases; acá solo se
 * arma el HTML, se espera y se limpia. Tocar la pantalla adelanta la escena. */
(function (raiz) {
  'use strict';
  const reducido = !!(raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  const DURACION_FUSION_MS = 3600;
  const SALIDA_MS = 350;
  // Qué tan grande es la revelación de cada rareza (las comunes no tienen escena)
  const REVELACION = Object.freeze({
    epica: { ms: 1700, etiqueta: 'ÉPICA', color: '#c04dff', color2: '#6a00d6' },
    mitica: { ms: 2600, etiqueta: 'MÍTICA', color: '#ff1e46', color2: '#7a0018' },
    legendaria: { ms: 3400, etiqueta: '¡LEGENDARIA!', color: '#ffc21a', color2: '#ff6a00' },
  });

  const chispas = (n) => Array.from({ length: n }, (_, i) =>
    `<i style="--a:${Math.round((360 / n) * i)}deg;--d:${(0.6 + (i % 5) * 0.18).toFixed(2)};--r:${(i * 37) % 100}"></i>`).join('');

  /** Muestra una escena y la saca cuando termina o cuando el jugador toca. */
  async function escena(clase, html, ms, estilo) {
    const capa = document.createElement('div');
    capa.className = `cine ${clase}`;
    if (estilo) capa.setAttribute('style', estilo);
    capa.innerHTML = html;
    document.body.appendChild(capa);
    let saltar = null;
    const tocado = new Promise((r) => { saltar = r; });
    capa.addEventListener('pointerdown', () => saltar(), { once: true });
    await Promise.race([espera(reducido ? Math.min(ms, 900) : ms), tocado]);
    capa.classList.add('saliendo');
    await espera(SALIDA_MS);
    capa.remove();
  }

  /**
   * Fusión: franjas de cine, vórtice con los colores de los dos reinos, las cartas
   * giran en espiral, choque con destello y onda, y aparece la carta nueva con su nombre.
   */
  function fusion({ a, b, resultado, nombre, titulo, colorA, colorB }) {
    const html = `
      <div class="cine-franja arriba"></div><div class="cine-franja abajo"></div>
      <div class="cf-vortice"></div>
      <div class="cf-orbita"><div class="cf-carta cf-a">${a}</div><div class="cf-carta cf-b">${b}</div></div>
      <div class="cf-destello"></div><div class="cf-onda"></div><div class="cf-onda dos"></div>
      <div class="cf-chispas">${chispas(18)}</div>
      <div class="cf-rayos"></div>
      <div class="cf-res">${resultado}</div>
      <div class="cf-titulo">${titulo}</div>
      <div class="cf-nombre">${nombre}</div>
      <div class="cine-saltar">Tocá para seguir</div>`;
    return escena('cine-fusion', html, DURACION_FUSION_MS, `--ca:${colorA};--cb:${colorB}`);
  }

  /** Revelación por rareza: épica corta, mítica con onda, legendaria con todo. */
  function revelar({ carta, rareza, nombre }) {
    const r = REVELACION[rareza];
    if (!r) return Promise.resolve();
    const html = `
      ${rareza === 'legendaria' ? '<div class="cine-franja arriba"></div><div class="cine-franja abajo"></div>' : ''}
      <div class="cr-luz"></div><div class="cr-rayos"></div>
      <div class="cf-onda"></div>${rareza !== 'epica' ? '<div class="cf-onda dos"></div>' : ''}
      <div class="cf-chispas">${chispas(rareza === 'legendaria' ? 26 : 14)}</div>
      <div class="cr-carta">${carta}</div>
      <div class="cr-etiqueta">${r.etiqueta}</div>
      <div class="cr-nombre">${nombre}</div>
      <div class="cine-saltar">Tocá para seguir</div>`;
    return escena(`cine-revelar rev-${rareza}`, html, r.ms, `--c1:${r.color};--c2:${r.color2}`);
  }

  raiz.Cine = Object.freeze({ fusion, revelar, REVELACION });
})(this);
