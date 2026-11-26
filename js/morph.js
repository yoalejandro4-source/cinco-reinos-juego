/* Actualiza el DOM existente para que quede igual al HTML nuevo, cambiando solo lo
 * que hace falta (en vez de borrar y volver a crear todo). En el celular esto evita
 * volver a decodificar imágenes y repintar cartas que no cambiaron.
 * Los hijos con data-uid o data-clave se emparejan por esa clave (una unidad que
 * sale del medio de la mesa no hace que las demás cambien de imagen). */
(function (raiz) {
  'use strict';

  const claveDe = (n) => (n.nodeType === 1 ? (n.getAttribute('data-uid') || n.getAttribute('data-clave')) : null);

  function mismoTipo(a, b) {
    return a.nodeType === b.nodeType && a.nodeName === b.nodeName && claveDe(a) === claveDe(b);
  }

  function copiarAtributos(viejo, nuevo) {
    for (const a of [...viejo.attributes]) if (!nuevo.hasAttribute(a.name)) viejo.removeAttribute(a.name);
    for (const a of [...nuevo.attributes]) if (viejo.getAttribute(a.name) !== a.value) viejo.setAttribute(a.name, a.value);
  }

  function actualizarNodo(viejo, nuevo) {
    if (viejo.nodeType === 3 || viejo.nodeType === 8) {
      if (viejo.nodeValue !== nuevo.nodeValue) viejo.nodeValue = nuevo.nodeValue;
      return;
    }
    copiarAtributos(viejo, nuevo);
    actualizarHijos(viejo, nuevo);
  }

  function actualizarHijos(padre, modelo) {
    const viejos = [...padre.childNodes];
    const conClave = new Map();
    viejos.forEach((n) => { const k = claveDe(n); if (k) conClave.set(k, n); });
    const usados = new Set();
    let sinClave = viejos.filter((n) => !claveDe(n));
    const nuevos = [...modelo.childNodes];

    nuevos.forEach((nuevo, i) => {
      const k = claveDe(nuevo);
      let elegido = null;
      if (k && conClave.has(k) && !usados.has(conClave.get(k))) elegido = conClave.get(k);
      else if (!k) {
        const j = sinClave.findIndex((n) => !usados.has(n) && mismoTipo(n, nuevo));
        if (j >= 0) { elegido = sinClave[j]; sinClave = sinClave.slice(j + 1); }
      }
      const lugar = padre.childNodes[i] || null;
      if (elegido && mismoTipo(elegido, nuevo)) {
        usados.add(elegido);
        if (elegido !== lugar) padre.insertBefore(elegido, lugar);
        actualizarNodo(elegido, nuevo);
      } else {
        padre.insertBefore(nuevo.cloneNode(true), lugar);
      }
    });
    // Lo que sobró se va
    while (padre.childNodes.length > nuevos.length) padre.removeChild(padre.lastChild);
  }

  /** Deja `contenedor` con el contenido de `html` tocando lo mínimo. */
  function morfar(contenedor, html) {
    const modelo = document.createElement(contenedor.nodeName);
    modelo.innerHTML = html;
    actualizarHijos(contenedor, modelo);
  }

  raiz.Morph = Object.freeze({ morfar });
})(this);
