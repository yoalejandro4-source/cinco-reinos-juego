/* Economía del jugador: monedas, colección, sobres, fabricación, mazo propio y
 * premios. Todo es puro: cada función recibe un perfil y devuelve uno nuevo. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;
  const Datos = esNode ? require('./cartas.js') : raiz.Datos;

  const CLAVE_GUARDADO = 'cinco-reinos-perfil';
  const VERSION = 1;

  const REGLAS = Object.freeze({
    tamanoMazo: 24, copiasMax: 2, copiasLegendaria: 1, reinosMax: 2,
    oroInicial: 300, gemasIniciales: 5,
    // Pensado para que las cartas buenas cuesten: ~2-3 victorias por sobre y una
    // legendaria fabricada equivale a muchas semanas de juego.
    premio: Object.freeze({
      victoria: { oro: 40, gemas: 0 }, derrota: { oro: 15, gemas: 0 },
      primeraDelDia: { oro: 100, gemas: 1 }, rachaCada: 3, rachaGemas: 1,
    }),
    // Esencia que da una copia sobrante, y lo que cuesta fabricar una carta
    esencia: Object.freeze({ comun: 5, rara: 20, epica: 100, mitica: 250, legendaria: 600 }),
    fabricar: Object.freeze({ comun: 40, rara: 120, epica: 500, mitica: 1200, legendaria: 2400 }),
    // Gloria: moneda que solo se gana contra otras personas. Elo para el ranking.
    pvp: Object.freeze({ gloriaVictoria: 10, gloriaDerrota: 2, eloInicial: 1000, eloMinimo: 100, k: 32 }),
  });

  // Rangos por Elo, de menor a mayor
  const RANGOS = Object.freeze([
    { desde: 0, nombre: 'Recluta', icono: '🪵' },
    { desde: 900, nombre: 'Escudero', icono: '🛡️' },
    { desde: 1100, nombre: 'Caballero', icono: '⚔️' },
    { desde: 1300, nombre: 'Campeón', icono: '🏆' },
    { desde: 1500, nombre: 'Señor de la Guerra', icono: '👑' },
    { desde: 1700, nombre: 'Leyenda de los Reinos', icono: '🐉' },
  ]);

  const SOBRES = Object.freeze({
    reinos: { id: 'reinos', nombre: 'Sobre de los Reinos', precio: { oro: 100 }, cartas: 5, garantia: 'rara', porReino: false },
    reino: { id: 'reino', nombre: 'Sobre de Reino', precio: { oro: 150 }, cartas: 5, garantia: 'rara', porReino: true },
    epico: { id: 'epico', nombre: 'Sobre Épico', precio: { gemas: 12 }, cartas: 5, garantia: 'epica', porReino: false },
  });

  // Probabilidades por espacio del sobre (deben sumar 1)
  const PROB_NORMAL = [['comun', 0.70], ['rara', 0.23], ['epica', 0.055], ['mitica', 0.012], ['legendaria', 0.003]];
  const PROB_GARANTIA = Object.freeze({
    rara: [['rara', 0.80], ['epica', 0.15], ['mitica', 0.04], ['legendaria', 0.01]],
    epica: [['epica', 0.82], ['mitica', 0.14], ['legendaria', 0.04]],
  });
  const MAZO_INICIAL_REINOS = ['fuego', 'hielo'];

  const coleccionables = () => Datos.CARTAS;
  const carta = (id) => Datos.porId[id];
  const UNA_COPIA = Object.freeze(['mitica', 'legendaria']);
  const maxCopias = (id) => (carta(id) && UNA_COPIA.includes(carta(id).rareza) ? REGLAS.copiasLegendaria : REGLAS.copiasMax);
  const hoyTexto = (fecha) => (fecha || new Date()).toISOString().slice(0, 10);
  const error = (perfil, mensaje) => ({ ok: false, perfil, error: mensaje });

  // ---- Perfil ---------------------------------------------------------------------------
  function coleccionInicial() {
    return coleccionables().reduce((acc, c) => (['comun', 'rara'].includes(c.rareza) ? { ...acc, [c.id]: REGLAS.copiasMax } : acc), {});
  }

  function mazoDeReinos(reinos, coleccion) {
    return coleccionables()
      .filter((c) => reinos.includes(c.reino))
      .flatMap((c) => Array(Math.min(coleccion[c.id] || 0, maxCopias(c.id))).fill(c.id))
      .slice(0, REGLAS.tamanoMazo);
  }

  function perfilNuevo() {
    const coleccion = coleccionInicial();
    return {
      version: VERSION, nombre: 'Jugador', oro: REGLAS.oroInicial, gemas: REGLAS.gemasIniciales, esencia: 0,
      coleccion, mazo: mazoDeReinos(MAZO_INICIAL_REINOS, coleccion),
      estadisticas: { victorias: 0, derrotas: 0, racha: 0, sobresAbiertos: 0 },
      ultimaVictoria: null,
      cosmeticos: { comprados: [], equipados: {} },
      gloria: 0, elo: REGLAS.pvp.eloInicial, pvp: { victorias: 0, derrotas: 0, mejorElo: REGLAS.pvp.eloInicial },
    };
  }

  /** Lee el perfil guardado; si no hay o está dañado, arranca uno nuevo. */
  function cargar(almacen) {
    try {
      const texto = almacen && almacen.getItem(CLAVE_GUARDADO);
      if (!texto) return perfilNuevo();
      const datos = JSON.parse(texto);
      if (!datos || datos.version !== VERSION || typeof datos.coleccion !== 'object' || !Array.isArray(datos.mazo)) return perfilNuevo();
      return { ...perfilNuevo(), ...datos, estadisticas: { ...perfilNuevo().estadisticas, ...datos.estadisticas } };
    } catch (e) {
      return perfilNuevo();
    }
  }

  /** Guarda el perfil. Devuelve false si el almacenamiento no está disponible. */
  function guardar(almacen, perfil) {
    try {
      almacen.setItem(CLAVE_GUARDADO, JSON.stringify(perfil));
      return true;
    } catch (e) {
      return false;
    }
  }

  function cambiarNombre(perfil, nombre) {
    const limpio = String(nombre || '').replace(/[<>&"']/g, '').trim().slice(0, 18);
    if (!limpio) return error(perfil, 'Escribí un nombre.');
    return { ok: true, perfil: { ...perfil, nombre: limpio } };
  }

  // ---- Monedas ------------------------------------------------------------------------------
  function alcanza(perfil, precio) {
    return (perfil.oro >= (precio.oro || 0)) && (perfil.gemas >= (precio.gemas || 0));
  }

  function cobrar(perfil, precio) {
    return { ...perfil, oro: perfil.oro - (precio.oro || 0), gemas: perfil.gemas - (precio.gemas || 0) };
  }

  // ---- Sobres ---------------------------------------------------------------------------------
  function sortearRareza(tabla, rng) {
    let r = rng();
    for (const [rareza, p] of tabla) {
      if (r < p) return rareza;
      r -= p;
    }
    return tabla[tabla.length - 1][0];
  }

  function sortearCarta(rareza, reino, rng) {
    const opciones = coleccionables().filter((c) => c.rareza === rareza && (!reino || c.reino === reino));
    return opciones[Math.floor(rng() * opciones.length)].id;
  }

  /** Suma cartas a la colección; las copias que pasan el máximo se convierten en esencia. */
  function sumarCartas(perfil, ids) {
    let coleccion = { ...perfil.coleccion };
    let esencia = perfil.esencia;
    const detalle = ids.map((id) => {
      const antes = coleccion[id] || 0;
      if (antes >= maxCopias(id)) {
        const extra = REGLAS.esencia[carta(id).rareza];
        esencia += extra;
        return { id, nueva: false, esencia: extra };
      }
      coleccion = { ...coleccion, [id]: antes + 1 };
      return { id, nueva: antes === 0, esencia: 0 };
    });
    return { perfil: { ...perfil, coleccion, esencia }, detalle };
  }

  /** Compra y abre un sobre. rng se puede fijar para pruebas. */
  function comprarSobre(perfil, tipo, reinoElegido, rng) {
    const azar = rng || Math.random;
    const sobre = SOBRES[tipo];
    if (!sobre) return error(perfil, 'Ese sobre no existe.');
    if (sobre.porReino && !Datos.REINOS[reinoElegido]) return error(perfil, 'Elegí un reino para el sobre.');
    if (!alcanza(perfil, sobre.precio)) return error(perfil, sobre.precio.gemas ? 'No te alcanzan las gemas.' : 'No te alcanza el oro.');
    const reino = sobre.porReino ? reinoElegido : null;
    const ids = Array.from({ length: sobre.cartas }, (_, i) => {
      const tabla = i === sobre.cartas - 1 ? PROB_GARANTIA[sobre.garantia] : PROB_NORMAL;
      return sortearCarta(sortearRareza(tabla, azar), reino, azar);
    });
    const cobrado = cobrar(perfil, sobre.precio);
    const { perfil: conCartas, detalle } = sumarCartas(cobrado, ids);
    const estadisticas = { ...conCartas.estadisticas, sobresAbiertos: conCartas.estadisticas.sobresAbiertos + 1 };
    return { ok: true, perfil: { ...conCartas, estadisticas }, cartas: detalle };
  }

  // ---- Fabricar --------------------------------------------------------------------------------
  function costoFabricar(id) {
    const c = carta(id);
    return c ? REGLAS.fabricar[c.rareza] : null;
  }

  function fabricar(perfil, id) {
    const c = carta(id);
    if (!c || !coleccionables().includes(c)) return error(perfil, 'Esa carta no se puede fabricar.');
    if ((perfil.coleccion[id] || 0) >= maxCopias(id)) return error(perfil, 'Ya tenés todas las copias de esa carta.');
    const costo = REGLAS.fabricar[c.rareza];
    if (perfil.esencia < costo) return error(perfil, `Necesitás ${costo} de esencia.`);
    return {
      ok: true,
      perfil: { ...perfil, esencia: perfil.esencia - costo, coleccion: { ...perfil.coleccion, [id]: (perfil.coleccion[id] || 0) + 1 } },
    };
  }

  // ---- Mazo ---------------------------------------------------------------------------------------
  const contar = (ids) => ids.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});

  /** Los reinos del mazo, del más usado al menos usado. */
  function reinosDeMazo(mazo) {
    const porReino = mazo.reduce((acc, id) => ({ ...acc, [carta(id).reino]: (acc[carta(id).reino] || 0) + 1 }), {});
    return Object.keys(porReino).sort((a, b) => porReino[b] - porReino[a]);
  }

  function validarMazo(perfil) {
    const errores = [];
    const mazo = perfil.mazo;
    if (mazo.length !== REGLAS.tamanoMazo) errores.push(`El mazo tiene ${mazo.length} de ${REGLAS.tamanoMazo} cartas.`);
    const reinos = reinosDeMazo(mazo);
    if (reinos.length > REGLAS.reinosMax) errores.push(`Usá cartas de ${REGLAS.reinosMax} reinos como máximo.`);
    Object.entries(contar(mazo)).forEach(([id, n]) => {
      if (n > maxCopias(id)) errores.push(`Demasiadas copias de ${carta(id).nombre}.`);
      if (n > (perfil.coleccion[id] || 0)) errores.push(`No tenés suficientes copias de ${carta(id).nombre}.`);
    });
    return { ok: errores.length === 0, errores, reinos };
  }

  function agregarAlMazo(perfil, id) {
    const c = carta(id);
    if (!c || !coleccionables().includes(c)) return error(perfil, 'Esa carta no va en el mazo.');
    if (perfil.mazo.length >= REGLAS.tamanoMazo) return error(perfil, `El mazo ya tiene ${REGLAS.tamanoMazo} cartas.`);
    const enMazo = perfil.mazo.filter((x) => x === id).length;
    if (enMazo >= maxCopias(id)) return error(perfil, UNA_COPIA.includes(c.rareza) ? 'Solo 1 copia de cada mítica o legendaria.' : `Máximo ${REGLAS.copiasMax} copias.`);
    if (enMazo >= (perfil.coleccion[id] || 0)) return error(perfil, 'No tenés más copias de esa carta.');
    const reinos = reinosDeMazo(perfil.mazo);
    if (!reinos.includes(c.reino) && reinos.length >= REGLAS.reinosMax) return error(perfil, `Tu mazo ya usa ${REGLAS.reinosMax} reinos.`);
    return { ok: true, perfil: { ...perfil, mazo: [...perfil.mazo, id] } };
  }

  function quitarDelMazo(perfil, id) {
    const i = perfil.mazo.indexOf(id);
    if (i < 0) return error(perfil, 'Esa carta no está en el mazo.');
    return { ok: true, perfil: { ...perfil, mazo: perfil.mazo.filter((_, k) => k !== i) } };
  }

  const ORDEN_RAREZA = Object.freeze({ legendaria: 0, mitica: 1, epica: 2, rara: 3, comun: 4 });

  /** Completa el mazo hasta 24 con las mejores cartas que tengas de sus reinos. */
  function autocompletarMazo(perfil) {
    const usados = reinosDeMazo(perfil.mazo);
    const reinos = usados.length >= REGLAS.reinosMax ? usados : [...usados, ...MAZO_INICIAL_REINOS.filter((r) => !usados.includes(r))].slice(0, REGLAS.reinosMax);
    const candidatas = coleccionables()
      .filter((c) => reinos.includes(c.reino) && (perfil.coleccion[c.id] || 0) > 0)
      .sort((a, b) => ORDEN_RAREZA[a.rareza] - ORDEN_RAREZA[b.rareza] || a.costo - b.costo);
    let actual = perfil;
    for (const c of candidatas) {
      for (let k = 0; k < REGLAS.copiasMax && actual.mazo.length < REGLAS.tamanoMazo; k++) {
        const r = agregarAlMazo(actual, c.id);
        if (r.ok) actual = r.perfil;
      }
    }
    return { ok: true, perfil: actual };
  }

  function vaciarMazo(perfil) {
    return { ok: true, perfil: { ...perfil, mazo: [] } };
  }

  // ---- Premios ------------------------------------------------------------------------------------
  function registrarPartida(perfil, gano, fecha) {
    const P = REGLAS.premio;
    const hoy = hoyTexto(fecha);
    const base = gano ? P.victoria : P.derrota;
    const primera = gano && perfil.ultimaVictoria !== hoy;
    const racha = gano ? perfil.estadisticas.racha + 1 : 0;
    const bonoRacha = gano && racha % P.rachaCada === 0 ? P.rachaGemas : 0;
    const premio = {
      oro: base.oro + (primera ? P.primeraDelDia.oro : 0),
      gemas: base.gemas + (primera ? P.primeraDelDia.gemas : 0) + bonoRacha,
      primeraDelDia: primera, racha,
    };
    const est = perfil.estadisticas;
    return {
      perfil: {
        ...perfil, oro: perfil.oro + premio.oro, gemas: perfil.gemas + premio.gemas,
        ultimaVictoria: gano ? hoy : perfil.ultimaVictoria,
        estadisticas: { ...est, victorias: est.victorias + (gano ? 1 : 0), derrotas: est.derrotas + (gano ? 0 : 1), racha },
      },
      premio,
    };
  }

  // ---- PvP: gloria y Elo ------------------------------------------------------------------------
  const rangoDe = (elo) => RANGOS.reduce((r, x) => (elo >= x.desde ? x : r), RANGOS[0]);

  /** Probabilidad de ganar según la diferencia de Elo (fórmula clásica). */
  const esperado = (elo, eloRival) => 1 / (1 + 10 ** ((eloRival - elo) / 400));

  /** Registra una partida contra otra persona: suma gloria y mueve el Elo. */
  function registrarPvP(perfil, gano, eloRival) {
    const P = REGLAS.pvp;
    const rival = Number.isFinite(eloRival) ? eloRival : P.eloInicial;
    const antes = Number.isFinite(perfil.elo) ? perfil.elo : P.eloInicial;
    const cambio = Math.round(P.k * ((gano ? 1 : 0) - esperado(antes, rival)));
    const despues = Math.max(P.eloMinimo, antes + cambio);
    const gloria = gano ? P.gloriaVictoria : P.gloriaDerrota;
    const pvp = perfil.pvp || { victorias: 0, derrotas: 0, mejorElo: antes };
    return {
      perfil: {
        ...perfil, gloria: (perfil.gloria || 0) + gloria, elo: despues,
        pvp: { victorias: pvp.victorias + (gano ? 1 : 0), derrotas: pvp.derrotas + (gano ? 0 : 1), mejorElo: Math.max(pvp.mejorElo, despues) },
      },
      premio: { gloria, eloAntes: antes, eloDespues: despues, cambio: despues - antes, rango: rangoDe(despues) },
    };
  }

  const Economia = Object.freeze({
    REGLAS, SOBRES, perfilNuevo, cargar, guardar, cambiarNombre, alcanza, cobrar,
    comprarSobre, sumarCartas, fabricar, costoFabricar, maxCopias,
    reinosDeMazo, validarMazo, agregarAlMazo, quitarDelMazo, vaciarMazo, autocompletarMazo, registrarPartida,
    RANGOS, rangoDe, registrarPvP, UNA_COPIA,
  });
  if (esNode) module.exports = Economia;
  else raiz.Economia = Economia;
})(this);
