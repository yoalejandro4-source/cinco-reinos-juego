/* IA rival: decide una acción por vez (fusionar, jugar, atacar o terminar). */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;
  const Datos = esNode ? require('./cartas.js') : raiz.Datos;
  const Motor = esNode ? require('./motor.js') : raiz.Motor;

  const valor = (u) => u.atq * 1.2 + u.vida + (u.claves || []).length;
  const ref = (u) => ({ jIdx: u.duenio, uid: u.uid });
  const mayorPor = (lista, f) => lista.reduce((mejor, x) => (mejor === null || f(x) > f(mejor) ? x : mejor), null);

  function mejorFusion(s, j) {
    const p = s.jugadores[j];
    if (p.mesa.length >= Motor.REGLAS.mesaMaxima) return null;
    const comunes = p.mano.map((c, i) => ({ c, i })).filter((x) => x.c.rareza === 'comun');
    let mejor = null;
    for (let x = 0; x < comunes.length; x++) {
      for (let y = x + 1; y < comunes.length; y++) {
        const res = Datos.fusionDe(comunes[x].c.reino, comunes[y].c.reino);
        if (res.costo + Motor.REGLAS.costoFusion > p.mana) continue;
        const v = valor(res);
        if (!mejor || v > mejor.v) mejor = { v, a: comunes[x].i, b: comunes[y].i };
      }
    }
    return mejor ? { tipo: 'fusionar', a: mejor.a, b: mejor.b } : null;
  }

  function objetivoParaDano(enemigos, n, tipo, rivalIdx) {
    const matables = enemigos.filter((u) => !u.escudo && u.vida <= n);
    const presa = mayorPor(matables, (u) => u.atq);
    if (presa) return ref(presa);
    if (tipo === 'elegir') return { jIdx: rivalIdx, heroe: true };
    const fuerte = mayorPor(enemigos, (u) => u.atq);
    return fuerte ? ref(fuerte) : null;
  }

  /** Devuelve { objetivo } si conviene jugar la carta, o null si no. */
  function elegirObjetivoCarta(s, j, carta) {
    const enemigos = s.jugadores[1 - j].mesa;
    const mios = s.jugadores[j].mesa;
    const efectos = carta.efectos || [];
    if (carta.tipo === 'hechizo') {
      if (efectos.some((e) => e.obj === 'aliados') && mios.length === 0) return null;
      if (efectos.some((e) => e.obj === 'todos') && enemigos.length === 0) return null;
    }
    const tipo = Motor.tipoObjetivo(carta);
    if (!tipo) return { objetivo: null };
    const validos = Motor.objetivosDeEfecto(s, j, tipo, carta.uid);
    if (!validos.length) return carta.tipo === 'unidad' ? { objetivo: null } : null;
    if (tipo === 'elegirAliado') return { objetivo: ref(mayorPor(mios, valor)) };
    if (efectos.some((e) => e.t === 'destruir')) return { objetivo: ref(mayorPor(enemigos, valor)) };
    const eDano = efectos.find((e) => e.t === 'dano' && e.obj === tipo);
    if (eDano) {
      const obj = objetivoParaDano(enemigos, eDano.n, tipo, 1 - j);
      return obj ? { objetivo: obj } : null;
    }
    return { objetivo: ref(mayorPor(enemigos, (u) => u.atq)) };
  }

  function mejorJugada(s, j) {
    const p = s.jugadores[j];
    const orden = p.mano
      .map((c, i) => ({ c, i }))
      .filter((x) => !Motor.motivoNoJugable(s, j, x.i))
      .sort((a, b) => b.c.costo - a.c.costo);
    for (const { c, i } of orden) {
      const eleccion = elegirObjetivoCarta(s, j, c);
      if (eleccion) return { tipo: 'jugar', manoIdx: i, objetivo: eleccion.objetivo };
    }
    return null;
  }

  function mejorAtaque(s, j) {
    const listos = s.jugadores[j].mesa.filter(Motor.puedeAtacar).sort((a, b) => b.atq - a.atq);
    if (!listos.length) return null;
    const validos = Motor.objetivosDeAtaque(s, j);
    const heroe = validos.find((v) => v.heroe);
    const defensores = validos.filter((v) => !v.heroe).map((v) => Motor.unidadPorRef(s, v));
    const mata = (a, d) => !d.escudo && a.atq >= d.vida;
    const sobrevive = (a, d) => a.escudo || d.atq < a.vida;

    if (heroe) {
      const total = listos.reduce((t, u) => t + u.atq, 0);
      if (total >= s.jugadores[1 - j].vida) return { tipo: 'atacar', uid: listos[0].uid, objetivo: heroe };
    }
    for (const a of listos) {
      const limpios = defensores.filter((d) => mata(a, d) && sobrevive(a, d));
      const canjes = defensores.filter((d) => mata(a, d) && valor(d) >= valor(a));
      const presa = mayorPor(limpios, valor) || mayorPor(canjes, valor);
      if (presa) return { tipo: 'atacar', uid: a.uid, objetivo: ref(presa) };
    }
    if (heroe) return { tipo: 'atacar', uid: listos[0].uid, objetivo: heroe };
    const blanco = defensores.slice().sort((x, y) => x.vida - y.vida)[0];
    return blanco ? { tipo: 'atacar', uid: listos[0].uid, objetivo: ref(blanco) } : null;
  }

  function siguienteAccion(s, j) {
    if (s.ganador !== null || s.turno !== j) return null;
    return mejorFusion(s, j) || mejorJugada(s, j) || mejorAtaque(s, j) || { tipo: 'terminar' };
  }

  const IA = Object.freeze({ siguienteAccion });
  if (esNode) module.exports = IA;
  else raiz.IA = IA;
})(this);
