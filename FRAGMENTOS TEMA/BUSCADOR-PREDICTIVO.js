(function () {
    "use strict";

    const CONFIGURACION_PREDETERMINADA = {
        input: "#txtBuscar",
        tabla: "#tabla-dinamica table",
        filas: "tbody tr.item",
        enlaceVisor: ".llamar-visor",
        maximoSugerencias: 5,
    };

    const ID_ESTILOS = "estilos-buscador-predictivo-inventario";
    const CLASE_CONTENEDOR = "sugerencias-buscador-predictivo";
    const CLASE_SUGERENCIA = "sugerencia-buscador-predictivo";

    /*************************************/
    /* NORMALIZAR TEXTO */
    /*************************************/
    function normalizarTexto(valor) {
        const texto = String(valor ?? "").toLowerCase();

        try {
            return texto
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        } catch (error) {
            return texto.trim();
        }
    }

    /*************************************/
    /* CONFIGURAR ACCIONES DEL VISOR */
    /*************************************/
    function configurarAccionesVisor(enlace, tipo) {
        if (!enlace) return;

        const codigo = normalizarTexto(enlace.dataset.codigo || "");

        const tipoRegistro = String(
            tipo ||
            enlace.dataset.tipo ||
            enlace.dataset.tipoRegistro ||
            (codigo.startsWith("d-") ? "DOCUMENTO" : "NORMA")
        )
            .trim()
            .toUpperCase();

        const esDocumento =
            tipoRegistro === "DOCUMENTO" ||
            tipoRegistro === "DOCUMENTOS";

        const esNorma = tipoRegistro === "NORMA";

        enlace.dataset.mostrarDescargar = "true";
        enlace.dataset.mostrarActualizar = String(esDocumento);
        enlace.dataset.mostrarEliminar = String(esDocumento);
        enlace.dataset.mostrarAgregarFormato = String(esDocumento);
        enlace.dataset.mostrarActualizarNorma = String(esNorma);
    }

    /* Respetar el rol y los permisos existentes de la norma. */
    function normaSinPermisoLector(enlace, tipo) {
        if (tipo !== "NORMA") return false;
        let grupos = [];
        try {
            grupos = JSON.parse(sessionStorage.getItem("userGroups") || "[]");
        } catch { return false; }
        if (!Array.isArray(grupos)) return false;
        const codigos = grupos.map(g => normalizarTexto(g?.codigo));
        const nombres = grupos.map(g => normalizarTexto(g?.nombre));
        const esAdmin = codigos.some(c =>
            c === "normateca-admin" || c === "normateca-admin-principal"
        ) || nombres.some(n =>
            n === "normateca admin" || n === "normateca admin principal"
        );
        const esLector = codigos.includes("normateca-lectura") ||
            nombres.includes("normateca lectura");
        if (esAdmin || !esLector) return false;
        const clasificacion = normalizarTexto(enlace.dataset.clasificacion);
        if (clasificacion !== "confidencial" && clasificacion !== "restringida") {
            return false;
        }
        // El visor permite consultar únicamente cuando verPdf es verdadero.
        // Leer la misma lista evita confundir una Promise con un permiso.
        const contenidoId = String(
            enlace.dataset.contenidoId || enlace.dataset.idContenido || enlace.dataset.id || ""
        ).trim();
        let permisos = [];
        try {
            permisos = JSON.parse(sessionStorage.getItem("permisos") || "[]");
        } catch { return true; }
        const permiso = Array.isArray(permisos) && contenidoId
            ? permisos.find(p => p && String(p.contenidoId ?? "").trim() === contenidoId)
            : null;
        const verPdf = permiso?.verPdf;
        return !(verPdf === true || verPdf === "true" || verPdf === 1 || verPdf === "1");
    }

    /*************************************/
    /* AGREGAR ESTILOS */
    /*************************************/
    function agregarEstilos() {
        if (document.getElementById(ID_ESTILOS)) return;

        const estilos = document.createElement("style");
        estilos.id = ID_ESTILOS;
        estilos.textContent = `
      .${CLASE_CONTENEDOR} {
        position: absolute;
        z-index: 1060;
        display: none;
        overflow-y: auto;
        overflow-x: hidden;
        min-width: 260px;
        max-height: 280px;
        background: #ffffff;
        border: 1px solid #dee2e6;
        border-radius: 0 0 0.25rem 0.25rem;
        box-shadow: 0 0.35rem 0.8rem rgba(0, 0, 0, 0.16);
      }

      .${CLASE_CONTENEDOR}.${CLASE_CONTENEDOR}-activo {
        display: block;
      }

      .${CLASE_SUGERENCIA} {
        display: flex;
        width: 100%;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.7rem 0.85rem;
        overflow: hidden;
        color: #495057;
        text-align: left;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: normal;
        background: #ffffff;
        border-bottom: 1px solid #eeeeee;
      }

      .${CLASE_SUGERENCIA}:last-child {
        border-bottom: 0;
      }

      .${CLASE_SUGERENCIA}-semaforo {
        width: 10px;
        height: 10px;
        flex: 0 0 10px;
        margin-top: 0.4rem;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 50%;
      }

      .${CLASE_SUGERENCIA}-contenido {
        min-width: 0;
      }

      .${CLASE_SUGERENCIA}-titulo {
        display: block;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .${CLASE_SUGERENCIA}-vigencia {
        display: block;
        margin-top: 0.25rem;
        color: #6c757d;
        font-size: 0.875em;
      }

      .${CLASE_SUGERENCIA}[aria-selected="true"],
      .${CLASE_SUGERENCIA}:hover,
      .${CLASE_SUGERENCIA}:focus {
        color: #650c30;
        text-decoration: none;
        background: #f5f5f5;
        outline: none;
      }
      .${CLASE_SUGERENCIA}.norma-sin-permiso,
      .${CLASE_SUGERENCIA}.norma-sin-permiso:hover,
      .${CLASE_SUGERENCIA}.norma-sin-permiso:focus,
      .${CLASE_SUGERENCIA}.norma-sin-permiso[aria-selected="true"] {
        color: #6c757d;
        background-color: #E9ECEF;
      }
    `;

        document.head.appendChild(estilos);
    }

    /*************************************/
    /* CREAR CONTENEDOR */
    /*************************************/
    function obtenerContenedorSugerencias(input) {
        const identificador =
            input.dataset.contenedorPredictivoId ||
            `sugerencias-${input.id || "buscador"}`;

        input.dataset.contenedorPredictivoId = identificador;

        let contenedor = document.getElementById(identificador);

        if (!contenedor) {
            contenedor = document.createElement("div");
            contenedor.id = identificador;
            contenedor.className = CLASE_CONTENEDOR;
            contenedor.setAttribute("role", "listbox");
            contenedor.setAttribute("aria-label", "Sugerencias de búsqueda");

            const padre = input.parentElement;
            if (!padre) return null;

            if (window.getComputedStyle(padre).position === "static") {
                padre.style.position = "relative";
            }

            padre.appendChild(contenedor);
        }

        posicionarContenedor(input, contenedor);
        input.setAttribute("autocomplete", "off");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-controls", identificador);

        return contenedor;
    }

    /*************************************/
    /* POSICIONAR CONTENEDOR */
    /*************************************/
    function posicionarContenedor(input, contenedor) {
        contenedor.style.left = `${input.offsetLeft}px`;
        contenedor.style.top = `${input.offsetTop + input.offsetHeight}px`;
        contenedor.style.width = `${Math.max(input.offsetWidth, 260)}px`;
    }

    /*************************************/
    /* OBTENER REGISTROS DE LA TABLA */
    /*************************************/
    function obtenerRegistros(configuracion) {
        const tabla = document.querySelector(configuracion.tabla);
        if (!tabla) return [];

        const registros = [];
        const clavesAgregadas = new Set();

        tabla.querySelectorAll(configuracion.filas).forEach((fila) => {
            const enlaceOriginal = fila.querySelector(configuracion.enlaceVisor);
            if (!enlaceOriginal) return;

            const datos = enlaceOriginal.dataset;
            const codigo = String(datos.codigo ?? "").trim();
            const titulo = String(datos.titulo ?? enlaceOriginal.textContent ?? "").trim();
            const vigencia = String(datos.vigencia ?? "").trim();
            const prefijo = normalizarTexto(codigo).startsWith("d-") ? "D" : "N";
            const tipo = String(
                datos.tipo ?? (prefijo === "D" ? "DOCUMENTO" : "NORMA")
            )
                .trim()
                .toUpperCase();

            configurarAccionesVisor(enlaceOriginal, tipo);

            if (!codigo && !titulo) return;

            const clave = [
                datos.id ?? "",
                datos.versionId ?? "",
                datos.idArchivo ?? "",
                codigo,
                vigencia,
            ].join("|");

            if (clavesAgregadas.has(clave)) return;
            clavesAgregadas.add(clave);

            registros.push({
                codigo,
                titulo,
                vigencia,
                fechaDesde: String(datos.fechaDesde || datos.fechaVigencia || vigencia).trim(),
                semaforo: normalizarTexto(datos.semaforo),
                prefijo,
                tipo,
                enlaceOriginal,
            });
        });

        return registros;
    }

    /*************************************/
    /* VALIDAR COINCIDENCIA */
    /*************************************/
    function coincideRegistro(registro, textoBuscado) {
        const codigo = normalizarTexto(registro.codigo);

        if (registro.prefijo === "D") {
            return codigo.includes(textoBuscado);
        }

        const titulo = normalizarTexto(registro.titulo);
        const vigencia = normalizarTexto(registro.vigencia);
        const anio = vigencia.length >= 4 ? vigencia.slice(0, 4) : "";

        return (
            codigo.includes(textoBuscado) ||
            titulo.includes(textoBuscado) ||
            vigencia.includes(textoBuscado) ||
            anio.includes(textoBuscado)
        );
    }

    /*************************************/
    /* ORDENAR RESULTADOS */
    /*************************************/
    function ordenarRegistros(a, b) {
        const prioridadA = a.prefijo === "N" ? 0 : 1;
        const prioridadB = b.prefijo === "N" ? 0 : 1;

        if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
        }

        return a.codigo.localeCompare(b.codigo, "es", {
            numeric: true,
            sensitivity: "base",
        });
    }

    /*************************************/
    /* COPIAR DATOS DEL ENLACE ORIGINAL */
    /*************************************/
    function copiarDatos(enlaceOriginal, sugerencia, registro) {
        configurarAccionesVisor(enlaceOriginal, registro.tipo);

        Object.keys(enlaceOriginal.dataset).forEach((nombre) => {
            sugerencia.dataset[nombre] = enlaceOriginal.dataset[nombre];
        });

        if (!sugerencia.dataset.tipo) {
            sugerencia.dataset.tipo = registro.tipo;
        }

        configurarAccionesVisor(sugerencia, registro.tipo);
    }

    /*************************************/
    /* OCULTAR SUGERENCIAS */
    /*************************************/
    function ocultarSugerencias(input, contenedor) {
        contenedor.replaceChildren();
        delete contenedor.dataset.indiceActivo;
        input.removeAttribute("aria-activedescendant");
        contenedor.classList.remove(`${CLASE_CONTENEDOR}-activo`);
        input.setAttribute("aria-expanded", "false");
    }

    /*************************************/
    /* MOSTRAR SUGERENCIAS */
    /*************************************/
    function formatearFechaVigencia(valor) {
        const texto = String(valor ?? "").trim();
        const fecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);
        return fecha ? `${fecha[3]}-${fecha[2]}-${fecha[1]}` : texto || "Sin información";
    }

    function mostrarSugerencias(input, contenedor, registros) {
        contenedor.replaceChildren();

        delete contenedor.dataset.indiceActivo;
        input.removeAttribute("aria-activedescendant");
        registros.forEach((registro, indice) => {
            const sugerencia = document.createElement("a");
            sugerencia.href = "#";
            sugerencia.id = `${contenedor.id}-opcion-${indice}`;
            sugerencia.setAttribute("aria-selected", "false");
            sugerencia.className = `llamar-visor ${CLASE_SUGERENCIA}`;
            const coloresSemaforo = {
                verde: "#198754",
                amarillo: "#FFC107",
                rojo: "#DC3545",
            };
            const color = coloresSemaforo[registro.semaforo];
            if (color) {
                const indicador = document.createElement("span");
                indicador.className = `${CLASE_SUGERENCIA}-semaforo`;
                indicador.style.backgroundColor = color;
                indicador.title = `Semáforo: ${registro.semaforo}`;
                indicador.setAttribute("aria-hidden", "true");
                sugerencia.appendChild(indicador);
            }

            const contenido = document.createElement("span");
            contenido.className = `${CLASE_SUGERENCIA}-contenido`;
            const titulo = document.createElement("span");
            titulo.className = `${CLASE_SUGERENCIA}-titulo`;
            titulo.textContent = registro.titulo || registro.codigo;
            const fecha = document.createElement("span");
            fecha.className = `${CLASE_SUGERENCIA}-vigencia`;
            fecha.textContent = `Fecha de vigencia: ${formatearFechaVigencia(registro.fechaDesde)}`;
            contenido.appendChild(titulo);
            contenido.appendChild(fecha);
            sugerencia.appendChild(contenido);
            sugerencia.title = "Vista previa";
            sugerencia.setAttribute(
                "aria-label",
                `Ver ${registro.titulo || registro.codigo}. Fecha de vigencia: ${formatearFechaVigencia(registro.fechaDesde)}${color ? `. Semáforo: ${registro.semaforo}` : ""}`
            );
            sugerencia.setAttribute("role", "option");

            copiarDatos(registro.enlaceOriginal, sugerencia, registro);
            if (normaSinPermisoLector(registro.enlaceOriginal, registro.tipo)) {
                sugerencia.classList.add("norma-sin-permiso");
            }

            sugerencia.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                ocultarSugerencias(input, contenedor);

                /*
                 * Ejecuta el elemento original para conservar los eventos particulares
                 * del visor en Inventario, Normas adjuntas e Histórico.
                 */
                registro.enlaceOriginal.click();
            });

            contenedor.appendChild(sugerencia);
        });

        posicionarContenedor(input, contenedor);
        contenedor.classList.add(`${CLASE_CONTENEDOR}-activo`);
        input.setAttribute("aria-expanded", "true");
    }

    /*************************************/
    /* BUSCAR */
    /*************************************/
    function ejecutarBusqueda(input, contenedor, configuracion) {
        const textoBuscado = normalizarTexto(input.value);

        if (!textoBuscado) {
            ocultarSugerencias(input, contenedor);
            return;
        }

        const resultados = obtenerRegistros(configuracion)
            .filter((registro) => coincideRegistro(registro, textoBuscado))
            .sort(ordenarRegistros)
            .slice(0, configuracion.maximoSugerencias);

        if (resultados.length === 0) {
            ocultarSugerencias(input, contenedor);
            return;
        }

        mostrarSugerencias(input, contenedor, resultados);
    }

    /*************************************/
    /* INICIALIZAR BUSCADOR PREDICTIVO */
    /*************************************/
    window.inicializarBuscadorPredictivo = function (opciones = {}) {
        const configuracion = {
            ...CONFIGURACION_PREDETERMINADA,
            ...opciones,
        };

        const input = document.querySelector(configuracion.input);
        if (!input) return false;

        const tabla = document.querySelector(configuracion.tabla);

        tabla
            ?.querySelectorAll(configuracion.enlaceVisor)
            .forEach((enlace) => {
                configurarAccionesVisor(
                    enlace,
                    enlace.dataset.tipo || enlace.dataset.tipoRegistro
                );
            });

        agregarEstilos();

        const contenedor = obtenerContenedorSugerencias(input);
        if (!contenedor) return false;

        /* Evita registrar los eventos más de una vez. */
        if (input.dataset.buscadorPredictivoInicializado === "true") {
            return true;
        }

        input.dataset.buscadorPredictivoInicializado = "true";
        input.setAttribute("aria-expanded", "false");

        input.addEventListener("input", () => {
            ejecutarBusqueda(input, contenedor, configuracion);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                ocultarSugerencias(input, contenedor);
                return;
            }
            if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
            if (event.key !== "Enter" &&
                !contenedor.classList.contains(`${CLASE_CONTENEDOR}-activo`)) {
                ejecutarBusqueda(input, contenedor, configuracion);
            }
            const opciones = Array.from(contenedor.querySelectorAll(`.${CLASE_SUGERENCIA}`));
            if (!opciones.length) return;
            let indice = Number(contenedor.dataset.indiceActivo ?? -1);
            if (event.key === "Enter") {
                if (indice >= 0 && opciones[indice]) {
                    event.preventDefault();
                    opciones[indice].click();
                }
                return;
            }
            event.preventDefault();
            indice = event.key === "ArrowDown"
                ? (indice + 1) % opciones.length
                : (indice <= 0 ? opciones.length - 1 : indice - 1);
            contenedor.dataset.indiceActivo = String(indice);
            opciones.forEach((opcion, i) => {
                opcion.setAttribute("aria-selected", String(i === indice));
            });
            input.setAttribute("aria-activedescendant", opciones[indice].id);
            opciones[indice].scrollIntoView({ block: "nearest" });
        });

        input.addEventListener("focus", () => {
            if (normalizarTexto(input.value)) {
                ejecutarBusqueda(input, contenedor, configuracion);
            }
        });

        document.addEventListener("click", (event) => {
            if (event.target !== input && !contenedor.contains(event.target)) {
                ocultarSugerencias(input, contenedor);
            }
        });

        window.addEventListener("resize", () => {
            posicionarContenedor(input, contenedor);
        });

        return true;
    };
})();

/*************************************/
/* USO EN LOS TRES COMPONENTES */

document.addEventListener("DOMContentLoaded", function () {
    window.inicializarBuscadorPredictivo({
        input: "#txtBuscar",
        tabla: "#tabla-dinamica table",
    });
});
