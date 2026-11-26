/* Genera el HTML de cada pantalla, carta, ficha y héroe. Solo lectura de datos. */
(function (raiz) {
  'use strict';
  const D = raiz.Datos;
  const M = raiz.Motor;

  function estiloReino(id) {
    const r = D.REINOS[id];
    return `--c1:${r.c1};--c2:${r.c2};--c3:${r.c3}`;
  }

  // Las fusiones mezclan los colores de sus dos reinos.
  function estiloCarta(c) {
    if (!c.reino2) return estiloReino(c.reino);
    const a = D.REINOS[c.reino];
    const b = D.REINOS[c.reino2];
    return `--c1:${a.c1};--c2:${b.c2};--c3:${a.c3}`;
  }

  // Abanico de la mano: grados de giro y caída (em) por carta según su distancia al centro.
  const GIRO_ABANICO = 4.5;
  const ARCO_ABANICO = 0.35;

  // Desfase de animación estable por carta, para que no respiren todas a la vez.
  const retraso = (texto) => ([...String(texto)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 37) / 10;

  // Ilustraciones reales disponibles (lista generada por tools/procesar_arte.py).
  // Los archivos usan "-" en lugar de "+" (x_bosque+hielo -> x_bosque-hielo) para URLs seguras.
  const ARTE = new Set(raiz.ARTE_DISPONIBLE || []);
  const archivoArte = (id) => String(id).replace(/\+/g, '-');
  const tieneArte = (id) => ARTE.has(archivoArte(id));
  // En modo liviano (celular) las cartas usan miniaturas: 4 veces menos píxeles en memoria.
  const carpetaArte = () => (document.documentElement.classList.contains('liviano') ? 'arte/mini' : 'arte');
  const imagenArte = (id, clase) => `<img class="${clase}" src="${carpetaArte()}/${archivoArte(id)}.webp" alt="" draggable="false" loading="lazy" decoding="async">`;

  // Ilustración de la legendaria de cada reino, para fondos y retratos.
  const LEYENDA = Object.freeze({ bosque: 'b8', corona: 'c8', hielo: 'h8', arcano: 'a8', fuego: 'f8' });
  // URL absoluta: dentro de una variable CSS, una ruta relativa se resolvería desde la carpeta css/.
  const arteReino = (reino) => {
    if (!tieneArte(LEYENDA[reino])) return 'none';
    return `url('${new URL(`arte/${archivoArte(LEYENDA[reino])}.webp`, document.baseURI).href}')`;
  };

  const sellos = (c) => (c.reino2 ? D.REINOS[c.reino].icono + D.REINOS[c.reino2].icono : D.REINOS[c.reino].icono);
  const claseStat = (v, base) => (v > base ? 'sube' : v < base ? 'baja' : '');

  function htmlCarta(c, opciones) {
    const o = opciones || {};
    const base = D.porId[c.id] || c;
    const conArte = tieneArte(c.id);
    const clases = ['carta', `rareza-${c.rareza}`, `tipo-${c.tipo}`, conArte ? 'con-arte' : ''].concat(o.clases || []);
    const stats = c.tipo === 'unidad'
      ? `<div class="gema gema-atq ${claseStat(c.atq, base.atq)}">${c.atq}</div><div class="gema gema-vida ${claseStat(c.vida, base.vida)}">${c.vida}</div>`
      : '';
    return `<div class="${clases.join(' ')}" data-reino="${c.reino}" style="${estiloCarta(c)};--retraso:${retraso(c.id)};${o.estilo || ''}" ${o.attrs || ''}>
      <div class="carta-cuerpo">
        <div class="carta-arte">
          <div class="carta-rayos"></div><div class="carta-paisaje"></div>${conArte ? imagenArte(c.id, 'carta-imagen') : ''}<div class="carta-clima"></div><div class="carta-marco-img"></div>
          <div class="carta-criatura"><div class="carta-aura"></div><div class="carta-sombra"></div><span class="carta-icono">${c.icono}</span></div>
          <span class="carta-sello">${sellos(c)}</span>
        </div>
        <div class="carta-nombre">${c.nombre}</div>
        <div class="carta-tipo">${c.tipo === 'unidad' ? 'Unidad' : 'Hechizo'} · ${D.RAREZAS[c.rareza]}</div>
        <div class="carta-texto"><span>${D.textoCarta(c)}</span></div>
      </div>
      <div class="carta-holo"></div><div class="carta-reflejo"></div>
      <div class="carta-costo">${c.costo}</div>${stats}
    </div>`;
  }

  function htmlFicha(u, o) {
    const base = D.porId[u.id] || u;
    const conArte = tieneArte(u.id);
    const clases = ['ficha', `rareza-${u.rareza}`];
    if (conArte) clases.push('con-arte');
    if (M.tiene(u, 'guardia')) clases.push('guardia');
    if (o.lista) clases.push('lista');
    if (o.seleccionada) clases.push('seleccionada');
    if (o.objetivo) clases.push('objetivo-valido');
    const insignias = ['veloz', 'regenera', 'robovida', 'helada']
      .filter((k) => M.tiene(u, k))
      .map((k) => `<span title="${D.CLAVES[k].nombre}">${D.CLAVES[k].icono}</span>`).join('');
    const claseVida = u.vida < u.vidaMax ? 'baja' : (u.vida > base.vida ? 'sube' : '');
    return `<div class="${clases.join(' ')}" data-reino="${u.reino}" style="${estiloCarta(u)};--retraso:${retraso(u.uid)}" data-accion="ficha" data-uid="${u.uid}" data-lado="${u.duenio}">
      <div class="ficha-arte">${conArte ? imagenArte(u.id, 'ficha-imagen') : ''}<div class="ficha-clima"></div><div class="carta-aura"></div><span class="ficha-icono">${u.icono}</span></div>
      ${insignias ? `<div class="ficha-claves">${insignias}</div>` : ''}
      <div class="gema gema-atq ${u.atq > base.atq ? 'sube' : ''}">${u.atq}</div>
      <div class="gema gema-vida ${claseVida}">${u.vida}</div>
      ${u.escudo ? '<div class="burbuja"></div>' : ''}${u.congelada ? '<div class="hielo"></div>' : ''}
    </div>`;
  }

  // Apariencia elegida en la tienda para cada jugador (avatar, marco, título, arena, acabado, dorso)
  const APARIENCIA = [null, null];
  function ponerApariencia(jIdx, apariencia) { APARIENCIA[jIdx] = apariencia || null; }
  const apariencia = (jIdx) => APARIENCIA[jIdx] || {};

  function htmlHeroe(p, o) {
    const [a, b] = p.reinos.map((id) => D.REINOS[id]);
    const ap = apariencia(p.idx);
    const clases = ['heroe'];
    if (ap.marco) clases.push(`marco-${ap.marco}`);
    if (o.objetivo) clases.push('objetivo-valido');
    const leyenda = ap.avatar || LEYENDA[p.reinos[0]];
    const retrato = tieneArte(leyenda)
      ? `<div class="heroe-retrato con-imagen">${imagenArte(leyenda, 'heroe-imagen')}<div class="heroe-insignias"><span>${a.icono}</span><span>${b.icono}</span></div></div>`
      : `<div class="heroe-retrato"><span>${a.icono}</span><span>${b.icono}</span></div>`;
    return `<div class="${clases.join(' ')}" style="--a1:${a.c1};--b1:${b.c1}" data-accion="heroe" data-lado="${p.idx}">
      ${retrato}
      <div class="gema gema-vida heroe-vida ${p.vida < p.vidaMax ? 'baja' : ''}">${p.vida}</div>
    </div>`;
  }

  function htmlMana(p) {
    const cristales = Array.from({ length: M.REGLAS.manaMaximo }, (_, i) => {
      const clase = i < p.mana ? 'lleno' : (i < p.manaMax ? 'usado' : '');
      return `<span class="cristal ${clase}"></span>`;
    }).join('');
    return `<div class="mana" title="Maná"><div class="cristales">${cristales}</div><span class="mana-num">${p.mana}/${p.manaMax}</span></div>`;
  }

  const chipReino = (id, texto) => `<span class="chip" style="${estiloReino(id)}">${D.REINOS[id].icono} ${texto}</span>`;

  function infoJugador(p) {
    const titulo = apariencia(p.idx).titulo;
    return `<div class="info-jugador"><div class="nombre">${p.nombre}</div>${titulo ? `<div class="titulo-jugador">${titulo}</div>` : ''}
      <div class="reinos-mini">${p.reinos.map((r) => chipReino(r, D.REINOS[r].corto)).join('')}</div></div>`;
  }

  // ---- Pantallas --------------------------------------------------------------
  // Portada: la ilustración del menú con sus botones convertidos en botones reales.
  const portadaAnimada = () => !raiz.Ajustes || raiz.Ajustes.actual().portada !== 'estatica';

  function pantallaInicio() {
    return `<div class="pantalla portada">
      <div class="portada-fondo" aria-hidden="true"></div>
      <div class="portada-escena">
        <img class="portada-imagen" src="arte/portada.webp" alt="Guerra de los Cinco Reinos" draggable="false">
        ${portadaAnimada() ? `<video class="portada-video" src="videos/${esLiviano() ? 'portada-720' : 'portada'}.mp4" muted loop autoplay playsinline disablepictureinpicture disableremoteplayback preload="auto"
          aria-hidden="true" onplaying="this.classList.add('lista')"></video>` : ''}
        <div class="portada-luz fuego" aria-hidden="true"></div>
        <div class="portada-luz hielo" aria-hidden="true"></div>
        <div class="portada-luz arcano" aria-hidden="true"></div>
        <div class="portada-subtitulo">Juego de cartas &nbsp;·&nbsp; Fusioná, conquistá, reiná</div>
        <button class="portada-boton jugar" data-accion="ir" data-destino="elegir" aria-label="Jugar contra la IA"></button>
        <button class="portada-boton cartas" data-accion="ir" data-destino="coleccion" aria-label="Cartas y fusiones"></button>
        <button class="portada-boton ayuda" data-accion="ir" data-destino="ayuda" aria-label="Cómo se juega"></button>
      </div>
      <p class="version portada-version">v0.7.2</p>
    </div>`;
  }

  /** extraArriba: HTML opcional que va antes de la grilla (p. ej. "Jugar con mi mazo"). */
  function pantallaElegir(elegidos, extraArriba) {
    const tiles = Object.values(D.REINOS).map((r) => {
      const elegido = elegidos.includes(r.id);
      return `<div class="reino-tile ${elegido ? 'elegido' : ''}" style="${estiloReino(r.id)};--arte:${arteReino(r.id)}" data-accion="reino" data-reino="${r.id}">
        ${elegido ? '<div class="reino-check">✔</div>' : ''}
        <div class="reino-icono">${r.icono}</div>
        <div class="reino-nombre">${r.nombre}</div>
        <div class="reino-lema">“${r.lema}”</div>
        <div class="reino-estilo">${r.estilo}</div>
      </div>`;
    }).join('');
    let fusiones = '';
    if (elegidos.length === 2) {
      const [a, b] = elegidos;
      const lista = [[a, a], [b, b], [a, b]].map(([x, y]) => D.fusionDe(x, y));
      fusiones = `<div class="fusiones-posibles"><span>⚗️ Fusiones que vas a poder hacer:</span>
        ${lista.map((f) => `<span class="chip" style="${estiloCarta(f)}">${f.icono} ${f.nombre}</span>`).join('')}</div>`;
    }
    return `<div class="pantalla elegir">
      <button class="volver" data-accion="ir" data-destino="inicio">← Volver</button>
      ${extraArriba || ''}
      <h2 class="titulo-2">${extraArriba ? 'Partida rápida: elegí 2 reinos' : 'Elegí 2 reinos para tu mazo'}</h2>
      <div class="reinos-grid">${tiles}</div>
      ${fusiones}
      <button class="boton" data-accion="empezar" ${elegidos.length === 2 ? '' : 'disabled'}>¡A la batalla!</button>
    </div>`;
  }

  function panelFusion(s, v) {
    const p = s.jugadores[0];
    let vista = '<div class="fus-hueco">?</div>';
    if (v.fusion.length === 2) {
      const [a, b] = v.fusion.map((i) => p.mano[i]);
      vista = htmlCarta(D.fusionDe(a.reino, b.reino), { clases: ['mini'] });
    }
    const hayMana = p.mana >= M.REGLAS.costoFusion;
    const puede = v.fusion.length === 2 && hayMana;
    return `<div class="panel-fusion">
      <div class="pf-titulo">⚗️ Altar de Fusión</div>
      <div class="pf-ayuda">Tocá 2 cartas <b>comunes</b> de tu mano. Cuesta ${M.REGLAS.costoFusion} 💧</div>
      <div class="pf-vista">${vista}</div>
      <div class="pf-botones">
        <button class="boton boton-chico" data-accion="fusionar" ${puede ? '' : 'disabled'}>${hayMana ? 'Fusionar' : 'Falta maná'}</button>
        <button class="boton secundario boton-chico" data-accion="fusion-modo">Cancelar</button>
      </div>
    </div>`;
  }

  function claseCartaMano(s, v, c, i, miTurno) {
    const acabado = apariencia(0).acabado;
    const extra = acabado && acabado !== 'normal' ? [`acabado-${acabado}`] : [];
    return [...extra, ...claseCartaManoBase(s, v, c, i, miTurno)];
  }

  function claseCartaManoBase(s, v, c, i, miTurno) {
    if (v.modoFusion) {
      const clases = [c.rareza === 'comun' ? 'fusionable' : 'apagada'];
      if (v.fusion.includes(i)) clases.push('seleccionada');
      return clases;
    }
    const clases = [];
    if (v.vistaPrevia === i) clases.push('previa');
    if (miTurno && !M.motivoNoJugable(s, 0, i)) clases.push('jugable');
    if (v.sel && v.sel.tipo === 'carta' && v.sel.manoIdx === i) clases.push('seleccionada');
    return clases;
  }

  function htmlPremio(premio) {
    if (!premio) return '';
    const partes = [`<span>+${premio.oro} 💰</span>`];
    if (premio.gemas) partes.push(`<span>+${premio.gemas} 💎</span>`);
    const notas = [];
    if (premio.primeraDelDia) notas.push('¡Bono de la primera victoria del día!');
    if (premio.racha >= 2) notas.push(`Racha de ${premio.racha} victorias`);
    if (premio.aventura) notas.push(premio.aventura);
    if (premio.online) notas.push(premio.online);
    return `<div class="fin-premio">${partes.join('')}</div>${notas.length ? `<p class="fin-nota">${notas.join(' · ')}</p>` : ''}`;
  }

  function overlayFin(s, premio) {
    const ganador = s.ganador;
    const gane = ganador === 0;
    const reinoGanador = s.jugadores[ganador === 'empate' ? 0 : ganador].reinos[0];
    const titulo = ganador === 'empate' ? 'EMPATE' : (gane ? '¡VICTORIA!' : 'DERROTA');
    const texto = ganador === 'empate' ? 'Los dos reinos cayeron a la vez.' : (gane ? 'Tu reino domina el campo de batalla.' : 'Tu reino cayó… por ahora.');
    const letras = [...titulo].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    const particulas = Array.from({ length: 24 }, (_, i) =>
      `<i style="--x:${(i * 41) % 100};--t:${(2.2 + (i % 6) * 0.45).toFixed(2)};--r:${(i * 0.37) % 3}"></i>`).join('');
    const emblema = ganador === 'empate' ? '⚖️' : (gane ? '👑' : '🗡️');
    return `<div class="overlay-fin ${gane ? 'victoria' : 'derrota'}" style="--arte:${arteReino(reinoGanador)}">
      <div class="fin-rayos"></div>
      <div class="fin-franja arriba"></div><div class="fin-franja abajo"></div>
      <div class="fin-particulas">${particulas}</div>
      <div class="fin-emblema">${emblema}</div>
      <h1 class="fin-titulo">${letras}</h1><p class="fin-texto">${texto}</p><div class="fin-resto">${htmlPremio(premio)}
      ${premio && premio.enOnline ? `<div class="menu"><button class="boton" data-accion="ir" data-destino="online">🏟️ Volver al lobby</button>
      <button class="boton secundario" data-accion="ir" data-destino="inicio">Menú</button>` : `<div class="menu"><button class="boton" data-accion="revancha">⚔️ Revancha</button>
      ${premio && premio.enAventura ? '<button class="boton secundario" data-accion="ir" data-destino="aventura">🗺️ Volver al mapa</button>'
        : '<button class="boton secundario" data-accion="ir" data-destino="elegir">Cambiar reinos</button>'}
      <button class="boton secundario" data-accion="ir" data-destino="inicio">Menú</button>`}</div></div>
    </div>`;
  }

  function pantallaBatalla(s, v) {
    const yo = s.jugadores[0];
    const el = s.jugadores[1];
    const miTurno = s.turno === 0 && s.ganador === null;
    const validos = v.sel ? v.sel.validos : [];
    const esObjetivo = (r) => validos.some((x) => M.mismoRef(x, r));
    const fichas = (p) => p.mesa.map((u) => htmlFicha(u, {
      lista: miTurno && p.idx === 0 && M.puedeAtacar(u) && !v.modoFusion,
      seleccionada: !!(v.sel && v.sel.uid === u.uid),
      objetivo: esObjetivo({ jIdx: p.idx, uid: u.uid }),
    })).join('') || '<div class="mesa-vacia">Campo vacío</div>';
    const centroMano = (yo.mano.length - 1) / 2;
    const mano = yo.mano.map((c, i) => {
      const d = i - centroMano;
      return htmlCarta(c, {
        clases: claseCartaMano(s, v, c, i, miTurno), attrs: `data-accion="carta-mano" data-mano="${i}" data-clave="${c.uid || `m${i}`}"`,
        estilo: `--giro:${(d * GIRO_ABANICO).toFixed(1)}deg;--arco:${(d * d * ARCO_ABANICO).toFixed(2)}em`,
      });
    }).join('');
    const dorsos = el.mano.map(() => `<div class="dorso dorso-reino-${el.reinos[0]}"></div>`).join('');

    return `<div class="batalla ${miTurno ? 'mi-turno' : 'turno-rival'}">
      <div class="fila-info rival">
        ${htmlHeroe(el, { objetivo: esObjetivo({ jIdx: 1, heroe: true }) })}
        ${infoJugador(el)}
        <div class="mano-rival">${dorsos}</div>
        ${htmlMana(el)}
        <div class="mazo" title="Cartas en el mazo">🃏 ${el.mazo.length}</div>
      </div>
      <div class="mesa mesa-rival">${fichas(el)}</div>
      <div class="divisor"><div class="linea"></div>
        ${v.espectador ? '<button class="salir" data-accion="dejar-mirar">👁️ Dejar de mirar</button>'
          : (s.ganador === null ? '<button class="salir" data-accion="rendirse" title="Rendirse (tenés 15 segundos para cancelar)">🏳️ Rendirse</button>'
            : '<button class="salir" data-accion="ir" data-destino="inicio">← Menú</button>')}
        ${v.online ? '<button class="boton-chat-partida" data-accion="chat-partida" aria-label="Chat de la partida">💬<span class="bcp-punto"></span></button>' : ''}
        ${htmlBotonAudio('en-divisor')}
        ${raiz.RelojTurno ? raiz.RelojTurno.html() : ''}
        <button class="boton boton-turno" data-accion="terminar" ${miTurno ? '' : 'disabled'}>${miTurno ? 'Terminar turno' : 'Turno rival…'}</button>
      </div>
      <div class="mesa mesa-propia">${fichas(yo)}</div>
      <div class="fila-info propia">
        ${htmlHeroe(yo, { objetivo: esObjetivo({ jIdx: 0, heroe: true }) })}
        ${infoJugador(yo)}
        ${htmlMana(yo)}
        <button class="boton boton-fusion ${v.modoFusion ? 'activo' : ''}" data-accion="fusion-modo" ${miTurno ? '' : 'disabled'}>⚗️ Fusión</button>
        <div class="mazo" title="Cartas en el mazo"><span class="dorso-carta mini dorso-${apariencia(0).dorso || 'clasico'}"></span> ${yo.mazo.length}</div>
      </div>
      ${v.modoFusion ? panelFusion(s, v) : ''}
      <div class="mano">${mano}</div>
      ${s.ganador !== null ? overlayFin(s, v.premio) : ''}
    </div>`;
  }

  // Botón de sonido: alterna entre música y efectos, solo efectos y silencio.
  const ICONO_AUDIO = Object.freeze({ todo: '🔊', efectos: '🔉', nada: '🔇' });
  const TITULO_AUDIO = Object.freeze({ todo: 'Música y efectos', efectos: 'Solo efectos', nada: 'Silencio' });
  function htmlBotonAudio(clase) {
    const modo = raiz.Sonido ? raiz.Sonido.modo() : 'nada';
    return `<button class="boton-audio ${clase || ''}" data-accion="ajustes" title="Ajustes (${TITULO_AUDIO[modo]})" aria-label="Ajustes">⚙️</button>`;
  }

  // Fondo animado de la batalla: video del reino de cada jugador (la ilustración queda de respaldo).
  // Se dibuja una sola vez por partida, fuera de #app, para que los videos no se reinicien.
  const arenaDe = (s, j) => apariencia(j).arena || s.jugadores[j].reinos[0];

  function claveCampo(s) {
    return `${arenaDe(s, 1)}|${arenaDe(s, 0)}`;
  }

  // En modo liviano el fondo de la batalla queda quieto (dos videos a la vez traban el celular).
  const esLiviano = () => document.documentElement.classList.contains('liviano');

  function htmlCampoFondo(s) {
    const video = (reino) => (esLiviano() ? ''
      : `<video class="campo-video" src="videos/${reino}.mp4" autoplay muted loop playsinline disablepictureinpicture disableremoteplayback preload="auto"></video>`);
    const mitad = (lado, reino) => `<div class="campo-mitad ${lado}" style="background-image:${arteReino(reino)}">${video(reino)}</div>`;
    return `${mitad('rival', arenaDe(s, 1))}${mitad('propia', arenaDe(s, 0))}<div class="campo-vineta"></div>`;
  }

  function pantallaColeccion(tab) {
    const tabs = Object.values(D.REINOS)
      .map((r) => `<button class="tab ${tab === r.id ? 'activa' : ''}" style="${estiloReino(r.id)}" data-accion="tab" data-tab="${r.id}">${r.icono} ${r.corto}</button>`)
      .join('') + `<button class="tab tab-fusion ${tab === 'fusion' ? 'activa' : ''}" data-accion="tab" data-tab="fusion">⚗️ Fusiones</button>`;
    let contenido;
    if (tab === 'fusion') {
      contenido = Object.entries(D.FUSIONES).map(([clave, c]) => {
        const [a, b] = clave.split('+');
        return `<div class="receta"><div class="receta-formula">${chipReino(a, 'Común')} <b>+</b> ${chipReino(b, 'Común')}</div>${htmlCarta(c)}</div>`;
      }).join('');
    } else {
      contenido = D.CARTAS.filter((c) => c.reino === tab).map((c) => htmlCarta(c)).join('');
    }
    const r = D.REINOS[tab];
    const encabezado = r
      ? `<p class="lema-tab" style="${estiloReino(tab)}">${r.icono} <b>${r.nombre}</b> — ${r.estilo}</p>`
      : '<p class="lema-tab">Fusioná <b>2 cartas comunes</b> en batalla (cuesta 1 de maná). El resultado depende de los reinos de las dos cartas.</p>';
    return `<div class="pantalla coleccion">
      <div class="barra-sup"><button class="volver" data-accion="ir" data-destino="inicio">← Volver</button><h2 class="titulo-2">Cartas y fusiones</h2></div>
      <div class="tabs">${tabs}</div>${encabezado}
      <div class="grilla">${contenido}</div>
    </div>`;
  }

  function pantallaAyuda() {
    const claves = Object.values(D.CLAVES).map((k) => `<li><b>${k.icono} ${k.nombre}:</b> ${k.desc}</li>`).join('');
    return `<div class="pantalla ayuda">
      <div class="barra-sup"><button class="volver" data-accion="ir" data-destino="inicio">← Volver</button><h2 class="titulo-2">Cómo se juega</h2></div>
      <div class="reglas">
        <section><h3>🎯 Objetivo</h3><p>Bajá la vida del héroe rival de <b>${M.REGLAS.vidaHeroe}</b> a 0.</p></section>
        <section><h3>💧 Maná</h3><p>Cada turno ganás 1 cristal de maná (hasta ${M.REGLAS.manaMaximo}) y robás una carta. Las cartas cuestan el número azul.</p></section>
        <section><h3>⚔️ Combate</h3><p>Tocá una unidad tuya que brille en verde y después el enemigo al que querés atacar. Las dos unidades se pegan al mismo tiempo. Una unidad recién jugada no ataca hasta tu próximo turno (salvo las <b>Veloz</b>).</p></section>
        <section><h3>⚗️ Fusión</h3><p>Tocá <b>Fusión</b>, elegí 2 cartas <b>comunes</b> y pagá 1 de maná: se transforman en una carta de Fusión más poderosa. Cada combinación de reinos da una carta distinta. ¡Hay 15!</p></section>
        <section><h3>📜 Palabras clave</h3><ul>${claves}</ul></section>
      </div>
    </div>`;
  }

  // ---- Paisajes de fondo por reino (siluetas SVG) -----------------------------------
  const svgFondo = (cuerpo) => `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='xMidYMax slice'>${cuerpo}</svg>`)}")`;

  function pinos() {
    return Array.from({ length: 14 }, (_, i) => {
      const x = i * 7.6 + ((i * 37) % 5) - 2;
      const alto = 12 + ((i * 7) % 6) * 1.6;
      return `M${x - 3.4} 40L${x} ${40 - alto}L${x + 3.4} 40Z`;
    }).join('');
  }

  const PAISAJES = {
    bosque: svgFondo(`<path d='M0 40V24Q12 16 25 22T50 20T75 23T100 19V40Z' fill='#002a14' fill-opacity='.6'/><path d='${pinos()}' fill='#00140a' fill-opacity='.92'/>`),
    corona: svgFondo(`<path d='M0 40V29Q30 22 50 27T100 25V40Z' fill='#3a1700' fill-opacity='.55'/>
      <path d='M28 40V25h4v-3h2.2v3h2.6v-3H39v3h2V19h2.4v-4L46 11l2.6 4v4H51v6h2v-3h2.2v3h2.6v-3H60v3h4v15Z' fill='#1a0800' fill-opacity='.9'/>
      <path d='M46 11V5l4 1.5L46 8' fill='#ffd84a' fill-opacity='.9'/><rect x='44.6' y='21' width='2.8' height='4' rx='1.4' fill='#ffd84a' fill-opacity='.8'/>`),
    hielo: svgFondo(`<path d='M0 40L12 22L20 30L34 12L46 28L58 16L72 30L84 18L100 31V40Z' fill='#00133d' fill-opacity='.8'/>
      <path d='M30.6 17L34 12L37.6 17L35 15.6Z M55.6 19.4L58 16L60.6 19.5L58 18.4Z M81.6 21.4L84 18L86.5 21.5L84 20.4Z M9.8 25.4L12 22L14.2 25.4Z' fill='#fff' fill-opacity='.7'/>`),
    arcano: svgFondo(`<circle cx='80' cy='9' r='4.5' fill='#ffe6ff' fill-opacity='.55'/><circle cx='82.2' cy='8' r='4' fill='#2a0060' fill-opacity='.9'/>
      <path d='M0 40V31Q50 24 100 31V40Z' fill='#12002e' fill-opacity='.75'/>
      <path d='M44.5 40V19L46.5 15V11L48 7L49.5 11V15L51.5 19V40Z' fill='#0a001c' fill-opacity='.95'/><circle cx='48' cy='6' r='1.4' fill='#ff9dff'/>
      <rect x='47.2' y='22' width='1.6' height='2.6' rx='.8' fill='#ff9dff' fill-opacity='.9'/>`),
    fuego: svgFondo(`<path d='M0 40V30Q20 26 30 30L42 14H52L66 30Q80 26 100 31V40Z' fill='#200003' fill-opacity='.9'/>
      <path d='M44 14Q47.5 24 45.2 40H50Q48.8 24 50 14Z' fill='#ffb02e' fill-opacity='.85'/><ellipse cx='47' cy='14' rx='5.5' ry='1.4' fill='#ffd27a'/>`),
  };

  function instalarPaisajes() {
    const estilo = document.createElement('style');
    estilo.textContent = Object.entries(PAISAJES)
      .map(([reino, fondo]) => `.carta[data-reino="${reino}"] .carta-paisaje{background-image:${fondo}}`).join('\n');
    document.head.appendChild(estilo);
  }
  instalarPaisajes();

  raiz.Render = Object.freeze({ arteReino, estiloReino, htmlCarta, htmlCampoFondo, claveCampo, htmlBotonAudio, ponerApariencia, pantallaInicio, pantallaElegir, pantallaBatalla, pantallaColeccion, pantallaAyuda });
})(this);
