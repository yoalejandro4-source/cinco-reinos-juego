/* Controlador de la economía: perfil guardado, tienda, apertura de sobres,
 * colección, armado de mazo, perfil y premios al terminar cada partida. */
(function (raiz) {
  'use strict';
  const { Economia: E, UI, Render: R, RenderEconomia: RE, Fx, Datos: D } = raiz;
  const LEYENDA = Object.freeze({ bosque: 'b8', corona: 'c8', hielo: 'h8', arcano: 'a8', fuego: 'f8' });
  const SONIDO_RAREZA = Object.freeze({ comun: 'voltear', rara: 'escudo', epica: 'curar', mitica: 'fusion', legendaria: 'victoria' });
  const PAUSA_VOLTEO_MS = 260;
  const RASGAR_MS = 1150;
  const ANTICIPACION_MS = Object.freeze({ epica: 550, mitica: 800, legendaria: 1100 });
  const ORDEN = D.ORDEN_RAREZAS || ['comun', 'rara', 'epica', 'mitica', 'legendaria'];
  const mejorRareza = (a) => a.cartas.map((c) => D.porId[c.id].rareza)
    .reduce((m, r) => (ORDEN.indexOf(r) > ORDEN.indexOf(m) ? r : m), 'comun');

  const almacen = (() => {
    try { return raiz.localStorage; } catch (e) { return null; }
  })();
  let perfil = E.cargar(almacen);
  const st = { reinoSobre: 'fuego', mazoTab: 'fuego', apertura: null, ultimoSobre: null };

  const avisarGuardado = []; // otros módulos (la cuenta) se enteran de cada guardado

  function guardarPerfil(nuevo, opciones) {
    perfil = raiz.Mazos ? raiz.Mazos.alDia(nuevo) : nuevo; // el mazo activo queda guardado en su espacio
    UI.nombreJugador = perfil.nombre;
    if (raiz.Tienda) R.ponerApariencia(0, raiz.Tienda.apariencia(perfil));
    if (!almacen || !E.guardar(almacen, perfil)) Fx.aviso('⚠️ No se pudo guardar el progreso en este dispositivo');
    if (!(opciones && opciones.sinAvisar)) avisarGuardado.forEach((fn) => fn(perfil));
  }

  /** Cambia todo el perfil (por ejemplo, el que viene de la cuenta en el servidor). */
  function reemplazarPerfil(nuevo, opciones) {
    const normalizado = E.cargar({ getItem: () => JSON.stringify(nuevo) });
    guardarPerfil(normalizado, opciones);
    UI.render();
    return normalizado;
  }

  /** Aplica el resultado de una operación de la economía; muestra el error si falló. */
  function aplicar(res, mensaje) {
    if (!res.ok) { Fx.aviso(res.error); return false; }
    guardarPerfil(res.perfil);
    if (mensaje) Fx.aviso(mensaje);
    UI.render();
    return true;
  }

  // ---- Apertura de sobres (capa propia, fuera de #app) ---------------------------------
  function capaApertura() {
    let capa = document.getElementById('capa-apertura');
    if (!capa) {
      capa = document.createElement('div');
      capa.id = 'capa-apertura';
      document.body.appendChild(capa);
      capa.addEventListener('click', (e) => {
        const el = e.target.closest('[data-accion]');
        if (el && accionesApertura[el.dataset.accion]) accionesApertura[el.dataset.accion](el);
      });
    }
    return capa;
  }

  function dibujarApertura() {
    const capa = capaApertura();
    if (!st.apertura) { capa.innerHTML = ''; capa.classList.remove('visible'); return; }
    st.apertura.puedeOtro = E.alcanza(perfil, E.SOBRES[st.apertura.sobre].precio);
    capa.innerHTML = RE.apertura(st.apertura);
    capa.classList.add('visible');
    // La entrada de las cartas se anima una sola vez, no en cada redibujo.
    st.apertura.entrando = false;
  }

  function arteSobre(tipo) {
    if (tipo === 'reino') return `arte/${LEYENDA[st.reinoSobre]}.webp`;
    return tipo === 'epico' ? 'arte/a8.webp' : 'arte/c8.webp';
  }

  function comprarSobre(tipo) {
    const res = E.comprarSobre(perfil, tipo, st.reinoSobre);
    if (!res.ok) { Fx.aviso(res.error); return; }
    guardarPerfil(res.perfil);
    st.ultimoSobre = tipo;
    const dorso = raiz.Tienda ? raiz.Tienda.apariencia(perfil).dorso : 'clasico';
    st.apertura = { sobre: tipo, arte: arteSobre(tipo), cartas: res.cartas, abierto: false, volteadas: [], dorso };
    UI.sonar('monedas');
    dibujarApertura();
    UI.render();
  }

  /** Da vuelta una carta del sobre; si es épica o mejor, primero va la escena de revelación. */
  async function voltear(i) {
    const a = st.apertura;
    if (!a || a.volteadas.includes(i) || a.revelando) return;
    const def = D.porId[a.cartas[i].id];
    UI.sonar(SONIDO_RAREZA[def.rareza]);
    if (raiz.Cine && raiz.Cine.REVELACION[def.rareza]) {
      a.revelando = true;
      // Anticipación: el dorso tiembla y se le escapa luz antes de la gran revelación
      const dorso = document.querySelector(`#capa-apertura .ap-dorso[data-i="${i}"]`);
      if (dorso) dorso.classList.add('cargando');
      UI.sonar('carga');
      await Fx.espera(ANTICIPACION_MS[def.rareza] || 0);
      if (st.apertura !== a) { a.revelando = false; return; }
      await raiz.Cine.revelar({ carta: R.htmlCarta(def), rareza: def.rareza, nombre: def.nombre });
      a.revelando = false;
      if (st.apertura !== a) return;
    }
    a.volteadas = [...a.volteadas, i];
    a.ultima = i;
    dibujarApertura();
  }

  const accionesApertura = {
    'abrir-sobre': async () => {
      const a = st.apertura;
      if (!a || a.rasgando) return;
      // El sobre se sacude, se raja con luz del color de la mejor carta y explota.
      a.rasgando = true;
      const capa = document.querySelector('#capa-apertura .apertura');
      if (capa) capa.classList.add('rasgando', `mejor-${mejorRareza(a)}`);
      UI.sonar('sobre');
      await Fx.espera(RASGAR_MS);
      if (st.apertura !== a) return;
      UI.sonar('fusion');
      a.abierto = true;
      a.entrando = true;
      dibujarApertura();
    },
    voltear: (el) => voltear(Number(el.dataset.i)),
    'voltear-todas': async () => {
      const a = st.apertura;
      if (!a) return;
      for (let i = 0; i < a.cartas.length; i++) {
        if (st.apertura !== a) return;
        if (!a.volteadas.includes(i)) { await voltear(i); await Fx.espera(PAUSA_VOLTEO_MS); }
      }
    },
    'cerrar-apertura': () => { UI.sonar('click'); st.apertura = null; dibujarApertura(); UI.render(); },
    'otro-sobre': () => { const tipo = st.ultimoSobre; st.apertura = null; comprarSobre(tipo); },
  };

  // ---- Pantallas y acciones ----------------------------------------------------------------
  function jugarConMiMazo() {
    const v = E.validarMazo(perfil);
    if (!v.ok) { Fx.aviso(v.errores[0]); return; }
    const reinos = v.reinos.length >= 2 ? v.reinos.slice(0, 2) : [v.reinos[0], Object.keys(D.REINOS).find((r) => r !== v.reinos[0])];
    UI.empezarPartida(reinos, perfil.mazo);
  }

  UI.agregar({
    vistas: {
      inicio: () => R.pantallaInicio() + RE.barraPerfil(perfil),
      elegir: () => R.pantallaElegir(UI.estado.elegidos, RE.panelMiMazo(perfil, E.validarMazo(perfil))),
      coleccion: () => RE.pantallaColeccion(UI.estado.tab, perfil),
      tienda: () => RE.pantallaTienda(perfil, st.reinoSobre, raiz.Tienda ? raiz.Tienda.html(perfil) : ''),
      mazo: () => RE.pantallaMazo(perfil, st.mazoTab, E.validarMazo(perfil)),
      perfil: () => RE.pantallaPerfil(perfil, raiz.Tienda ? raiz.Tienda.htmlPerfil(perfil) : ''),
    },
    acciones: {
      'comprar-sobre': (el) => comprarSobre(el.dataset.sobre),
      'sobre-reino': (el) => { st.reinoSobre = el.dataset.reino; UI.render(); },
      fabricar: (el) => {
        const c = D.porId[el.dataset.id];
        if (aplicar(E.fabricar(perfil, el.dataset.id), `✨ Fabricaste ${c.nombre}`)) UI.sonar('fusion');
      },
      'mazo-tab': (el) => { st.mazoTab = el.dataset.tab; UI.render(); },
      'mazo-agregar': (el) => aplicar(E.agregarAlMazo(perfil, el.dataset.id)),
      'mazo-quitar': (el) => aplicar(E.quitarDelMazo(perfil, el.dataset.id)),
      'mazo-vaciar': () => aplicar(E.vaciarMazo(perfil), 'Mazo vacío'),
      'mazo-auto': () => aplicar(E.autocompletarMazo(perfil), 'Mazo completado'),
      'jugar-mazo': jugarConMiMazo,
      'mazo-elegir': (el) => { if (aplicar(raiz.Mazos.elegir(perfil, Number(el.dataset.i)))) { UI.sonar('carta'); UI.render(); } },
      'mazo-comprar-espacio': () => {
        const r = raiz.Mazos.comprarEspacio(perfil);
        if (aplicar(r, `✔ Nuevo espacio de mazo (-${r.precio || 0} 💰)`)) { UI.sonar('monedas'); UI.render(); }
      },
      'mazo-renombrar': () => {
        const nombre = (document.getElementById('mz-nombre') || {}).value || '';
        if (aplicar(raiz.Mazos.renombrar(perfil, perfil.mazoActivo || 0, nombre), '✔ Nombre guardado')) UI.render();
      },
      'comprar-cosmetico': (el) => {
        const c = raiz.Tienda.porId[el.dataset.id];
        if (aplicar(raiz.Tienda.comprar(perfil, el.dataset.id), `✔ Compraste ${c.nombre}`)) { UI.sonar('monedas'); UI.sonar('buff'); }
      },
      equipar: (el) => aplicar(raiz.Tienda.equipar(perfil, el.dataset.id), '✔ Equipado'),
      'guardar-nombre': () => {
        const campo = document.getElementById('pf-nombre');
        aplicar(E.cambiarNombre(perfil, campo ? campo.value : ''), '✔ Nombre guardado');
      },
    },
  });

  // Premios al terminar una partida
  UI.alTerminar = (gano) => {
    const r = E.registrarPartida(perfil, gano);
    guardarPerfil(r.perfil);
    return r.premio;
  };

  /** Acceso para otros módulos (la tienda de cosméticos). */
  raiz.Perfil = Object.freeze({
    actual: () => perfil,
    aplicar,
    guardar: guardarPerfil,
    reemplazar: reemplazarPerfil,
    nuevo: () => E.perfilNuevo(),
    alGuardar: (fn) => avisarGuardado.push(fn),
  });

  UI.nombreJugador = perfil.nombre;
  if (raiz.Tienda) R.ponerApariencia(0, raiz.Tienda.apariencia(perfil));
  UI.render();
})(this);
