/* Diálogos del Modo Aventura. Se pueden cambiar libremente: cada línea es
 *   [quien, texto]   con quien = 'rival' | 'narrador' | 'heroe'
 * Para cada combate (reino + número de etapa) hay:
 *   intro     → antes de pelear
 *   victoria  → cuando le ganás
 *   derrota   → cuando te gana
 * Voces: si existe el archivo audio/voces/<id>.webm se reproduce con la línea.
 * El id de cada línea es reino-etapa-momento-número (ej.: bosque-0-intro-1).
 * La herramienta tools/grabar-voces.html lista todas las líneas para grabarlas. */
(function (raiz) {
  'use strict';
  const esNode = typeof module !== 'undefined' && module.exports;

  const GUION = {
    bosque: [
      {
        intro: [
          ['narrador', 'El Bosque Susurrante. Las ramas crujen aunque no sopla el viento.'],
          ['rival', '¡Alto ahí, forastero! Nadie pisa mi musgo sin pedir permiso.'],
          ['rival', 'Si querés pasar, vas a tener que ganarme… ¡y te aviso que curo rapidísimo!'],
        ],
        victoria: [['rival', 'Uf… está bien, está bien. Pasá. Pero cuidá los hongos, ¿eh?']],
        derrota: [['rival', '¡Jaja! Volvé cuando tus cartas tengan raíces más fuertes.']],
      },
      {
        intro: [
          ['narrador', 'En un claro iluminado por la luna, un druida te está esperando.'],
          ['rival', 'Las estrellas me avisaron de tu llegada.'],
          ['rival', 'El bosque es uno solo, y cuando uno de nosotros pelea, peleamos todos.'],
        ],
        victoria: [['rival', 'Tenés la fuerza de un roble viejo. La Reina querrá verte.']],
        derrota: [['rival', 'Todavía no escuchás lo que dice el bosque. Volvé a intentarlo.']],
      },
      {
        intro: [
          ['narrador', 'Las raíces se abren y aparece la soberana del bosque.'],
          ['rival', 'Soy Sylvara, y este bosque respira conmigo.'],
          ['rival', 'Cada hoja que caiga, vuelve a crecer. ¿Podrás vencer a la vida misma?'],
        ],
        victoria: [['rival', 'Imposible… El bosque se inclina ante vos, conquistador.']],
        derrota: [['rival', 'Las hojas caen, las hojas vuelven. Igual que vos, una y otra vez.']],
      },
    ],
    corona: [
      {
        intro: [
          ['narrador', 'Las murallas de Altaroca se alzan frente a vos. Suenan las trompetas.'],
          ['rival', '¡Por orden del Rey, nadie cruza estas puertas!'],
          ['rival', '¡Guardia, en formación! Que no pase ni una mosca.'],
        ],
        victoria: [['rival', 'La guardia… cayó. El Rey no va a estar contento.']],
        derrota: [['rival', '¡Ja! La muralla sigue en pie. ¡Larga vida al Rey!']],
      },
      {
        intro: [
          ['narrador', 'En el patio del castillo brilla una armadura de oro.'],
          ['rival', 'Juré proteger la corona con mi escudo y mi espada.'],
          ['rival', 'Pelearé con honor. Espero lo mismo de vos.'],
        ],
        victoria: [['rival', 'Peleaste con honor. Ve… el Rey te espera en el trono.']],
        derrota: [['rival', 'Mi escudo resistió. Entrená más y volvé, guerrero.']],
      },
      {
        intro: [
          ['narrador', 'La sala del trono. El Rey Aldric se pone de pie.'],
          ['rival', 'Nunca perdí una batalla. Por algo me dicen el Invicto.'],
          ['rival', '¡Soldados, a mi lado! Hoy la corona demuestra por qué manda.'],
        ],
        victoria: [['rival', '¿Invicto…? Ya no. Tomá mi respeto, y mi reino te abre las puertas.']],
        derrota: [['rival', '¡Invicto, como siempre! Arrodillate y volvé a intentarlo mañana.']],
      },
    ],
    hielo: [
      {
        intro: [
          ['narrador', 'El Glaciar Eterno. El viento helado corta como cuchillo.'],
          ['rival', '¡BRRRUUUUMMM!'],
          ['narrador', 'Un mamut gigante bloquea el único paso entre el hielo.'],
        ],
        victoria: [['narrador', 'El mamut se aparta con un bramido y el camino queda libre.']],
        derrota: [['narrador', 'El mamut no se mueve ni un paso. La tormenta te obliga a retroceder.']],
      },
      {
        intro: [
          ['narrador', 'Una sombra enorme cubre el cielo. Cae escarcha del aire.'],
          ['rival', 'Hace mil años que nadie llega tan lejos.'],
          ['rival', 'Mi aliento congela ejércitos enteros. ¿Qué te hace pensar que vos sos distinto?'],
        ],
        victoria: [['rival', 'Tu fuego interior… derritió mi hielo. Pasá, si te animás a ver a Ymir.']],
        derrota: [['rival', 'Otra estatua de hielo para mi colección.']],
      },
      {
        intro: [
          ['narrador', 'En el corazón de la tormenta, una mujer de cristal te mira sin pestañear.'],
          ['rival', 'Soy Ymir, la que nunca se derrite.'],
          ['rival', 'El invierno no perdona… y yo tampoco.'],
        ],
        victoria: [['rival', 'Por primera vez… siento calor. Vencí al invierno y el invierno me venció a mí.']],
        derrota: [['rival', 'Quedate. El frío es eterno, y vos también lo serás.']],
      },
    ],
    arcano: [
      {
        intro: [
          ['narrador', 'La Torre de las Estrellas flota sobre el abismo. Los cristales zumban.'],
          ['rival', 'Ya vi esta pelea en mis cristales.'],
          ['rival', 'Spoiler: perdés. ¿Igual querés intentarlo?'],
        ],
        victoria: [['rival', '¡¿Qué?! Mis cristales nunca se equivocan… Tengo que recalibrarlos.']],
        derrota: [['rival', 'Te lo dije. Los cristales nunca mienten.']],
      },
      {
        intro: [
          ['narrador', 'Libros que vuelan, runas que arden. El archimago levanta su bastón.'],
          ['rival', 'Leí todos los libros de esta torre. Dos veces.'],
          ['rival', 'Conozco cada carta que podés jugar antes de que la toques.'],
        ],
        victoria: [['rival', 'Esto no estaba en ningún libro… Interesante. Muy interesante.']],
        derrota: [['rival', 'Previsible. Estudiá un poco más y volvé.']],
      },
      {
        intro: [
          ['narrador', 'La cima de la torre. Las estrellas se apagan una por una.'],
          ['rival', 'Devoré galaxias enteras antes de que existiera tu reino.'],
          ['rival', 'Soy Nyx. Y vos sos solo otra estrella a punto de apagarse.'],
        ],
        victoria: [['rival', 'La luz… vuelve. No puede ser. Una estrella me apagó a mí.']],
        derrota: [['rival', 'Una luz menos en el cielo. Qué hermoso silencio.']],
      },
    ],
    fuego: [
      {
        intro: [
          ['narrador', 'El Volcán del Apocalipsis. El suelo quema bajo tus botas.'],
          ['rival', '¡JAJAJA! ¡Carne fresca para la lava!'],
          ['rival', '¡No pienso, no espero, solo ataco!'],
        ],
        victoria: [['rival', '¿Me… ganaste? ¡Eso estuvo BUENÍSIMO! ¡Otra vez!']],
        derrota: [['rival', '¡JAJA! ¡Muy lento! ¡Acá se pelea rápido!']],
      },
      {
        intro: [
          ['narrador', 'Del magma se levanta un gigante de roca ardiente.'],
          ['rival', 'Soy el muro de fuego que protege al dragón.'],
          ['rival', 'Para llegar a él vas a tener que atravesarme. Y nadie me atraviesa.'],
        ],
        victoria: [['rival', 'Me… enfrío… El dragón… despierta…']],
        derrota: [['rival', 'Ceniza. Eso es lo que queda de los que intentan pasar.']],
      },
      {
        intro: [
          ['narrador', 'El volcán ruge. Del cráter emerge el último enemigo.'],
          ['rival', 'Cinco reinos. Cuatro conquistados. Te falta uno: el mío.'],
          ['rival', 'Soy Ignis, el fin de todas las cosas. ¡Que arda el mundo!'],
        ],
        victoria: [
          ['rival', 'Imposible… El fuego… se apaga…'],
          ['narrador', 'Los cinco reinos se inclinan ante vos. La guerra terminó. Larga vida al nuevo soberano.'],
        ],
        derrota: [['rival', '¡Todo arde al final! ¡Volvé cuando seas digno de mis llamas!']],
      },
    ],
  };

  /** Líneas con su id (para la voz) de un momento de un combate. */
  function lineas(reino, etapa, momento) {
    const e = GUION[reino] && GUION[reino][etapa];
    const lista = (e && e[momento]) || [];
    return lista.map(([quien, texto], n) => ({ id: `${reino}-${etapa}-${momento}-${n + 1}`, quien, texto }));
  }

  /** Todas las líneas (para la herramienta de grabación). */
  function todas() {
    return Object.keys(GUION).flatMap((reino) => GUION[reino].flatMap((_, etapa) =>
      ['intro', 'victoria', 'derrota'].flatMap((momento) => lineas(reino, etapa, momento).map((l) => ({ ...l, reino, etapa, momento })))));
  }

  const Dialogos = Object.freeze({ GUION, lineas, todas });
  if (esNode) module.exports = Dialogos;
  else raiz.Dialogos = Dialogos;
})(this);
