/* HTML de las pantallas de la economía: barra de perfil, tienda de sobres,
 * apertura de sobres, colección con fabricación, armado de mazo y perfil. */
(function (raiz) {
  'use strict';
  const D = raiz.Datos;
  const E = raiz.Economia;
  const R = raiz.Render;

  const ICONO_RAREZA = Object.freeze({ comun: '⚪', rara: '🔷', epica: '🟣', mitica: '🔴', legendaria: '🌟' });
  const LEYENDA = Object.freeze({ bosque: 'b8', corona: 'c8', hielo: 'h8', arcano: 'a8', fuego: 'f8' });
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const estiloReino = (id) => { const r = D.REINOS[id]; return `--c1:${r.c1};--c2:${r.c2};--c3:${r.c3}`; };
  const totalColeccion = (p) => D.CARTAS.filter((c) => (p.coleccion[c.id] || 0) > 0).length;

  function monedas(p) {
    return `<div class="monedas">
      <span class="moneda oro" title="Oro">💰 <b>${p.oro}</b></span>
      <span class="moneda gemas" title="Gemas">💎 <b>${p.gemas}</b></span>
      <span class="moneda esencia" title="Esencia (de cartas repetidas)">✨ <b>${p.esencia}</b></span>
    </div>`;
  }

  function encabezado(titulo, p) {
    return `<div class="barra-sup eco-sup">
      <button class="volver" data-accion="ir" data-destino="inicio">← Volver</button>
      <h2 class="titulo-2">${titulo}</h2>${monedas(p)}
    </div>`;
  }

  // ---- Portada: barra con perfil, monedas y accesos -----------------------------------
  const ap = (p) => (raiz.Tienda ? raiz.Tienda.apariencia(p) : {});
  function avatarHtml(p, clase) {
    const a = ap(p);
    const marco = a.marco ? `marco-${a.marco}` : '';
    return a.avatar ? `<span class="${clase} ${marco} con-img"><img src="arte/${a.avatar}.webp" alt=""></span>` : `<span class="${clase} ${marco}">⚔️</span>`;
  }

  function barraPerfil(p) {
    const titulo = ap(p).titulo;
    return `<div class="barra-perfil">
      <button class="bp-jugador" data-accion="ir" data-destino="perfil" title="Tu perfil">
        ${avatarHtml(p, 'bp-avatar')}<span class="bp-texto"><span class="bp-nombre">${esc(p.nombre)}</span>${titulo ? `<span class="bp-titulo">${esc(titulo)}</span>` : ''}</span>
      </button>
      ${monedas(p)}
      <nav class="bp-menu">
        <button class="bp-boton tienda" data-accion="ir" data-destino="tienda">🛒 Tienda</button>
        <button class="bp-boton mazo" data-accion="ir" data-destino="mazo">🃏 Mi mazo</button>
        <button class="bp-boton aventura" data-accion="ir" data-destino="aventura">🗺️ Aventura</button>
        <button class="bp-boton online" data-accion="ir" data-destino="online">🏟️ Online</button>
      </nav>
    </div>`;
  }

  // ---- Elegir: jugar con el mazo propio ---------------------------------------------------
  function panelMiMazo(p, validacion) {
    const reinos = validacion.reinos.map((r) => `<span class="chip" style="${estiloReino(r)}">${D.REINOS[r].icono} ${D.REINOS[r].corto}</span>`).join('');
    const estado = validacion.ok
      ? '<span class="mm-ok">✔ Listo para jugar</span>'
      : `<span class="mm-falta">${esc(validacion.errores[0] || '')}</span>`;
    return `<div class="panel-mi-mazo">
      <div class="mm-info"><div class="mm-titulo">🃏 Tu mazo</div><div class="mm-reinos">${reinos}</div>${estado}</div>
      <div class="mm-botones">
        <button class="boton" data-accion="jugar-mazo" ${validacion.ok ? '' : 'disabled'}>⚔️ Jugar con mi mazo</button>
        <button class="boton secundario boton-chico" data-accion="ir" data-destino="mazo">Editar mazo</button>
      </div>
    </div>`;
  }

  // ---- Tienda -----------------------------------------------------------------------------
  function precioTexto(precio) {
    return precio.gemas ? `💎 ${precio.gemas}` : `💰 ${precio.oro}`;
  }

  function htmlSobre(p, sobre, arte, extra) {
    const puede = E.alcanza(p, sobre.precio);
    const garantia = sobre.garantia === 'epica' ? '1 épica o mejor garantizada' : '1 poco común o mejor garantizada';
    return `<div class="sobre sobre-${sobre.id}">
      <div class="sobre-arte" style="background-image:url('${arte}')"><div class="sobre-brillo"></div>
        <div class="sobre-sello">${sobre.id === 'epico' ? '💎' : '⚔️'}</div><div class="sobre-nombre">${sobre.nombre}</div></div>
      <div class="sobre-info"><b>${sobre.cartas} cartas</b><span>${garantia}</span>${extra || ''}</div>
      <button class="boton boton-comprar" data-accion="comprar-sobre" data-sobre="${sobre.id}" ${puede ? '' : 'disabled'}>${precioTexto(sobre.precio)}</button>
    </div>`;
  }

  function pantallaTienda(p, reinoSobre, extraTienda) {
    const S = E.SOBRES;
    const chips = Object.values(D.REINOS).map((r) => `<button class="chip chip-reino ${r.id === reinoSobre ? 'activo' : ''}" style="${estiloReino(r.id)}" data-accion="sobre-reino" data-reino="${r.id}">${r.icono}</button>`).join('');
    const sobres = [
      htmlSobre(p, S.reinos, 'arte/c8.webp'),
      htmlSobre(p, S.reino, `arte/${LEYENDA[reinoSobre]}.webp`, `<div class="sobre-reinos">${chips}</div>`),
      htmlSobre(p, S.epico, 'arte/a8.webp'),
    ].join('');
    return `<div class="pantalla tienda">
      ${encabezado('Tienda', p)}
      <h3 class="tienda-seccion">📦 Sobres</h3>
      <div class="sobres">${sobres}</div>
      <p class="tienda-nota">Las cartas repetidas de más se convierten en ✨ esencia, que sirve para fabricar la carta que quieras en la Colección.</p>
      ${extraTienda || ''}
    </div>`;
  }

  // ---- Apertura de sobre ---------------------------------------------------------------------
  function apertura(a) {
    if (!a.abierto) {
      return `<div class="apertura cerrado" data-accion="abrir-sobre">
        <div class="ap-rayos"></div>
        <div class="ap-sobre sobre-${a.sobre}"><div class="sobre-arte" style="background-image:url('${a.arte}')"><div class="sobre-brillo"></div>
          <div class="sobre-sello">${a.sobre === 'epico' ? '💎' : '⚔️'}</div><div class="sobre-nombre">${E.SOBRES[a.sobre].nombre}</div></div></div>
        <p class="ap-ayuda">Tocá el sobre para abrirlo</p>
      </div>`;
    }
    const cartas = a.cartas.map((c, i) => {
      const def = D.porId[c.id];
      if (!a.volteadas.includes(i)) {
        return `<div class="ap-slot" style="--i:${i}"><div class="ap-dorso dorso-carta dorso-${a.dorso || 'clasico'} rareza-${def.rareza}" data-accion="voltear" data-i="${i}"><span>?</span></div></div>`;
      }
      const marca = c.nueva ? '<span class="ap-marca nueva">¡NUEVA!</span>' : (c.esencia ? `<span class="ap-marca esencia">+${c.esencia} ✨</span>` : '');
      return `<div class="ap-slot revelada rareza-${def.rareza} ${a.ultima === i ? 'recien' : ''}" style="--i:${i}">${R.htmlCarta(def)}${marca}</div>`;
    }).join('');
    const todas = a.volteadas.length === a.cartas.length;
    return `<div class="apertura abierto">
      <div class="ap-rayos"></div>
      <div class="ap-cartas ${a.entrando ? 'entra' : ''}">${cartas}</div>
      <div class="ap-botones">
        ${todas ? '' : '<button class="boton secundario" data-accion="voltear-todas">Dar vuelta todas</button>'}
        ${todas ? '<button class="boton" data-accion="cerrar-apertura">Continuar</button>' : ''}
        ${todas && a.puedeOtro ? '<button class="boton secundario" data-accion="otro-sobre">Abrir otro</button>' : ''}
      </div>
    </div>`;
  }

  // ---- Colección con fabricación -----------------------------------------------------------------
  function cartaColeccion(c, p) {
    const tengo = p.coleccion[c.id] || 0;
    const max = E.maxCopias(c.id);
    const costo = E.costoFabricar(c.id);
    const puedeFabricar = tengo < max && p.esencia >= costo;
    return `<div class="col-carta ${tengo ? '' : 'no-tengo'}">
      ${R.htmlCarta(c)}
      <div class="col-cantidad">${tengo}/${max}</div>
      ${tengo < max ? `<button class="boton boton-chico boton-fabricar" data-accion="fabricar" data-id="${c.id}" ${puedeFabricar ? '' : 'disabled'}>Fabricar ✨${costo}</button>` : ''}
    </div>`;
  }

  function pantallaColeccion(tab, p) {
    const tabs = Object.values(D.REINOS)
      .map((r) => `<button class="tab ${tab === r.id ? 'activa' : ''}" style="${estiloReino(r.id)}" data-accion="tab" data-tab="${r.id}">${r.icono} ${r.corto}</button>`)
      .join('') + `<button class="tab tab-fusion ${tab === 'fusion' ? 'activa' : ''}" data-accion="tab" data-tab="fusion">⚗️ Fusiones</button>`;
    let contenido;
    if (tab === 'fusion') {
      contenido = Object.entries(D.FUSIONES).map(([clave, c]) => {
        const [a, b] = clave.split('+');
        return `<div class="receta"><div class="receta-formula"><span class="chip" style="${estiloReino(a)}">${D.REINOS[a].icono} Común</span> <b>+</b> <span class="chip" style="${estiloReino(b)}">${D.REINOS[b].icono} Común</span></div>${R.htmlCarta(c)}</div>`;
      }).join('');
    } else {
      contenido = D.CARTAS.filter((c) => c.reino === tab).map((c) => cartaColeccion(c, p)).join('');
    }
    return `<div class="pantalla coleccion">
      ${encabezado('Colección', p)}
      <div class="tabs">${tabs}</div>
      <p class="lema-tab">Tenés <b>${totalColeccion(p)}</b> de <b>${D.CARTAS.length}</b> cartas. Las que te faltan salen en sobres o se fabrican con ✨ esencia.</p>
      <div class="grilla">${contenido}</div>
    </div>`;
  }

  // ---- Armado de mazo -------------------------------------------------------------------------------
  function filaMazo(id, n) {
    const c = D.porId[id];
    return `<button class="mazo-fila rareza-${c.rareza}" style="${estiloReino(c.reino)}" data-accion="mazo-quitar" data-id="${id}" title="Quitar">
      <span class="mf-costo">${c.costo}</span><span class="mf-icono">${ICONO_RAREZA[c.rareza]}</span>
      <span class="mf-nombre">${c.nombre}</span><span class="mf-cant">×${n}</span>
    </button>`;
  }

  /** Fila de mazos guardados: elegir, renombrar y comprar más espacios. */
  function selectorMazos(p) {
    if (!raiz.Mazos) return '';
    const Mz = raiz.Mazos;
    const datos = Mz.alDia(p);
    const botones = datos.mazos.map((m, i) => {
      const listo = E.validarMazo({ ...p, mazo: m.cartas }).ok;
      return `<button class="mz-slot ${i === datos.mazoActivo ? 'activo' : ''}" data-accion="mazo-elegir" data-i="${i}">
        <b>${esc(m.nombre)}</b><small>${m.cartas.length}/${E.REGLAS.tamanoMazo} ${listo ? '✔' : ''}</small></button>`;
    }).join('');
    const precio = Mz.precioSiguiente(p);
    const comprar = precio ? `<button class="mz-slot comprar" data-accion="mazo-comprar-espacio"><b>➕ Nuevo mazo</b><small>${precio} 💰</small></button>` : '';
    const activo = datos.mazos[datos.mazoActivo];
    return `<div class="mz-selector">${botones}${comprar}</div>
      <div class="mz-nombre"><input id="mz-nombre" type="text" maxlength="${Mz.REGLAS.largoNombre}" value="${esc(activo.nombre)}" aria-label="Nombre del mazo">
        <button class="boton boton-chico secundario" data-accion="mazo-renombrar">✏️ Guardar nombre</button></div>`;
  }

  function pantallaMazo(p, tab, validacion) {
    const enMazo = p.mazo.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
    const tabs = Object.values(D.REINOS)
      .map((r) => `<button class="tab ${tab === r.id ? 'activa' : ''}" style="${estiloReino(r.id)}" data-accion="mazo-tab" data-tab="${r.id}">${r.icono}</button>`).join('');
    const disponibles = D.CARTAS.filter((c) => c.reino === tab && (p.coleccion[c.id] || 0) > 0).map((c) => {
      const usadas = enMazo[c.id] || 0;
      const tope = Math.min(p.coleccion[c.id], E.maxCopias(c.id));
      return `<div class="mz-carta ${usadas >= tope ? 'agotada' : ''}" data-accion="mazo-agregar" data-id="${c.id}">
        ${R.htmlCarta(c)}<span class="mz-uso">${usadas}/${tope}</span></div>`;
    }).join('') || '<p class="mz-vacio">No tenés cartas de este reino todavía.</p>';
    const filas = Object.entries(enMazo)
      .sort(([a], [b]) => D.porId[a].costo - D.porId[b].costo || D.porId[a].nombre.localeCompare(D.porId[b].nombre))
      .map(([id, n]) => filaMazo(id, n)).join('') || '<p class="mz-vacio">Tocá cartas de la izquierda para sumarlas.</p>';
    const reinos = validacion.reinos.map((r) => `<span class="chip" style="${estiloReino(r)}">${D.REINOS[r].icono} ${D.REINOS[r].corto}</span>`).join('');
    const estado = validacion.ok ? '<div class="mm-ok">✔ Mazo listo para jugar</div>'
      : `<ul class="mz-errores">${validacion.errores.slice(0, 3).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    return `<div class="pantalla armado">
      ${encabezado('Mis mazos', p)}
      ${selectorMazos(p)}
      <div class="armado-cuerpo">
        <section class="armado-coleccion">
          <div class="tabs">${tabs}</div>
          <div class="mz-grilla">${disponibles}</div>
        </section>
        <aside class="armado-lista">
          <div class="mz-cabeza"><b>${p.mazo.length}/${E.REGLAS.tamanoMazo}</b> cartas <div class="mm-reinos">${reinos}</div></div>
          ${estado}
          <div class="mz-filas">${filas}</div>
          <div class="mz-botones">
            <button class="boton boton-chico" data-accion="mazo-auto">Autocompletar</button>
            <button class="boton secundario boton-chico" data-accion="mazo-vaciar">Vaciar</button>
          </div>
        </aside>
      </div>
    </div>`;
  }

  // ---- Perfil ---------------------------------------------------------------------------------------
  function pantallaPerfil(p, extraPerfil) {
    const e = p.estadisticas;
    const jugadas = e.victorias + e.derrotas;
    const porcentaje = jugadas ? Math.round((e.victorias / jugadas) * 100) : 0;
    const datos = [
      ['Victorias', e.victorias], ['Derrotas', e.derrotas], ['% de victorias', `${porcentaje}%`],
      ['Racha actual', e.racha], ['Sobres abiertos', e.sobresAbiertos], ['Colección', `${totalColeccion(p)}/${D.CARTAS.length}`],
    ].map(([t, v]) => `<div class="pf-dato"><b>${v}</b><span>${t}</span></div>`).join('');
    return `<div class="pantalla perfil">
      ${encabezado('Perfil', p)}
      <div class="pf-tarjeta">
        ${avatarHtml(p, 'pf-avatar')}
        <div class="pf-nombre-form">
          <label for="pf-nombre">Tu nombre</label>
          <div class="pf-fila"><input id="pf-nombre" maxlength="18" value="${esc(p.nombre)}" autocomplete="off">
          <button class="boton boton-chico" data-accion="guardar-nombre">Guardar</button></div>
        </div>
      </div>
      <div class="pf-datos">${datos}</div>
      ${extraPerfil || ''}
    </div>`;
  }

  raiz.RenderEconomia = Object.freeze({ barraPerfil, monedas, panelMiMazo, pantallaTienda, apertura, pantallaColeccion, pantallaMazo, pantallaPerfil });
})(this);
