/* Modo Aventura: "La Conquista de los Cinco Reinos". Cinco capítulos (uno por reino)
 * de tres combates cada uno; el tercero es contra la legendaria del reino. Se juega
 * con el mazo propio. Todo es puro: recibe un perfil y devuelve uno nuevo. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;
  const Datos = esNode ? require('./cartas.js') : raiz.Datos;

  const ETAPAS = Object.freeze([
    { nombre: 'Escaramuza', icono: '⚔️', vida: 20, premio: { oro: 60, gemas: 0 } },
    { nombre: 'Batalla', icono: '🛡️', vida: 24, premio: { oro: 100, gemas: 0 } },
    { nombre: 'Jefe', icono: '👑', vida: 30, premio: { oro: 200, gemas: 3 } },
  ]);
  const PREMIO_REPETIR = Object.freeze({ oro: 15, gemas: 0 });

  const CAPITULOS = Object.freeze([
    { reino: 'bosque', aliado: 'hielo', titulo: 'El Bosque Susurrante', rivales: ['Duende del Musgo', 'Druida de la Luna', 'Sylvara, Reina del Bosque'], jefe: 'b8',
      historia: 'Las raíces se agitan: Sylvara no deja pasar a ningún ejército por su bosque.' },
    { reino: 'corona', aliado: 'fuego', titulo: 'Las Murallas de Altaroca', rivales: ['Capitán de la Guardia', 'Paladín Dorado', 'Rey Aldric el Invicto'], jefe: 'c8',
      historia: 'El Rey Aldric cerró sus puertas. Hay que romper la muralla para seguir.' },
    { reino: 'hielo', aliado: 'arcano', titulo: 'El Glaciar Eterno', rivales: ['Mamut Glacial', 'Dragón de Escarcha', 'Ymir, Señora del Invierno'], jefe: 'h8',
      historia: 'Una tormenta que nunca termina. En su centro espera Ymir.' },
    { reino: 'arcano', aliado: 'bosque', titulo: 'La Torre de las Estrellas', rivales: ['Hechicera de Cristal', 'Archimago Velkor', 'Nyx, Devoradora de Estrellas'], jefe: 'a8',
      historia: 'La torre flota sobre el abismo. Nyx ya vio tu llegada en las estrellas.' },
    { reino: 'fuego', aliado: 'corona', titulo: 'El Volcán del Apocalipsis', rivales: ['Berserker de Lava', 'Elemental de Magma', 'Ignis, Dragón del Apocalipsis'], jefe: 'f8',
      historia: 'La última batalla: el dragón Ignis despierta en el corazón del volcán.' },
  ]);

  const capitulo = (reino) => CAPITULOS.find((c) => c.reino === reino) || null;
  const cartasDe = (reino, rareza) => Datos.CARTAS.filter((c) => c.reino === reino && c.rareza === rareza).map((c) => c.id);
  const copias = (ids, n) => ids.flatMap((id) => Array(n).fill(id));

  /** Mazo de 24 cartas del rival: más fuerte en cada etapa, el jefe trae su legendaria. */
  function mazoRival(reino, etapa) {
    const cap = capitulo(reino);
    if (!cap || !ETAPAS[etapa]) throw new Error(`No existe la etapa ${etapa} de ${reino}`);
    const r = cap.reino;
    const a = cap.aliado;
    const recetas = [
      [copias(cartasDe(r, 'comun'), 2), copias(cartasDe(r, 'rara'), 2), copias(cartasDe(a, 'comun'), 2), copias(cartasDe(a, 'rara'), 2)],
      [copias(cartasDe(r, 'comun'), 2), copias(cartasDe(r, 'rara'), 2), cartasDe(r, 'epica'), copias(cartasDe(a, 'comun'), 2), cartasDe(a, 'rara'), cartasDe(a, 'epica')],
      [copias(cartasDe(r, 'comun'), 2), copias(cartasDe(r, 'rara'), 2), cartasDe(r, 'epica'), cartasDe(r, 'mitica'), cartasDe(r, 'legendaria'),
        cartasDe(a, 'comun'), copias(cartasDe(a, 'rara'), 2), cartasDe(a, 'epica')],
    ];
    return recetas[etapa].flat();
  }

  // ---- Progreso ---------------------------------------------------------------------------
  const superadas = (perfil, reino) => Math.max(0, Math.min(ETAPAS.length, ((perfil.aventura || {})[reino]) || 0));
  const completo = (perfil, reino) => superadas(perfil, reino) >= ETAPAS.length;

  function capituloAbierto(perfil, reino) {
    const i = CAPITULOS.findIndex((c) => c.reino === reino);
    return i === 0 || (i > 0 && completo(perfil, CAPITULOS[i - 1].reino));
  }

  function etapaAbierta(perfil, reino, etapa) {
    return capituloAbierto(perfil, reino) && etapa >= 0 && etapa < ETAPAS.length && etapa <= superadas(perfil, reino);
  }

  /** Datos del rival para empezar un combate de aventura. */
  function rival(reino, etapa) {
    const cap = capitulo(reino);
    const carta = Datos.CARTAS.find((c) => c.nombre === cap.rivales[etapa]);
    return {
      nombre: cap.rivales[etapa], reinos: [cap.reino, cap.aliado], mazo: mazoRival(reino, etapa), retrato: carta ? carta.id : null,
      vida: ETAPAS[etapa].vida, aventura: { reino, etapa },
    };
  }

  /** Anota el resultado. La primera victoria de cada etapa da el premio grande. */
  function registrarCombate(perfil, reino, etapa, gano) {
    const antes = superadas(perfil, reino);
    const primeraVez = gano && etapa === antes;
    const base = !gano ? { oro: 0, gemas: 0 } : (primeraVez ? ETAPAS[etapa].premio : PREMIO_REPETIR);
    const nuevas = primeraVez ? antes + 1 : antes;
    const aventura = { ...(perfil.aventura || {}), [reino]: nuevas };
    return {
      perfil: { ...perfil, aventura, oro: perfil.oro + base.oro, gemas: perfil.gemas + base.gemas },
      premio: { oro: base.oro, gemas: base.gemas, primeraVez, capituloCompleto: primeraVez && nuevas === ETAPAS.length },
    };
  }

  const progresoTotal = (perfil) => CAPITULOS.reduce((n, c) => n + superadas(perfil, c.reino), 0);

  const Aventura = Object.freeze({
    ETAPAS, CAPITULOS, PREMIO_REPETIR, capitulo, mazoRival, superadas, completo, capituloAbierto, etapaAbierta,
    rival, registrarCombate, progresoTotal,
  });
  if (esNode) module.exports = Aventura;
  else raiz.Aventura = Aventura;
})(this);
