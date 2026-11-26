/* Tienda de cosméticos para el mazo y el perfil: catálogo, compra, equipar y
 * qué tiene puesto el jugador. La lógica es pura; el HTML usa el navegador. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;
  const E = esNode ? require('./economia.js') : raiz.Economia;

  const TIPOS = Object.freeze({
    avatar: { nombre: 'Avatares', grupo: 'perfil' },
    marco: { nombre: 'Marcos de héroe', grupo: 'perfil' },
    titulo: { nombre: 'Títulos', grupo: 'perfil' },
    dorso: { nombre: 'Dorsos de carta', grupo: 'mazo' },
    arena: { nombre: 'Arenas', grupo: 'mazo' },
    acabado: { nombre: 'Acabados de carta', grupo: 'mazo' },
  });

  const item = (id, tipo, nombre, precio, valor) => Object.freeze({ id, tipo, nombre, precio, valor });
  const GRATIS = Object.freeze({});

  const CATALOGO = Object.freeze([
    // Avatares: la ilustración de una carta como retrato
    item('avatar-auto', 'avatar', 'Leyenda de tu reino', GRATIS, null),
    item('avatar-ignis', 'avatar', 'Ignis', { gemas: 15 }, 'f8'),
    item('avatar-ymir', 'avatar', 'Ymir', { gemas: 15 }, 'h8'),
    item('avatar-sylvara', 'avatar', 'Sylvara', { gemas: 15 }, 'b8'),
    item('avatar-aldric', 'avatar', 'Rey Aldric', { gemas: 15 }, 'c8'),
    item('avatar-nyx', 'avatar', 'Nyx', { gemas: 15 }, 'a8'),
    item('avatar-velkor', 'avatar', 'Archimago Velkor', { oro: 800 }, 'a7'),
    item('avatar-grifo', 'avatar', 'Grifo Imperial', { oro: 800 }, 'c7'),
    item('avatar-dragon', 'avatar', 'Dragón de Escarcha', { oro: 800 }, 'h7'),
    item('avatar-magma', 'avatar', 'Elemental de Magma', { oro: 800 }, 'f7'),
    item('avatar-ent', 'avatar', 'Ent Milenario', { oro: 800 }, 'b7'),
    // Marcos del retrato del héroe
    item('marco-oro', 'marco', 'Oro real', GRATIS, 'oro'),
    item('marco-plata', 'marco', 'Plata', { oro: 300 }, 'plata'),
    item('marco-esmeralda', 'marco', 'Esmeralda', { oro: 500 }, 'esmeralda'),
    item('marco-infernal', 'marco', 'Infernal', { oro: 500 }, 'infernal'),
    item('marco-escarcha', 'marco', 'Escarcha', { oro: 500 }, 'escarcha'),
    item('marco-arcano', 'marco', 'Arcano (animado)', { gemas: 8 }, 'arcano'),
    item('marco-celestial', 'marco', 'Celestial (animado)', { gemas: 20 }, 'celestial'),
    // Títulos bajo el nombre
    item('titulo-aprendiz', 'titulo', 'Aprendiz', GRATIS, 'Aprendiz'),
    item('titulo-guerrero', 'titulo', 'Guerrero', { oro: 200 }, 'Guerrero'),
    item('titulo-senor', 'titulo', 'Señor de la Guerra', { oro: 600 }, 'Señor de la Guerra'),
    item('titulo-coleccionista', 'titulo', 'Coleccionista', { oro: 800 }, 'Coleccionista'),
    item('titulo-domador', 'titulo', 'Domador de Dragones', { oro: 1000 }, 'Domador de Dragones'),
    item('titulo-leyenda', 'titulo', 'Leyenda de los Cinco Reinos', { gemas: 25 }, 'Leyenda de los Cinco Reinos'),
    // Dorsos de carta
    item('dorso-clasico', 'dorso', 'Clásico', GRATIS, 'clasico'),
    item('dorso-dorado', 'dorso', 'Dorado', { oro: 300 }, 'dorado'),
    item('dorso-fuego', 'dorso', 'Llamas', { oro: 300 }, 'fuego'),
    item('dorso-hielo', 'dorso', 'Escarcha', { oro: 300 }, 'hielo'),
    item('dorso-esmeralda', 'dorso', 'Esmeralda', { oro: 300 }, 'esmeralda'),
    item('dorso-cosmico', 'dorso', 'Cósmico', { gemas: 10 }, 'cosmico'),
    // Dorsos ilustrados de cada reino (arte/dorsos/*.webp)
    item('dorso-reino-bosque', 'dorso', 'Ciervo del Bosque', { oro: 500 }, 'reino-bosque'),
    item('dorso-reino-corona', 'dorso', 'León de la Corona', { oro: 500 }, 'reino-corona'),
    item('dorso-reino-hielo', 'dorso', 'Dragones de Hielo', { oro: 500 }, 'reino-hielo'),
    item('dorso-reino-arcano', 'dorso', 'Círculo Arcano', { oro: 500 }, 'reino-arcano'),
    item('dorso-reino-fuego', 'dorso', 'Fénix de Fuego', { oro: 500 }, 'reino-fuego'),
    item('dorso-reino-bosque-b', 'dorso', 'Bosque Real', { gemas: 15 }, 'reino-bosque-b'),
    item('dorso-reino-corona-b', 'dorso', 'Estandarte Real', { gemas: 15 }, 'reino-corona-b'),
    item('dorso-reino-hielo-b', 'dorso', 'Trono de Escarcha', { gemas: 15 }, 'reino-hielo-b'),
    item('dorso-reino-arcano-b', 'dorso', 'Nebulosa Arcana', { gemas: 15 }, 'reino-arcano-b'),
    item('dorso-reino-fuego-b', 'dorso', 'Fénix Imperial', { gemas: 15 }, 'reino-fuego-b'),
    // Arenas: el video de fondo de tu lado del campo
    item('arena-auto', 'arena', 'La de tu reino', GRATIS, null),
    item('arena-bosque', 'arena', 'Árbol del Mundo', { oro: 400 }, 'bosque'),
    item('arena-corona', 'arena', 'Castillo Dorado', { oro: 400 }, 'corona'),
    item('arena-hielo', 'arena', 'Ciudadela de Hielo', { oro: 400 }, 'hielo'),
    item('arena-arcano', 'arena', 'Torre Flotante', { oro: 400 }, 'arcano'),
    item('arena-fuego', 'arena', 'Fortaleza Volcánica', { oro: 400 }, 'fuego'),
    // Acabados de las cartas de tu mano
    item('acabado-normal', 'acabado', 'Normal', GRATIS, 'normal'),
    item('acabado-dorado', 'acabado', 'Dorado brillante', { gemas: 12 }, 'dorado'),
    item('acabado-prisma', 'acabado', 'Prismático', { gemas: 20 }, 'prisma'),
  ]);

  const porId = Object.freeze(CATALOGO.reduce((acc, c) => ({ ...acc, [c.id]: c }), {}));
  const esGratis = (c) => !c.precio.oro && !c.precio.gemas;
  const POR_DEFECTO = Object.freeze(Object.keys(TIPOS).reduce((acc, t) => ({ ...acc, [t]: CATALOGO.find((c) => c.tipo === t && esGratis(c)).id }), {}));

  function cosmeticos(perfil) {
    const c = perfil.cosmeticos || {};
    return { comprados: Array.isArray(c.comprados) ? c.comprados : [], equipados: c.equipados || {} };
  }

  const loTiene = (perfil, id) => esGratis(porId[id]) || cosmeticos(perfil).comprados.includes(id);

  /** El ítem que el jugador tiene puesto de cada tipo (o el gratuito). */
  function equipado(perfil, tipo) {
    const id = cosmeticos(perfil).equipados[tipo];
    return porId[id] && loTiene(perfil, id) ? porId[id] : porId[POR_DEFECTO[tipo]];
  }

  function comprar(perfil, id) {
    const c = porId[id];
    if (!c) return { ok: false, perfil, error: 'Ese objeto no existe.' };
    if (loTiene(perfil, id)) return { ok: false, perfil, error: 'Ya lo tenés.' };
    if (!E.alcanza(perfil, c.precio)) return { ok: false, perfil, error: c.precio.gemas ? 'No te alcanzan las gemas.' : 'No te alcanza el oro.' };
    const cos = cosmeticos(perfil);
    const cobrado = E.cobrar(perfil, c.precio);
    return {
      ok: true,
      perfil: { ...cobrado, cosmeticos: { comprados: [...cos.comprados, id], equipados: { ...cos.equipados, [c.tipo]: id } } },
    };
  }

  function equipar(perfil, id) {
    const c = porId[id];
    if (!c) return { ok: false, perfil, error: 'Ese objeto no existe.' };
    if (!loTiene(perfil, id)) return { ok: false, perfil, error: 'Primero tenés que comprarlo.' };
    const cos = cosmeticos(perfil);
    return { ok: true, perfil: { ...perfil, cosmeticos: { ...cos, equipados: { ...cos.equipados, [c.tipo]: id } } } };
  }

  /** Lo que se ve en pantalla: retrato, marco, título, dorso, arena y acabado. */
  function apariencia(perfil) {
    return {
      avatar: equipado(perfil, 'avatar').valor, marco: equipado(perfil, 'marco').valor, titulo: equipado(perfil, 'titulo').valor,
      dorso: equipado(perfil, 'dorso').valor, arena: equipado(perfil, 'arena').valor, acabado: equipado(perfil, 'acabado').valor,
    };
  }

  // ---- HTML (solo en el navegador) -----------------------------------------------------
  const precioTexto = (p) => (p.gemas ? `💎 ${p.gemas}` : `💰 ${p.oro}`);

  function vistaPrevia(c) {
    switch (c.tipo) {
      case 'avatar': return c.valor ? `<img class="tv-avatar" src="arte/${c.valor}.webp" alt="">` : '<span class="tv-icono">🏰</span>';
      case 'marco': return `<div class="heroe marco-${c.valor} tv-marco" style="--a1:#ffd45a;--b1:#ff8a00"><div class="heroe-retrato"><span>⚔️</span></div></div>`;
      case 'titulo': return `<span class="tv-titulo">«${c.valor}»</span>`;
      case 'dorso': return `<div class="dorso-carta dorso-${c.valor}"></div>`;
      case 'arena': return c.valor ? `<video class="tv-arena" src="videos/${c.valor}.mp4" muted loop autoplay playsinline disablepictureinpicture disableremoteplayback preload="metadata"></video>` : '<span class="tv-icono">🏳️</span>';
      case 'acabado': return `<div class="tv-acabado acabado-${c.valor}"><span>🃏</span></div>`;
      default: return '';
    }
  }

  function tarjeta(perfil, c) {
    const tiene = loTiene(perfil, c.id);
    const puesto = equipado(perfil, c.tipo).id === c.id;
    let boton;
    if (puesto) boton = '<span class="tv-puesto">✔ Equipado</span>';
    else if (tiene) boton = `<button class="boton secundario boton-chico" data-accion="equipar" data-id="${c.id}">Equipar</button>`;
    else boton = `<button class="boton boton-chico" data-accion="comprar-cosmetico" data-id="${c.id}" ${E.alcanza(perfil, c.precio) ? '' : 'disabled'}>${precioTexto(c.precio)}</button>`;
    return `<div class="tv-item ${puesto ? 'puesto' : ''}"><div class="tv-vista">${vistaPrevia(c)}</div><div class="tv-nombre">${c.nombre}</div>${boton}</div>`;
  }

  function seccion(perfil, tipo) {
    const items = CATALOGO.filter((c) => c.tipo === tipo).map((c) => tarjeta(perfil, c)).join('');
    return `<h4 class="tv-tipo">${TIPOS[tipo].nombre}</h4><div class="tv-grilla">${items}</div>`;
  }

  /** Secciones de la tienda: mazo y perfil. */
  function html(perfil) {
    const grupo = (g) => Object.keys(TIPOS).filter((t) => TIPOS[t].grupo === g).map((t) => seccion(perfil, t)).join('');
    return `<h3 class="tienda-seccion">🃏 Para tu mazo</h3><div class="tv-bloque">${grupo('mazo')}</div>
      <h3 class="tienda-seccion">👑 Para tu perfil</h3><div class="tv-bloque">${grupo('perfil')}</div>`;
  }

  /** En el perfil: solo lo que ya tenés, para cambiarlo rápido. */
  function htmlPerfil(perfil) {
    const filas = Object.keys(TIPOS).map((tipo) => {
      const propios = CATALOGO.filter((c) => c.tipo === tipo && loTiene(perfil, c.id)).map((c) => tarjeta(perfil, c)).join('');
      return `<h4 class="tv-tipo">${TIPOS[tipo].nombre}</h4><div class="tv-grilla">${propios}</div>`;
    }).join('');
    return `<div class="tv-bloque perfil-cosmeticos"><h3 class="tienda-seccion">🎨 Tu apariencia</h3>${filas}
      <p class="tienda-nota">Comprá más en la <button class="enlace" data-accion="ir" data-destino="tienda">Tienda</button>.</p></div>`;
  }

  const Tienda = Object.freeze({ TIPOS, CATALOGO, porId, comprar, equipar, equipado, apariencia, loTiene, html, htmlPerfil });
  if (esNode) module.exports = Tienda;
  else raiz.Tienda = Tienda;
})(this);
