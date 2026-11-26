/* Motor de reglas. Cada acción pública recibe un estado y devuelve
 * { ok, estado (copia nueva), eventos, error? } sin tocar el estado original. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;
  const Datos = esNode ? require('./cartas.js') : raiz.Datos;

  const REGLAS = Object.freeze({
    vidaHeroe: 20, manaMaximo: 10, manoMaxima: 9, mesaMaxima: 6,
    manoInicialPrimero: 3, manoInicialSegundo: 4, costoFusion: 1, curaRegenera: 2,
  });
  const COPIAS = Object.freeze({ comun: 2, rara: 2, epica: 1, mitica: 0, legendaria: 1 }); // partida rápida: 28 cartas, las míticas solo en mazos propios
  const OBJ_ELEGIBLES = ['elegir', 'elegirUnidad', 'elegirAliado'];

  const clonar = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
  const tiene = (u, clave) => !!u && Array.isArray(u.claves) && u.claves.includes(clave);
  const rival = (j) => 1 - j;
  const refDe = (u) => ({ jIdx: u.duenio, uid: u.uid });
  const refHeroe = (j) => ({ jIdx: j, heroe: true });
  const fallo = (estado, error) => ({ ok: false, estado, eventos: [], error });

  function mismoRef(a, b) {
    if (!a || !b || a.jIdx !== b.jIdx) return false;
    return a.heroe ? !!b.heroe : (!b.heroe && a.uid === b.uid);
  }

  function barajar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [a[i], a[k]] = [a[k], a[i]];
    }
    return a;
  }

  function idsDelMazo(reinos) {
    return Datos.CARTAS.flatMap((c) => (reinos.includes(c.reino) ? Array(COPIAS[c.rareza] || 0).fill(c.id) : []));
  }

  function crearInstancia(s, id, duenio) {
    const base = Datos.porId[id];
    if (!base) throw new Error('Carta inexistente: ' + id);
    return {
      ...clonar(base), uid: 'u' + (s.sigUid++), duenio, vidaMax: base.vida,
      escudo: tiene(base, 'escudo'), puedeAtacar: false, congelada: false, congeladaEsteTurno: false,
    };
  }

  function unidadPorRef(s, ref) {
    if (!ref || ref.heroe) return null;
    const p = s.jugadores[ref.jIdx];
    return (p && p.mesa.find((u) => u.uid === ref.uid)) || null;
  }

  // ---- Piezas internas (operan sobre la copia de trabajo) -------------------
  function robar(s, j, ev) {
    const p = s.jugadores[j];
    if (p.mazo.length === 0) {
      p.fatiga += 1;
      p.vida -= p.fatiga;
      ev.push({ tipo: 'fatiga', jIdx: j, n: p.fatiga });
      ev.push({ tipo: 'dano', ref: refHeroe(j), n: p.fatiga });
      return;
    }
    const carta = p.mazo.pop();
    if (p.mano.length >= REGLAS.manoMaxima) { ev.push({ tipo: 'quemada', jIdx: j, carta }); return; }
    p.mano.push(carta);
    ev.push({ tipo: 'robo', jIdx: j });
  }

  function curarHeroe(s, j, n, ev) {
    const p = s.jugadores[j];
    const antes = p.vida;
    p.vida = Math.min(p.vidaMax, p.vida + n);
    if (p.vida > antes) ev.push({ tipo: 'curar', ref: refHeroe(j), n: p.vida - antes });
  }

  function congelar(s, u, ev) {
    u.congelada = true;
    u.congeladaEsteTurno = false;
    if (s.turno === u.duenio) u.puedeAtacar = false;
    ev.push({ tipo: 'congelar', ref: refDe(u) });
  }

  function aplicarDano(s, ref, n, fuente, ev) {
    if (n <= 0) return 0;
    let hecho = 0;
    if (ref.heroe) {
      s.jugadores[ref.jIdx].vida -= n;
      hecho = n;
      ev.push({ tipo: 'dano', ref, n });
    } else {
      const u = unidadPorRef(s, ref);
      if (!u || u.vida <= 0) return 0;
      if (u.escudo) { u.escudo = false; ev.push({ tipo: 'escudo', ref }); }
      else { u.vida -= n; hecho = n; ev.push({ tipo: 'dano', ref, n }); }
      if (tiene(fuente, 'helada')) congelar(s, u, ev);
    }
    if (hecho > 0 && tiene(fuente, 'robovida')) curarHeroe(s, fuente.duenio, hecho, ev);
    return hecho;
  }

  function limpiarMuertos(s, ev) {
    s.jugadores.forEach((p) => {
      p.mesa.filter((u) => u.vida <= 0).forEach((u) => ev.push({ tipo: 'muerte', ref: refDe(u) }));
      p.mesa = p.mesa.filter((u) => u.vida > 0);
    });
    if (s.ganador !== null) return;
    const [m0, m1] = s.jugadores.map((p) => p.vida <= 0);
    if (m0 && m1) s.ganador = 'empate';
    else if (m0) s.ganador = 1;
    else if (m1) s.ganador = 0;
    if (s.ganador !== null) ev.push({ tipo: 'fin', ganador: s.ganador });
  }

  // ---- Objetivos -------------------------------------------------------------
  function tipoObjetivo(carta) {
    const e = (carta.efectos || []).find((x) => OBJ_ELEGIBLES.includes(x.obj));
    return e ? e.obj : null;
  }

  function objetivosDeEfecto(s, j, tipo, excluirUid) {
    const r = rival(j);
    const enemigas = s.jugadores[r].mesa.map(refDe);
    if (tipo === 'elegir') return enemigas.concat([refHeroe(r)]);
    if (tipo === 'elegirUnidad') return enemigas;
    if (tipo === 'elegirAliado') return s.jugadores[j].mesa.filter((u) => u.uid !== excluirUid).map(refDe);
    return [];
  }

  function objetivosDeAtaque(s, j) {
    const mesa = s.jugadores[rival(j)].mesa;
    const guardias = mesa.filter((u) => tiene(u, 'guardia'));
    if (guardias.length) return guardias.map(refDe);
    return mesa.map(refDe).concat([refHeroe(rival(j))]);
  }

  const puedeAtacar = (u) => !!u && u.tipo === 'unidad' && u.puedeAtacar && !u.congelada && u.atq > 0;

  function refsDeEfecto(s, j, e, objRef, fuenteUid) {
    const r = rival(j);
    switch (e.obj) {
      case 'elegir': case 'elegirUnidad': case 'elegirAliado': return objRef ? [objRef] : [];
      case 'heroe': return [refHeroe(r)];
      case 'propio': return [refHeroe(j)];
      case 'todos': return s.jugadores[r].mesa.map(refDe);
      case 'todosYHeroe': return s.jugadores[r].mesa.map(refDe).concat([refHeroe(r)]);
      case 'azar': {
        const m = s.jugadores[r].mesa;
        return m.length ? [refDe(m[Math.floor(Math.random() * m.length)])] : [];
      }
      case 'aliados': return s.jugadores[j].mesa.filter((u) => u.uid !== fuenteUid).map(refDe);
      default: return [];
    }
  }

  function resolverEfecto(s, j, e, refs, fuenteDano, ev) {
    const p = s.jugadores[j];
    const vivas = () => refs.map((ref) => unidadPorRef(s, ref)).filter((u) => u && u.vida > 0);
    switch (e.t) {
      case 'dano':
        refs.forEach((ref) => {
          aplicarDano(s, ref, e.n, fuenteDano, ev);
          const u = unidadPorRef(s, ref);
          if (e.congela && u && u.vida > 0) congelar(s, u, ev);
        });
        break;
      case 'congelar': vivas().forEach((u) => congelar(s, u, ev)); break;
      case 'curar': curarHeroe(s, j, e.n, ev); break;
      case 'robar': for (let i = 0; i < e.n; i++) robar(s, j, ev); break;
      case 'buff':
        vivas().forEach((u) => {
          u.atq += e.atq; u.vida += e.vida; u.vidaMax += e.vida;
          ev.push({ tipo: 'buff', ref: refDe(u), atq: e.atq, vida: e.vida });
        });
        break;
      case 'invocar':
        for (let i = 0; i < e.n && p.mesa.length < REGLAS.mesaMaxima; i++) {
          const u = crearInstancia(s, e.id, j);
          p.mesa.push(u);
          ev.push({ tipo: 'invocar', ref: refDe(u) });
        }
        break;
      case 'mana': p.mana += e.n; ev.push({ tipo: 'mana', jIdx: j, n: e.n }); break;
      case 'destruir': vivas().forEach((u) => { u.vida = 0; ev.push({ tipo: 'destruir', ref: refDe(u) }); }); break;
      default: break;
    }
  }

  function resolverEfectos(s, j, fuente, objRef, ev) {
    const esUnidad = fuente.tipo === 'unidad';
    (fuente.efectos || []).forEach((e) => {
      const refs = refsDeEfecto(s, j, e, objRef, esUnidad ? fuente.uid : null);
      resolverEfecto(s, j, e, refs, esUnidad ? fuente : null, ev);
    });
  }

  function comenzarTurno(s, j, ev) {
    const p = s.jugadores[j];
    p.manaMax = Math.min(REGLAS.manaMaximo, p.manaMax + 1);
    p.mana = p.manaMax;
    p.mesa.forEach((u) => {
      if (tiene(u, 'regenera') && u.vida < u.vidaMax) {
        const n = Math.min(REGLAS.curaRegenera, u.vidaMax - u.vida);
        u.vida += n;
        ev.push({ tipo: 'curar', ref: refDe(u), n });
      }
      if (u.congelada) { u.puedeAtacar = false; u.congeladaEsteTurno = true; } else u.puedeAtacar = true;
    });
    ev.push({ tipo: 'turno', jIdx: j });
    // El que empieza no roba en su primer turno (compensa la ventaja de arrancar).
    if (s.numeroTurno > 1) robar(s, j, ev);
    limpiarMuertos(s, ev);
  }

  // ---- Validaciones públicas ------------------------------------------------
  function motivoNoJugable(s, j, idx) {
    if (s.ganador !== null) return 'La partida terminó.';
    if (s.turno !== j) return 'No es tu turno.';
    const p = s.jugadores[j];
    const c = p.mano[idx];
    if (!c) return 'Esa carta no existe.';
    if (c.costo > p.mana) return 'No te alcanza el maná.';
    if (c.tipo === 'unidad' && p.mesa.length >= REGLAS.mesaMaxima) return 'Tu campo está lleno.';
    const tipo = tipoObjetivo(c);
    if (c.tipo === 'hechizo' && tipo && objetivosDeEfecto(s, j, tipo, c.uid).length === 0) return 'No hay objetivos válidos.';
    return null;
  }

  function motivoNoFusionable(s, j, a, b) {
    if (s.ganador !== null) return 'La partida terminó.';
    if (s.turno !== j) return 'No es tu turno.';
    if (a === b) return 'Elegí dos cartas distintas.';
    const p = s.jugadores[j];
    const ca = p.mano[a];
    const cb = p.mano[b];
    if (!ca || !cb) return 'Elegí dos cartas de tu mano.';
    if (ca.rareza !== 'comun' || cb.rareza !== 'comun') return 'Solo se pueden fusionar cartas comunes.';
    if (p.mana < REGLAS.costoFusion) return `Fusionar cuesta ${REGLAS.costoFusion} de maná.`;
    return null;
  }

  // ---- Acciones públicas ------------------------------------------------------
  function nuevaPartida(opciones) {
    const s = { sigUid: 1, turno: 0, numeroTurno: 1, ganador: null, jugadores: [] };
    const empieza = opciones.empieza ?? (Math.random() < 0.5 ? 0 : 1);
    s.jugadores = [0, 1].map((i) => {
      const reinos = opciones.reinos[i];
      if (!Array.isArray(reinos) || reinos.length !== 2 || reinos.some((r) => !Datos.REINOS[r])) {
        throw new Error('Cada jugador necesita 2 reinos válidos.');
      }
      // Vida inicial opcional por jugador (los jefes del Modo Aventura tienen más).
      const pedida = opciones.vidas && Number(opciones.vidas[i]);
      const vida = Number.isFinite(pedida) && pedida > 0 ? Math.round(pedida) : REGLAS.vidaHeroe;
      const jugador = {
        idx: i, nombre: opciones.nombres[i], esIA: !!opciones.ia[i], reinos: reinos.slice(),
        vida, vidaMax: vida, mana: 0, manaMax: 0, fatiga: 0, mano: [], mesa: [], mazo: [],
      };
      // Mazo propio (lista de ids) o, si no hay, todas las cartas de sus dos reinos.
      const propio = opciones.mazos && opciones.mazos[i];
      if (propio && propio.some((id) => !Datos.porId[id])) throw new Error('El mazo tiene cartas que no existen.');
      jugador.mazo = barajar(propio && propio.length ? propio : idsDelMazo(reinos)).map((id) => crearInstancia(s, id, i));
      return jugador;
    });
    s.turno = empieza;
    const ev = [];
    s.jugadores.forEach((p, i) => {
      const n = i === empieza ? REGLAS.manoInicialPrimero : REGLAS.manoInicialSegundo;
      for (let k = 0; k < n; k++) robar(s, i, ev);
      if (i !== empieza) s.jugadores[i].mano.push(crearInstancia(s, 'tk_moneda', i));
    });
    comenzarTurno(s, empieza, ev);
    return s;
  }

  function jugarCarta(estado, j, idx, objetivo) {
    const motivo = motivoNoJugable(estado, j, idx);
    if (motivo) return fallo(estado, motivo);
    const s = clonar(estado);
    const ev = [];
    const p = s.jugadores[j];
    const carta = p.mano[idx];
    const tipo = tipoObjetivo(carta);
    let objRef = null;
    if (tipo) {
      const validos = objetivosDeEfecto(s, j, tipo, carta.uid);
      if (validos.length) {
        objRef = validos.find((v) => mismoRef(v, objetivo)) || null;
        if (!objRef) return fallo(estado, 'Elegí un objetivo válido.');
      }
    }
    p.mano.splice(idx, 1);
    p.mana -= carta.costo;
    ev.push({ tipo: 'jugar', jIdx: j, carta: clonar(carta) });
    if (carta.tipo === 'unidad') {
      carta.puedeAtacar = tiene(carta, 'veloz');
      p.mesa.push(carta);
      ev.push({ tipo: 'invocar', ref: refDe(carta) });
    }
    resolverEfectos(s, j, carta, objRef, ev);
    limpiarMuertos(s, ev);
    return { ok: true, estado: s, eventos: ev };
  }

  function atacar(estado, j, uid, objetivo) {
    if (estado.ganador !== null) return fallo(estado, 'La partida terminó.');
    if (estado.turno !== j) return fallo(estado, 'No es tu turno.');
    const s = clonar(estado);
    const ev = [];
    const a = s.jugadores[j].mesa.find((u) => u.uid === uid);
    if (!a) return fallo(estado, 'Esa unidad no existe.');
    if (a.congelada) return fallo(estado, 'Está congelada.');
    if (!puedeAtacar(a)) return fallo(estado, 'Esa unidad no puede atacar todavía.');
    const validos = objetivosDeAtaque(s, j);
    const obj = validos.find((v) => mismoRef(v, objetivo));
    if (!obj) {
      const hayGuardia = s.jugadores[rival(j)].mesa.some((u) => tiene(u, 'guardia'));
      return fallo(estado, hayGuardia ? 'Primero tenés que atacar a las unidades con Guardia.' : 'Objetivo inválido.');
    }
    a.puedeAtacar = false;
    ev.push({ tipo: 'ataque', ref: refDe(a), objetivo: obj });
    if (obj.heroe) {
      aplicarDano(s, obj, a.atq, a, ev);
    } else {
      const d = unidadPorRef(s, obj);
      const golpeA = a.atq;
      const golpeD = d.atq;
      aplicarDano(s, obj, golpeA, a, ev);
      aplicarDano(s, refDe(a), golpeD, d, ev);
    }
    limpiarMuertos(s, ev);
    return { ok: true, estado: s, eventos: ev };
  }

  function fusionar(estado, j, a, b) {
    const motivo = motivoNoFusionable(estado, j, a, b);
    if (motivo) return fallo(estado, motivo);
    const s = clonar(estado);
    const ev = [];
    const p = s.jugadores[j];
    const ca = p.mano[a];
    const cb = p.mano[b];
    const res = Datos.fusionDe(ca.reino, cb.reino);
    p.mano = p.mano.filter((_, i) => i !== a && i !== b);
    p.mana -= REGLAS.costoFusion;
    const nueva = crearInstancia(s, res.id, j);
    p.mano.push(nueva);
    ev.push({ tipo: 'fusion', jIdx: j, a: ca, b: cb, resultado: clonar(nueva) });
    return { ok: true, estado: s, eventos: ev };
  }

  function terminarTurno(estado, j) {
    if (estado.ganador !== null) return fallo(estado, 'La partida terminó.');
    if (estado.turno !== j) return fallo(estado, 'No es tu turno.');
    const s = clonar(estado);
    const ev = [];
    s.jugadores[j].mesa.forEach((u) => {
      if (u.congeladaEsteTurno) { u.congelada = false; u.congeladaEsteTurno = false; }
    });
    s.turno = rival(j);
    s.numeroTurno += 1;
    comenzarTurno(s, s.turno, ev);
    return { ok: true, estado: s, eventos: ev };
  }

  /** Rendirse: se puede en cualquier momento, aunque no sea tu turno. */
  function rendirse(estado, j) {
    if (estado.ganador !== null) return fallo(estado, 'La partida ya terminó.');
    if (j !== 0 && j !== 1) return fallo(estado, 'Jugador inválido.');
    const s = clonar(estado);
    s.ganador = rival(j);
    const ev = [{ tipo: 'rendicion', jIdx: j }, { tipo: 'fin', ganador: s.ganador }];
    return { ok: true, estado: s, eventos: ev, error: null };
  }

  function ejecutar(estado, j, accion) {
    if (!accion) return fallo(estado, 'Acción vacía.');
    switch (accion.tipo) {
      case 'jugar': return jugarCarta(estado, j, accion.manoIdx, accion.objetivo);
      case 'atacar': return atacar(estado, j, accion.uid, accion.objetivo);
      case 'fusionar': return fusionar(estado, j, accion.a, accion.b);
      case 'terminar': return terminarTurno(estado, j);
      case 'rendirse': return rendirse(estado, j);
      default: return fallo(estado, 'Acción desconocida.');
    }
  }

  const Motor = Object.freeze({
    REGLAS, nuevaPartida, jugarCarta, atacar, fusionar, terminarTurno, rendirse, ejecutar,
    tipoObjetivo, objetivosDeEfecto, objetivosDeAtaque, puedeAtacar, motivoNoJugable, motivoNoFusionable,
    mismoRef, tiene, unidadPorRef,
  });

  if (esNode) module.exports = Motor;
  else raiz.Motor = Motor;
})(this);
