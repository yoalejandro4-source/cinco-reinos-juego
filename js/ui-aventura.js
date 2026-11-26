/* Pantalla del Modo Aventura: mapa de capítulos con sus tres combates, y premios
 * de aventura al terminar. Se enchufa al controlador con UI.agregar(). */
(function (raiz) {
  'use strict';
  const { UI, Render: R, Fx, Datos: D, Economia: E, Aventura: A } = raiz;
  if (!UI || !A || !raiz.Perfil) return;

  const DIALOGO_FIN_MS = 2600; // la escena final aparece después de la animación de victoria/derrota
  /** La carta del rival de un combate (para su dibujo y su retrato en los diálogos). */
  const cartaRival = (cap, e) => D.CARTAS.find((c) => c.nombre === cap.rivales[e]) || null;
  const retratoDe = (carta) => (carta && R.urlArte ? R.urlArte(carta.id) : null);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const perfil = () => raiz.Perfil.actual();

  // ---- Vista ------------------------------------------------------------------------------
  function nodoEtapa(p, cap, e) {
    const et = A.ETAPAS[e];
    const hecho = A.superadas(p, cap.reino) > e;
    const abierta = A.etapaAbierta(p, cap.reino, e);
    const estado = hecho ? 'hecha' : (abierta ? 'abierta' : 'cerrada');
    const premio = hecho ? `Repetir: +${A.PREMIO_REPETIR.oro} 💰` : `+${et.premio.oro} 💰${et.premio.gemas ? ` +${et.premio.gemas} 💎` : ''}`;
    const retrato = retratoDe(cartaRival(cap, e));
    const mini = retrato ? retrato.replace(/^arte\//, 'arte/mini/') : null;
    return `<button class="av-etapa ${estado} ${e === 2 ? 'jefe' : ''}" ${abierta ? '' : 'disabled'}
        data-accion="aventura-luchar" data-reino="${cap.reino}" data-etapa="${e}">
      <span class="av-retrato" ${mini ? `style="background-image:url('${mini}')"` : ''}><i>${hecho ? '✔' : (abierta ? et.icono : '🔒')}</i></span>
      <span class="av-etapa-texto"><b>${esc(cap.rivales[e])}</b><small>${et.nombre} · ❤ ${et.vida} · ${premio}</small></span>
    </button>`;
  }

  function capituloHtml(p, cap, i) {
    const abierto = A.capituloAbierto(p, cap.reino);
    const completo = A.completo(p, cap.reino);
    const r = D.REINOS[cap.reino];
    return `<section class="av-capitulo ${abierto ? '' : 'bloqueado'} ${completo ? 'completo' : ''}" style="${R.estiloReino(cap.reino)};--arte:${R.arteReino(cap.reino)};--n:${i}">
      <div class="av-cabeza">
        <span class="av-numero">Capítulo ${i + 1}</span>
        <h3>${r.icono} ${esc(cap.titulo)}</h3>
        <p>${abierto ? esc(cap.historia) : '🔒 Vencé al jefe del capítulo anterior para entrar.'}</p>
      </div>
      <div class="av-etapas">${A.ETAPAS.map((_, e) => nodoEtapa(p, cap, e)).join('')}</div>
      ${completo ? '<div class="av-sello">CONQUISTADO</div>' : ''}
    </section>`;
  }

  function pantallaAventura() {
    const p = perfil();
    const v = E.validarMazo(p);
    const total = A.CAPITULOS.length * A.ETAPAS.length;
    const hechos = A.progresoTotal(p);
    const aviso = v.ok ? '' : `<div class="av-aviso">⚠️ Para la aventura necesitás un mazo armado: ${esc(v.errores[0] || '')}
      <button class="boton boton-chico secundario" data-accion="ir" data-destino="mazo">Armar mi mazo</button></div>`;
    return `<div class="pantalla aventura">
      <button class="volver" data-accion="ir" data-destino="inicio">← Volver</button>
      <h2 class="titulo-2">🗺️ La Conquista de los Cinco Reinos</h2>
      <p class="av-sub">Probá tu mazo contra cada reino. Ganá para avanzar; el tercer combate es contra su legendaria.</p>
      <div class="av-progreso"><div class="av-barra" style="--p:${(hechos / total).toFixed(3)}"></div><span>${hechos} / ${total}</span></div>
      ${aviso}
      <div class="av-mapa">${A.CAPITULOS.map((c, i) => capituloHtml(p, c, i)).join('')}</div>
    </div>`;
  }

  // ---- Acciones -----------------------------------------------------------------------------
  async function luchar(el) {
    const p = perfil();
    const reino = el.dataset.reino;
    const etapa = Number(el.dataset.etapa);
    if (!A.etapaAbierta(p, reino, etapa)) { Fx.aviso('Esa batalla todavía está cerrada.'); return; }
    const v = E.validarMazo(p);
    if (!v.ok) { Fx.aviso(v.errores[0]); return; }
    const reinos = v.reinos.length >= 2 ? v.reinos.slice(0, 2) : [v.reinos[0], Object.keys(D.REINOS).find((r) => r !== v.reinos[0])];
    const cap = A.capitulo(reino);
    const carta = cartaRival(cap, etapa);
    if (raiz.Escena && raiz.Dialogos) {
      await raiz.Escena.reproducir(raiz.Dialogos.lineas(reino, etapa, 'intro'),
        { nombre: cap.rivales[etapa], retrato: retratoDe(carta) }, { nombre: p.nombre });
    }
    UI.empezarPartida(reinos, p.mazo, A.rival(reino, etapa));
  }

  UI.agregar({
    vistas: { aventura: pantallaAventura },
    acciones: { 'aventura-luchar': luchar },
  });

  // ---- Premios: los de siempre más los de la aventura ------------------------------------------
  const premioNormal = UI.alTerminar;
  UI.alTerminar = (gano) => {
    const base = typeof premioNormal === 'function' ? premioNormal(gano) : { oro: 0, gemas: 0 };
    const rival = UI.estado.rival;
    if (!rival || !rival.aventura) return base;
    const { reino, etapa } = rival.aventura;
    const r = A.registrarCombate(perfil(), reino, etapa, gano);
    raiz.Perfil.guardar(r.perfil);
    const cap = A.capitulo(reino);
    let texto = gano ? `🗺️ Aventura: +${r.premio.oro} 💰${r.premio.gemas ? ` +${r.premio.gemas} 💎` : ''}` : '🗺️ Probá ajustar tu mazo y volvé a intentarlo.';
    if (r.premio.capituloCompleto) texto = `👑 ¡Conquistaste ${cap.titulo}! ${texto}`;
    // Lo que dice el rival al terminar (después de la animación de victoria o derrota)
    if (raiz.Escena && raiz.Dialogos) {
      const lineas = raiz.Dialogos.lineas(reino, etapa, gano ? 'victoria' : 'derrota');
      setTimeout(() => {
        if (UI.estado.pantalla !== 'batalla') return;
        raiz.Escena.reproducir(lineas, { nombre: cap.rivales[etapa], retrato: retratoDe(cartaRival(cap, etapa)) }, { nombre: perfil().nombre });
      }, DIALOGO_FIN_MS);
    }
    return { ...base, oro: base.oro + r.premio.oro, gemas: base.gemas + r.premio.gemas, aventura: texto, enAventura: true };
  };
})(this);
