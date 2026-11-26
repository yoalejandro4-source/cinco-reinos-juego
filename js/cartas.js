/* Datos del juego: reinos, palabras clave, cartas, fichas y recetas de fusión. */
(function (raiz) {
  'use strict';

  const REINOS = Object.freeze({
    bosque: { id: 'bosque', nombre: 'Reino del Bosque', corto: 'Bosque', icono: '🌳', c1: '#2bff88', c2: '#05864a', c3: '#002b17', lema: 'La vida siempre vuelve.', estilo: 'Bestias enormes, regeneración y curación.' },
    corona: { id: 'corona', nombre: 'Reino de la Corona', corto: 'Corona', icono: '👑', c1: '#ffd84a', c2: '#d26a00', c3: '#3a1700', lema: 'Por el rey y por la gloria.', estilo: 'Humanos con escudos y ejércitos que se potencian.' },
    hielo: { id: 'hielo', nombre: 'Reino del Hielo', corto: 'Hielo', icono: '❄️', c1: '#7af4ff', c2: '#1677ff', c3: '#00174a', lema: 'El invierno no perdona.', estilo: 'Congela enemigos y levanta murallas.' },
    arcano: { id: 'arcano', nombre: 'Reino Arcano', corto: 'Arcano', icono: '🔮', c1: '#ea85ff', c2: '#7a1cff', c3: '#1c0040', lema: 'El poder está en el conocimiento.', estilo: 'Magia, robar cartas y maná extra.' },
    fuego: { id: 'fuego', nombre: 'Reino del Fuego', corto: 'Fuego', icono: '🔥', c1: '#ffb02e', c2: '#ff2a1a', c3: '#450008', lema: 'Todo arde al final.', estilo: 'Ataques veloces y daño directo.' },
  });

  const CLAVES = Object.freeze({
    guardia: { nombre: 'Guardia', icono: '🛡️', desc: 'Los enemigos tienen que atacar primero a las unidades con Guardia.' },
    veloz: { nombre: 'Veloz', icono: '⚡', desc: 'Puede atacar el mismo turno en que entra.' },
    escudo: { nombre: 'Escudo', icono: '✨', desc: 'Ignora el primer daño que recibe.' },
    helada: { nombre: 'Helada', icono: '❄️', desc: 'Congela a las unidades que daña. Una unidad congelada pierde su próximo ataque.' },
    robovida: { nombre: 'Robavida', icono: '🩸', desc: 'El daño que hace cura a tu héroe.' },
    regenera: { nombre: 'Regenera', icono: '♻️', desc: 'Al inicio de tu turno recupera 2 de vida.' },
  });

  // 'rara' se muestra como "Poco común" (el id interno se mantiene para no romper perfiles guardados).
  const RAREZAS = Object.freeze({ comun: 'Común', rara: 'Poco común', epica: 'Épica', mitica: 'Mítica', legendaria: 'Legendaria', fusion: 'Fusión', token: 'Ficha' });
  const ORDEN_RAREZAS = Object.freeze(['comun', 'rara', 'epica', 'mitica', 'legendaria']);

  // ---- Fábricas -----------------------------------------------------------
  function unidad(id, nombre, reino, rareza, costo, atq, vida, icono, claves, efectos) {
    return Object.freeze({ id, nombre, reino, rareza, tipo: 'unidad', costo, atq, vida, icono, claves: claves || [], efectos: efectos || [] });
  }
  function hechizo(id, nombre, reino, rareza, costo, icono, efectos) {
    return Object.freeze({ id, nombre, reino, rareza, tipo: 'hechizo', costo, atq: 0, vida: 0, icono, claves: [], efectos });
  }
  const dano = (n, obj, congela) => ({ t: 'dano', n, obj, congela: !!congela });
  const curar = (n) => ({ t: 'curar', n, obj: 'propio' });
  const robar = (n) => ({ t: 'robar', n });
  const buff = (atq, vida, obj) => ({ t: 'buff', atq, vida, obj });
  const congelar = (obj) => ({ t: 'congelar', obj });
  const invocar = (id, n) => ({ t: 'invocar', id, n });
  const mana = (n) => ({ t: 'mana', n });
  const destruir = () => ({ t: 'destruir', obj: 'elegirUnidad' });

  // ---- Cartas de los reinos -------------------------------------------------
  const CARTAS = Object.freeze([
    // BOSQUE
    unidad('b1', 'Duende del Musgo', 'bosque', 'comun', 1, 1, 2, '🍄', [], [curar(2)]),
    unidad('b2', 'Lobo Esmeralda', 'bosque', 'comun', 2, 3, 2, '🐺'),
    unidad('b3', 'Guardián de Corteza', 'bosque', 'comun', 3, 2, 5, '🌲', ['guardia']),
    hechizo('b4', 'Brote Salvaje', 'bosque', 'comun', 1, '🌱', [buff(2, 2, 'elegirAliado')]),
    unidad('b5', 'Druida de la Luna', 'bosque', 'rara', 4, 3, 4, '🦌', [], [buff(1, 1, 'aliados')]),
    unidad('b6', 'Oso Ancestral', 'bosque', 'rara', 5, 5, 6, '🐻', ['regenera']),
    unidad('b7', 'Ent Milenario', 'bosque', 'epica', 7, 6, 9, '🌳', ['guardia', 'regenera'], [curar(5)]),
    unidad('b9', 'Wyrm de Raíces Antiguas', 'bosque', 'mitica', 7, 6, 7, '🐉', ['regenera'], [invocar('tk_retono', 1), curar(4)]),
    unidad('b8', 'Sylvara, Reina del Bosque', 'bosque', 'legendaria', 8, 6, 7, '🧝', [], [invocar('tk_retono', 2), buff(1, 1, 'aliados')]),

    // CORONA (humanos)
    unidad('c1', 'Escudero Valiente', 'corona', 'comun', 1, 1, 1, '🤺', ['escudo']),
    unidad('c2', 'Arquero Real', 'corona', 'comun', 2, 2, 2, '🏹', [], [dano(1, 'elegir')]),
    unidad('c3', 'Caballero de la Corona', 'corona', 'comun', 3, 2, 3, '⚔️', ['escudo']),
    hechizo('c4', 'Grito de Guerra', 'corona', 'comun', 3, '📯', [buff(1, 1, 'aliados')]),
    unidad('c5', 'Capitán de la Guardia', 'corona', 'rara', 4, 3, 4, '💂', ['guardia'], [invocar('c1', 1)]),
    unidad('c6', 'Paladín Dorado', 'corona', 'rara', 5, 4, 4, '⚜️', ['escudo', 'robovida']),
    unidad('c7', 'Grifo Imperial', 'corona', 'epica', 6, 5, 4, '🦁', ['veloz', 'escudo']),
    unidad('c9', 'Mariscal de Altaroca', 'corona', 'mitica', 7, 5, 6, '🎖️', ['guardia', 'escudo'], [invocar('c1', 2)]),
    unidad('c8', 'Rey Aldric el Invicto', 'corona', 'legendaria', 8, 6, 8, '🤴', ['guardia', 'escudo'], [buff(2, 2, 'aliados')]),

    // HIELO
    unidad('h1', 'Pingüino Escarchado', 'hielo', 'comun', 1, 1, 2, '🐧', ['helada']),
    unidad('h2', 'Zorro Ártico', 'hielo', 'comun', 2, 2, 3, '🦊', [], [congelar('elegirUnidad')]),
    unidad('h3', 'Gólem de Hielo', 'hielo', 'comun', 3, 2, 6, '🗿', ['guardia']),
    hechizo('h4', 'Lanza de Hielo', 'hielo', 'comun', 2, '🧊', [dano(2, 'elegirUnidad', true)]),
    hechizo('h5', 'Ventisca', 'hielo', 'rara', 4, '🌨️', [dano(1, 'todos', true)]),
    unidad('h6', 'Mamut Glacial', 'hielo', 'rara', 5, 4, 7, '🐘', ['guardia', 'helada']),
    unidad('h7', 'Dragón de Escarcha', 'hielo', 'epica', 7, 6, 6, '🐉', ['helada'], [congelar('todos')]),
    unidad('h9', 'Lich del Glaciar Eterno', 'hielo', 'mitica', 7, 5, 7, '💀', ['helada', 'robovida'], [dano(2, 'elegir', true), robar(1)]),
    unidad('h8', 'Ymir, Señora del Invierno', 'hielo', 'legendaria', 8, 5, 8, '🌬️', [], [dano(3, 'todos', true)]),

    // ARCANO (mágicos)
    unidad('a1', 'Aprendiz Arcano', 'arcano', 'comun', 1, 1, 1, '📘', [], [robar(1)]),
    unidad('a2', 'Duendecillo de Maná', 'arcano', 'comun', 2, 2, 2, '✨', [], [mana(1)]),
    unidad('a3', 'Gólem Rúnico', 'arcano', 'comun', 3, 3, 5, '🔷'),
    hechizo('a4', 'Proyectil Arcano', 'arcano', 'comun', 1, '✴️', [dano(2, 'elegir')]),
    hechizo('a5', 'Visión del Oráculo', 'arcano', 'rara', 2, '👁️', [robar(2)]),
    unidad('a6', 'Hechicera de Cristal', 'arcano', 'rara', 4, 3, 4, '🔮', [], [dano(2, 'elegir')]),
    unidad('a7', 'Archimago Velkor', 'arcano', 'epica', 6, 5, 6, '🧙', [], [robar(2), dano(3, 'elegir')]),
    unidad('a9', 'Oráculo del Vacío', 'arcano', 'mitica', 7, 5, 6, '🪬', [], [mana(2), robar(2)]),
    unidad('a8', 'Nyx, Devoradora de Estrellas', 'arcano', 'legendaria', 9, 8, 8, '🌌', [], [destruir(), robar(2)]),

    // FUEGO
    unidad('f1', 'Diablillo Ígneo', 'fuego', 'comun', 1, 2, 1, '😈', ['veloz']),
    unidad('f2', 'Salamandra Ardiente', 'fuego', 'comun', 2, 2, 2, '🦎', [], [dano(2, 'heroe')]),
    unidad('f3', 'Berserker de Lava', 'fuego', 'comun', 3, 4, 3, '🗡️', ['veloz']),
    hechizo('f4', 'Bola de Fuego', 'fuego', 'comun', 3, '☄️', [dano(4, 'elegir')]),
    hechizo('f5', 'Lluvia de Meteoros', 'fuego', 'rara', 4, '🌠', [dano(2, 'todos')]),
    unidad('f6', 'Fénix de Ceniza', 'fuego', 'rara', 4, 4, 4, '🦅', ['veloz', 'robovida']),
    unidad('f7', 'Elemental de Magma', 'fuego', 'epica', 6, 5, 6, '🌋', ['guardia'], [dano(3, 'elegir')]),
    unidad('f9', 'Señor de las Brasas', 'fuego', 'mitica', 7, 6, 5, '😈', ['veloz', 'robovida'], [dano(3, 'heroe')]),
    unidad('f8', 'Ignis, Dragón del Apocalipsis', 'fuego', 'legendaria', 8, 7, 6, '🐲', ['veloz'], [dano(2, 'todosYHeroe')]),
  ]);

  // Fichas: aparecen por efectos, no van en el mazo.
  const FICHAS = Object.freeze([
    unidad('tk_retono', 'Retoño', 'bosque', 'token', 1, 2, 2, '🌱', ['guardia']),
    // La recibe el que juega segundo, para compensar la ventaja de empezar.
    hechizo('tk_moneda', 'Moneda de la Suerte', 'corona', 'token', 0, '🪙', [mana(1)]),
  ]);

  // ---- Fusiones: dos comunes -> una carta nueva según sus reinos -----------
  const claveFusion = (a, b) => [a, b].sort().join('+');

  function fusion(reinoA, reinoB, nombre, costo, atq, vida, icono, claves, efectos) {
    const [r1, r2] = [reinoA, reinoB].sort();
    return Object.freeze({
      id: 'x_' + claveFusion(r1, r2), nombre, reino: r1, reino2: r2 === r1 ? null : r2,
      rareza: 'fusion', tipo: 'unidad', costo, atq, vida, icono, claves: claves || [], efectos: efectos || [],
    });
  }

  const LISTA_FUSIONES = [
    fusion('bosque', 'bosque', 'Lobo Alfa de Jade', 4, 5, 5, '🐺', ['regenera'], [curar(3)]),
    fusion('corona', 'corona', 'Caballero Real Supremo', 4, 4, 4, '🏇', ['guardia', 'escudo'], [buff(1, 1, 'aliados')]),
    fusion('hielo', 'hielo', 'Coloso Glacial', 4, 3, 8, '🏔️', ['guardia', 'helada']),
    fusion('arcano', 'arcano', 'Gólem de Maná Puro', 3, 4, 4, '💠', [], [robar(2)]),
    fusion('fuego', 'fuego', 'Infernal Desatado', 4, 6, 3, '👹', ['veloz'], [dano(2, 'heroe')]),
    fusion('bosque', 'corona', 'Guardabosques Real', 3, 3, 4, '🎯', [], [dano(2, 'elegir'), curar(2)]),
    fusion('bosque', 'hielo', 'Ent Escarchado', 4, 3, 7, '🎄', ['guardia', 'helada', 'regenera']),
    fusion('arcano', 'bosque', 'Hada del Roble Encantado', 3, 3, 3, '🧚', [], [buff(1, 1, 'aliados'), robar(1)]),
    fusion('bosque', 'fuego', 'Hidra de Brasas', 4, 4, 5, '🐍', ['regenera'], [dano(1, 'todos')]),
    fusion('corona', 'hielo', 'Paladín de Escarcha', 4, 4, 5, '🛡️', ['escudo', 'helada']),
    fusion('arcano', 'corona', 'Mago de Batalla', 3, 3, 3, '⚡', ['escudo'], [dano(2, 'elegir')]),
    fusion('corona', 'fuego', 'Jinete de Dragón', 4, 5, 4, '🐎', ['veloz', 'escudo']),
    fusion('arcano', 'hielo', 'Hechicera del Cristal Eterno', 4, 3, 5, '💎', [], [congelar('todos'), robar(1)]),
    fusion('fuego', 'hielo', 'Elemental de Vapor', 4, 4, 4, '♨️', [], [dano(3, 'elegirUnidad', true)]),
    fusion('arcano', 'fuego', 'Fénix Arcano', 4, 4, 3, '💫', ['veloz'], [dano(3, 'elegir')]),
  ];

  const FUSIONES = Object.freeze(LISTA_FUSIONES.reduce((acc, c) => ({ ...acc, [claveFusion(c.reino, c.reino2 || c.reino)]: c }), {}));

  const porId = Object.freeze([...CARTAS, ...FICHAS, ...LISTA_FUSIONES].reduce((acc, c) => ({ ...acc, [c.id]: c }), {}));

  function fusionDe(reinoA, reinoB) {
    const carta = FUSIONES[claveFusion(reinoA, reinoB)];
    if (!carta) throw new Error(`No hay fusión para ${reinoA} + ${reinoB}`);
    return carta;
  }

  // ---- Texto de reglas generado a partir de los datos -----------------------
  const OBJ_TEXTO = {
    elegir: 'a un enemigo', elegirUnidad: 'a una unidad enemiga', heroe: 'al héroe enemigo',
    todos: 'a todas las unidades enemigas', todosYHeroe: 'a todos los enemigos', azar: 'a una unidad enemiga al azar',
  };

  function textoEfecto(e, esHechizo) {
    switch (e.t) {
      case 'dano': {
        const plural = e.obj === 'todos' || e.obj === 'todosYHeroe';
        const extra = e.congela ? (plural ? ' y las congela' : ' y la congela') : '';
        return `Inflige ${e.n} de daño ${OBJ_TEXTO[e.obj]}${extra}.`;
      }
      case 'congelar': return e.obj === 'todos' ? 'Congela a todas las unidades enemigas.' : 'Congela a una unidad enemiga.';
      case 'curar': return `Cura ${e.n} a tu héroe.`;
      case 'robar': return e.n === 1 ? 'Robá 1 carta.' : `Robá ${e.n} cartas.`;
      case 'buff':
        if (e.obj === 'aliados') return `${esHechizo ? 'Tus unidades' : 'Tus otras unidades'} ganan +${e.atq}/+${e.vida}.`;
        return `Da +${e.atq}/+${e.vida} a una unidad aliada.`;
      case 'invocar': {
        const f = porId[e.id];
        return e.n === 1 ? `Invoca un ${f.nombre} (${f.atq}/${f.vida}).` : `Invoca ${e.n} ${f.nombre}s (${f.atq}/${f.vida}).`;
      }
      case 'mana': return `Ganás ${e.n} de maná este turno.`;
      case 'destruir': return 'Destruye una unidad enemiga.';
      default: return '';
    }
  }

  function textoCarta(c) {
    const partes = [];
    if (c.claves.length) partes.push(c.claves.map((k) => `<b>${CLAVES[k].nombre}</b>`).join(', ') + '.');
    if (c.efectos.length) {
      const t = c.efectos.map((e) => textoEfecto(e, c.tipo === 'hechizo')).join(' ');
      partes.push(c.tipo === 'unidad' ? `<i>Al jugar:</i> ${t}` : t);
    }
    return partes.join(' ') || '<i>Leal a su reino hasta el final.</i>';
  }

  const Datos = Object.freeze({ REINOS, CLAVES, RAREZAS, ORDEN_RAREZAS, CARTAS, FICHAS, FUSIONES, porId, fusionDe, claveFusion, textoCarta });

  if (typeof module !== 'undefined' && module.exports) module.exports = Datos;
  else raiz.Datos = Datos;
})(this);
