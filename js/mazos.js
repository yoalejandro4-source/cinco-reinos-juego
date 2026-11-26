/* Varios mazos guardados: 2 espacios gratis y hasta 5 comprando espacios con oro.
 * El mazo activo sigue estando en perfil.mazo (lo usa todo el juego); los demás
 * viven en perfil.mazos. Todo es puro: recibe un perfil y devuelve uno nuevo. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;

  const REGLAS = Object.freeze({
    gratis: 2,
    maximo: 5,
    precioEspacio: Object.freeze({ 3: 500, 4: 1000, 5: 2000 }), // oro, según el número de espacio
    largoNombre: 20,
  });

  const nombreDe = (i) => `Mazo ${i + 1}`;
  const error = (perfil, mensaje) => ({ ok: false, perfil, error: mensaje });

  /** Completa los datos de mazos (perfiles viejos tenían uno solo) y guarda el activo al día. */
  function alDia(perfil) {
    const espacios = Math.max(REGLAS.gratis, Math.min(REGLAS.maximo, Number(perfil.espaciosMazo) || REGLAS.gratis));
    const previos = Array.isArray(perfil.mazos) && perfil.mazos.length ? perfil.mazos : [{ nombre: nombreDe(0), cartas: perfil.mazo || [] }];
    const activo = Math.max(0, Math.min(espacios - 1, Number(perfil.mazoActivo) || 0));
    const mazos = Array.from({ length: espacios }, (_, i) => {
      const m = previos[i] || {};
      const cartas = i === activo ? (perfil.mazo || []).slice() : (Array.isArray(m.cartas) ? m.cartas.slice() : []);
      return { nombre: typeof m.nombre === 'string' && m.nombre.trim() ? m.nombre.slice(0, REGLAS.largoNombre) : nombreDe(i), cartas };
    });
    return { ...perfil, espaciosMazo: espacios, mazoActivo: activo, mazos };
  }

  /** Pasa a usar otro mazo guardado. */
  function elegir(perfil, i) {
    const p = alDia(perfil);
    if (!Number.isInteger(i) || i < 0 || i >= p.espaciosMazo) return error(perfil, 'Ese mazo no existe.');
    return { ok: true, perfil: { ...p, mazoActivo: i, mazo: p.mazos[i].cartas.slice() } };
  }

  const precioSiguiente = (perfil) => REGLAS.precioEspacio[alDia(perfil).espaciosMazo + 1] || null;

  /** Compra un espacio más para mazos (con oro). */
  function comprarEspacio(perfil) {
    const p = alDia(perfil);
    if (p.espaciosMazo >= REGLAS.maximo) return error(perfil, `Ya tenés los ${REGLAS.maximo} espacios de mazo.`);
    const precio = precioSiguiente(p);
    if (p.oro < precio) return error(perfil, `Necesitás ${precio} de oro.`);
    const mazos = [...p.mazos, { nombre: nombreDe(p.espaciosMazo), cartas: [] }];
    return { ok: true, perfil: { ...p, oro: p.oro - precio, espaciosMazo: p.espaciosMazo + 1, mazos }, precio };
  }

  function renombrar(perfil, i, nombre) {
    const p = alDia(perfil);
    const limpio = String(nombre || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, REGLAS.largoNombre);
    if (!limpio) return error(perfil, 'Poné un nombre.');
    if (!Number.isInteger(i) || i < 0 || i >= p.espaciosMazo) return error(perfil, 'Ese mazo no existe.');
    const mazos = p.mazos.map((m, j) => (j === i ? { ...m, nombre: limpio } : m));
    return { ok: true, perfil: { ...p, mazos } };
  }

  const Mazos = Object.freeze({ REGLAS, alDia, elegir, comprarEspacio, renombrar, precioSiguiente });
  if (esNode) module.exports = Mazos;
  else raiz.Mazos = Mazos;
})(this);
