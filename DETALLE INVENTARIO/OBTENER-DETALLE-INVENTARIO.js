
(async () => {
    // Retirar el listener de la página anterior antes de cualquier petición.
    if (window.Liferay && window.informacionEventoNavigate) {
        window.Liferay.detach("endNavigate", window.informacionEventoNavigate);
    }
    if (!(window.detalleInventarioCargasIniciales instanceof WeakMap)) {
        window.detalleInventarioCargasIniciales = new WeakMap();
    }
    let cargaDetallePendiente = null;

    const rolNORMATECA = window.obtenerRolNORMATECA?.() || null;

    const rolUsuario = rolNORMATECA?.nombre || "";
    const nivelPermiso = Number(rolNORMATECA?.permisos ?? -1);

    const esLectorNORMATECA = nivelPermiso === 1;
    async function obtenerPermisoAdminNormateca() {
        try {
            if (typeof window.usuarioEsAdminNormateca === "function") {
                return await window.usuarioEsAdminNormateca();
            }

            const userGroupsStorage = sessionStorage.getItem("userGroups");

            if (!userGroupsStorage) {
                return false;
            }

            const userGroups = JSON.parse(userGroupsStorage);

            if (!Array.isArray(userGroups)) {
                return false;
            }

            return userGroups.some(function (grupo) {
                const codigo = String(grupo?.codigo || "")
                    .trim()
                    .toLowerCase();

                return (
                    codigo === "normateca-admin-principal" || codigo === "normateca-admin"
                );
            });
        } catch (error) {
            console.error(
                "No fue posible validar los permisos de administrador:",
                error
            );

            return false;
        }
    }

    async function obtenerPermisoNormaDetalle(contenidoId, intentos = 50) {
        const idBuscado = String(contenidoId ?? "").trim();

        if (!idBuscado) {
            return null;
        }

        for (let i = 0; i < intentos; i++) {
            const permisosStorage = sessionStorage.getItem("permisos");

            if (permisosStorage !== null) {
                try {
                    const permisos = JSON.parse(permisosStorage);

                    if (!Array.isArray(permisos)) {
                        return null;
                    }

                    return (
                        permisos.find(function (permiso) {
                            return (
                                permiso &&
                                String(permiso.contenidoId ?? "").trim() === idBuscado
                            );
                        }) || null
                    );
                } catch (error) {
                    console.error(
                        "[PERMISOS] No fue posible interpretar los permisos:",
                        error
                    );

                    return null;
                }
            }

            await new Promise(function (resolve) {
                setTimeout(resolve, 200);
            });
        }

        return null;
    }

    function obtenerInformacionTabla() {
        if (cargaDetallePendiente) return cargaDetallePendiente;
        cargaDetallePendiente = Promise.resolve().then(cargarInformacionDetalle).finally(function () {
            cargaDetallePendiente = null;
        });
        return cargaDetallePendiente;
    }

    async function cargarInformacionDetalle() {
        window.mostrarLoaderPeticion();

        try {
            sessionStorage.setItem("functional-id", "Consulta inventario Normativas");

            const params = new URLSearchParams(window.location.search);
            const idDocumento = params.get("id");
            const esHistorico = params.get("historico") === "true";

            if (!idDocumento) {
                console.warn("No se encontró el parámetro 'id' en la URL.");
                window.ocultarLoaderPeticion();
                return;
            }

            if (typeof window.tokenizerTransactionId !== "function") {
                window.ocultarLoaderPeticion();
                return;
            }

            await window.tokenizerTransactionId();

            const response = await window.apiFetch(
                "normativas",
                `/api/v1/inventario/detalle/${idDocumento}`
            );

            const esAdmin = await obtenerPermisoAdminNormateca();

            const dataResponse = response?.data?.dataResponse;

            const detalle = Array.isArray(dataResponse)
                ? dataResponse[0]
                : dataResponse;

            if (!detalle) {
                console.warn("No se recibió información del detalle.");
                window.ocultarLoaderPeticion();
                return;
            }

            pintarEncabezadoDetalle(detalle, esAdmin, esHistorico);

            const tipo = String(detalle.tipo || "").trim().toUpperCase();
            const esVerdadero = (valor) => [true, "true", 1, "1"].includes(valor);
            const tieneNormas = esVerdadero(detalle.tieneNormasAdjuntas) ||
                (Array.isArray(detalle.normasAdjuntas) && detalle.normasAdjuntas.length > 0);
            const tieneFormatos = esVerdadero(detalle.tieneFormatosAdjuntos) ||
                (Array.isArray(detalle.formatosAdjuntos) && detalle.formatosAdjuntos.length > 0);
            const cargarFormatosNorma = tipo === "NORMA" && tieneFormatos;
            const puedeEliminarFormatoNorma = esAdmin && !esHistorico;
            let recursosFormatos = [];
            let errorFormatos = "";
            if (cargarFormatosNorma) {
                try {
                const respuestaFormatos = await window.apiFetch(
                    "normativas",
                    `/api/v1/inventario/normas/${encodeURIComponent(detalle.id ?? idDocumento)}/formatos`
                );
                const resultadoFormatos = respuestaFormatos?.data;
                const statusFormatos = Number(resultadoFormatos?.errorMessageDTO?.statusCode || resultadoFormatos?.statusCode || respuestaFormatos?.status || 500);
                const listaFormatos = resultadoFormatos?.dataResponse;
                if (!respuestaFormatos || respuestaFormatos.ok === false || statusFormatos >= 400 || !Array.isArray(listaFormatos)) {
                    throw new Error(resultadoFormatos?.errorMessageDTO?.message || resultadoFormatos?.message || "No fue posible consultar los formatos de la norma.");
                }
                recursosFormatos = obtenerRecursosPorTipo({
                    tieneFormatosAdjuntos: true,
                    formatosAdjuntos: listaFormatos,
                });
                } catch (error) {
                    errorFormatos = error?.message || "No fue posible consultar los formatos de la norma.";
                    console.error("[Detalle inventario] Error al consultar formatos:", error);
                    recursosFormatos = obtenerRecursosPorTipo({
                        tieneFormatosAdjuntos: true,
                        formatosAdjuntos: detalle.formatosAdjuntos,
                    });
                }
            }

            if (typeof window.crearTablaDinamica !== "function") {
                console.error("crearTablaDinamica no existe");
                window.ocultarLoaderPeticion();
                return;
            }

            const vistas = [];
            if (tipo === "NORMA") {
                if (tieneNormas || !cargarFormatosNorma) {
                    vistas.push({ formatos: false, recursos: obtenerRecursosPorTipo({
                        ...detalle, tieneNormasAdjuntas: true, tieneFormatosAdjuntos: false,
                    }) });
                }
                if (cargarFormatosNorma) vistas.push({ formatos: true, recursos: recursosFormatos });
            } else {
                vistas.push({ formatos: false, recursos: obtenerRecursosPorTipo(detalle) });
            }
            const contenedorPrincipal = document.querySelector("#tabla-dinamica");
            const tablaFormatosAnterior = document.getElementById("tabla-formatos-adjuntos-norma");
            if (vistas.length <= 1) tablaFormatosAnterior?.remove();
            if (vistas.length > 1 && contenedorPrincipal && !tablaFormatosAnterior) {
                const contenedorFormatos = document.createElement("div");
                contenedorFormatos.id = "tabla-formatos-adjuntos-norma";
                contenedorFormatos.className = "pt-5 pb-5 mt-4";
                // Evitar el ancho máximo y los márgenes automáticos de .container.
                contenedorFormatos.style.setProperty("width", "100%", "important");
                contenedorFormatos.style.setProperty("max-width", "100%", "important");
                contenedorFormatos.style.setProperty("margin-left", "0", "important");
                contenedorFormatos.style.setProperty("margin-right", "0", "important");
                contenedorFormatos.innerHTML = `
                    <h1 class="tabla-h1"></h1>
                    <hr class="red">
                    <div class="d-flex justify-content-end mb-5">
                        <div class="form-inline">
                            <label for="selectRows-formatos-norma" class="mr-2 font-weight-bold">Mostrar:</label>
                            <select id="selectRows-formatos-norma" class="form-control form-control-sm">
                                <option value="5" selected>5</option>
                                <option value="10">10</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                    </div>
                    <div class="pestana activa mb-5">
                        <table><thead></thead><tbody></tbody></table>
                    </div>
                    <div id="paginador-formatos-norma"></div>
                `;
                contenedorPrincipal.insertAdjacentElement("afterend", contenedorFormatos);
            }

            for (const [indiceVista, vista] of vistas.entries()) {
            const recursos = vista.recursos;
            const esVistaFormatosNorma = tipo === "NORMA" && vista.formatos;
            const selectorTabla = indiceVista === 0 ? "#tabla-dinamica" : "#tabla-formatos-adjuntos-norma";
            /*
             * DOCUMENTOS conserva exactamente su tabla actual.
             * NORMA replica la estructura de la tabla principal de Inventario.
             */
            let filas = [];
            let configuracionTabla;

            if (tipo === "NORMA" && !esVistaFormatosNorma) {
                function semaforoNormas(frase) {
                    const colorTexto =
                        frase === "Restringida" || frase === "Confidencial"
                            ? "red"
                            : "green";

                    return `
                    <span style="color:${colorTexto}">
                      ${frase ?? ""}
                    </span>
                  `;
                }

                function semaforo(
                    frase,
                    color,
                    actualizarActivo = false,
                    vigenciaManual = false
                ) {
                    const colorTexto =
                        color === "rojo"
                            ? "red"
                            : color === "amarillo"
                                ? "#FFC107"
                                : "green";

                    return `
                    <span
                      data-color-original="${colorTexto}"
                      style="
                        color:${actualizarActivo ? "#FFFFFF" : colorTexto};
                        ${vigenciaManual
                            ? `text-decoration: underline; text-decoration-color: ${colorTexto}; text-decoration-thickness: 2px; text-underline-offset: 3px;`
                            : ""
                        }
                      "
                    >
                      ${frase ?? ""}
                    </span>
                  `;
                }

                function documentosUsoNorma(fila) {
                    const idDocumentoPrincipal =
                        fila.documentoPrincipal?.id ?? fila.idArchivo ?? "";

                    const tieneDocumentoPrincipal =
                        fila.tieneDocumentoPrincipal === true &&
                        idDocumentoPrincipal !== "";

                    const tieneAdjuntosNorma = fila.datosAdjuntos === true;

                    const tieneFormatosAdjuntos = fila.tieneFormatosAdjuntos === true;

                    if (tieneAdjuntosNorma) {
                        return `
                      <a
                        title="Ver adjuntos"
                        href="/web/normateca/detalle-inventario?id=${fila.id}"
                      >
                        <i class="bi bi-folder-fill"></i>
                      </a>
              `;
                    }

                    if (!tieneDocumentoPrincipal) {
                        return `
                      <span
                        class="text-muted"
                        title="Este registro no tiene documento principal"
                        aria-label="Este registro no tiene documento principal"
                      >
                        Sin documento
                      </span>
                    `;
                    }

                    if (tieneFormatosAdjuntos) {
                        return `
                      <a
                        title="Ver formatos"
                        href="/web/normateca/detalle-inventario?id=${encodeURIComponent(fila.id ?? "")}"
                      >
                        <i class="bi bi-paperclip"></i>
                      </a>
                    `;
                    }

                    return `
                    <button
                      type="button"
                      class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
                      data-id="${fila.id ?? ""}"
                      data-id-padre="${fila.idPadre ?? ""}"
                      data-contenido-id="${fila.contenidoId ?? fila.id ?? ""}"
                      data-id-contenido="${fila.contenidoId ?? fila.id ?? ""}"
                      data-id-registro="${fila.contenidoId ?? fila.id ?? ""}"
                      data-tipo-registro="${fila.tipoOriginal ?? "NORMA_ADJUNTA"
                        }"
                      data-tiene-documento-principal="${tieneDocumentoPrincipal}"
                      data-datos-adjuntos="${fila.datosAdjuntos === true}"
                      data-tiene-formatos-adjuntos="${fila.tieneFormatosAdjuntos === true
                        }"
                      data-version-id="${fila.versionId ?? ""}"
                      data-id-archivo="${idDocumentoPrincipal}"
                      data-documento-id="${idDocumentoPrincipal}"
                      data-archivo-id="${idDocumentoPrincipal}"
                      data-codigo="${fila.codigo ?? ""}"
                      data-titulo="${fila.titulo ?? ""}"
                      data-titulo-norma="${fila.titulo ?? fila.nombre ?? ""}"
                      data-fecha-modificacion="${fila.fechaModificacion ?? fila.fechaActualizacion ?? ""
                        }"
                      data-clasificacion="${fila.clasificacion ?? ""}"
                      data-vigencia="${fila.vigencia ?? ""}"
                      data-semaforo="${fila.semaforo ?? ""}"
                      data-tipo="${fila.tipoOriginal ?? "NORMA_ADJUNTA"}"
                      data-fecha-vigencia="${fila.fechaVigencia ?? fila.vigencia ?? ""
                        }"
                      data-fhasta="${fila.fhasta ?? ""}"
                      data-fecha-desde="${fila.fechaVigencia ?? fila.vigencia ?? ""
                        }"
                      data-fecha-hasta="${fila.fhasta ?? ""}"
                      data-is-update="${fila.isUpdate === true}"
                      data-vigencia-manual="${fila.vigenciaManual === true}"
                      data-renovacion="${fila.renovacion === true}"
                      data-nombre-archivo="${fila.nombreArchivo ?? fila.nombre ?? ""
                        }"
                      data-ruta="${fila.ruta ?? ""}"
                      data-nombre="${fila.nombreArchivo ?? fila.nombre ?? ""}"
                      data-descarga-permitida="${fila.descargaPermitida !== false
                        }"
                      data-mostrar-descargar="true"
                      data-mostrar-actualizar="false"
                      data-mostrar-eliminar="false"
                      data-mostrar-agregar-formato="false"
                      data-mostrar-actualizar-norma="${esAdmin}"
                      title="Ver documento"
                      aria-label="Ver documento"
                    >
                      Ver
                    </button>
                  `;
                }

                function tituloConVistaPreviaNorma(fila) {
                    const idDocumentoPrincipal =
                        fila.documentoPrincipal?.id ?? fila.idArchivo ?? "";

                    const tieneDocumentoPrincipal =
                        fila.tieneDocumentoPrincipal === true &&
                        idDocumentoPrincipal !== "";

                    const titulo = fila.titulo ?? fila.nombre ?? "";

                    if (!tieneDocumentoPrincipal) {
                        return titulo;
                    }

                    return `
                    <a
                      href="#"
                      class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
                      data-id="${fila.id ?? ""}"
                      data-id-padre="${fila.idPadre ?? ""}"
                      data-contenido-id="${fila.contenidoId ?? fila.id ?? ""}"
                      data-id-contenido="${fila.contenidoId ?? fila.id ?? ""}"
                      data-id-registro="${fila.contenidoId ?? fila.id ?? ""}"
                      data-tipo-registro="${fila.tipoOriginal ?? "NORMA_ADJUNTA"
                        }"
                      data-tiene-documento-principal="${tieneDocumentoPrincipal}"
                      data-datos-adjuntos="${fila.datosAdjuntos === true}"
                      data-tiene-formatos-adjuntos="${fila.tieneFormatosAdjuntos === true
                        }"
                      data-version-id="${fila.versionId ?? ""}"
                      data-id-archivo="${idDocumentoPrincipal}"
                      data-documento-id="${idDocumentoPrincipal}"
                      data-archivo-id="${idDocumentoPrincipal}"
                      data-codigo="${fila.codigo ?? ""}"
                      data-titulo="${titulo}"
                      data-titulo-norma="${titulo}"
                      data-fecha-modificacion="${fila.fechaModificacion ?? fila.fechaActualizacion ?? ""
                        }"
                      data-clasificacion="${fila.clasificacion ?? ""}"
                      data-vigencia="${fila.vigencia ?? ""}"
                      data-semaforo="${fila.semaforo ?? ""}"
                      data-tipo="${fila.tipoOriginal ?? "NORMA_ADJUNTA"}"
                      data-fecha-vigencia="${fila.fechaVigencia ?? fila.vigencia ?? ""
                        }"
                        data-fhasta="${fila.fhasta ?? ""}"
                        data-fecha-desde="${fila.fechaVigencia ?? fila.vigencia ?? ""
                        }"
                        data-fecha-hasta="${fila.fhasta ?? ""}"
                      data-is-update="${fila.isUpdate === true}"
                      data-vigencia-manual="${fila.vigenciaManual === true}"
                      data-renovacion="${fila.renovacion === true}"
                      data-nombre-archivo="${fila.nombreArchivo ?? fila.nombre ?? ""
                        }"
                      data-ruta="${fila.ruta ?? ""}"
                      data-nombre="${fila.nombreArchivo ?? fila.nombre ?? ""}"
                      data-descarga-permitida="${fila.descargaPermitida !== false
                        }"
                      data-mostrar-descargar="true"
                      data-mostrar-actualizar="false"
                      data-mostrar-eliminar="false"
                      data-mostrar-agregar-formato="false"
                      data-mostrar-actualizar-norma="${esAdmin}"
                      title="Ver documento"
                      aria-label="Ver documento"
                    >
                      ${titulo}
                    </a>
                  `;
                }

                filas = await Promise.all(
                    recursos.map(async (item, index) => {
                        const idDocumento = item.id ?? "";
                        const idArchivoPrincipal =
                            item.documentoPrincipal?.id ?? item.idArchivo ?? "";

                        const tieneDocumentoPrincipal =
                            item.tieneDocumentoPrincipal === true &&
                            idArchivoPrincipal !== "";

                        const descargaPermitida =
                            item.descargaPermitida !== false && tieneDocumentoPrincipal;

                        const isUpdate = item.isUpdate === true;
                        const vigenciaManual = item.vigenciaManual === true;
                        const clasificacionNormalizada = String(item.clasificacion ?? "")
                            .trim()
                            .toLowerCase();
                        const esClasificacionRestringida =
                            clasificacionNormalizada === "restringida" ||
                            clasificacionNormalizada === "confidencial";
                        const requiereValidarPermiso =
                            !esAdmin &&
                            item.tipoRecursoTabla === "NORMA_ADJUNTA" &&
                            esClasificacionRestringida;
                        const permisoNorma = requiereValidarPermiso
                            ? await obtenerPermisoNormaDetalle(
                                item.contenidoId ?? item.idContenido ?? item.id
                            )
                            : null;
                        const sinPermiso =
                            requiereValidarPermiso &&
                            ![true, "true", 1, "1"].includes(permisoNorma?.verPdf);
                        const estiloFila =
                            !esAdmin && item.tipoRecursoTabla === "NORMA_ADJUNTA"
                                ? `background-color: ${sinPermiso ? "#E9ECEF" : "#FFFFFF"
                                } !important;`
                                : "";
                        const estiloFilaClase = sinPermiso ? "estilo" : "";

                        const esNormaAdjunta = item.tipoRecursoTabla === "NORMA_ADJUNTA";

                        const botonEngraneNormaAdjunta = esNormaAdjunta
                            ? `
                      <div
                        class="acciones-inventario acciones-norma-adjunta"
                        data-tipo-registro="NORMA_ADJUNTA"
                        style="display:${isUpdate ? "inline-flex" : "none"
                            } !important;"
                      >
                        <button
                          type="button"
                          class="btn btn-link p-0 editar-norma-inv"
                          data-id="${idDocumento}"
                          data-version-id="${item.versionId ?? ""}"
                          data-id-padre="${item.idPadre ?? ""}"
                          data-contenido-id="${idDocumento}"
                          data-documento-id="${idArchivoPrincipal}"
                          data-id-archivo="${idArchivoPrincipal}"
                          data-archivo-id="${idArchivoPrincipal}"
                          data-codigo="${item.codigo ?? ""}"
                          data-titulo="${item.titulo ?? item.nombre ?? ""}"
                          data-clasificacion="${String(
                                item.clasificacion ?? ""
                            ).toLowerCase()}"
                          data-fecha-vigencia="${item.fechaVigencia ?? item.vigencia ?? ""
                            }"
                          data-fhasta="${item.fhasta ?? ""}"
                          data-fecha-desde="${item.fechaVigencia ?? item.vigencia ?? ""
                            }"
                          data-fecha-hasta="${item.fhasta ?? ""}"
                          data-vigencia="${item.vigencia ?? ""}"
                          data-is-update="${isUpdate}"
                          data-vigencia-manual="${vigenciaManual}"
                          data-renovacion="${item.renovacion === true}"
                          data-nombre-archivo="${item.nombreArchivo ?? item.nombre ?? ""
                            }"
                          data-tipo="${item.tipoOriginal ?? "NORMA_ADJUNTA"}"
                          title="Editar norma adjunta"
                          aria-label="Editar norma adjunta"
                        >
                          <i class="bi bi-gear"></i>
                        </button>
                      </div>
                    `
                            : "";

                        return `    
                    ${esAdmin
                                ? `<td>
                      ${item.codigo ?? ""}
                    </td>`
                                : ""
                            }
          
                    <td class="${estiloFilaClase}" style="${estiloFila}">
                      ${tituloConVistaPreviaNorma(item)}
                    </td>
          
                    <td style="${estiloFila}">
                      ${semaforoNormas(item.clasificacion) ?? ""}
                    </td>
          
                    <td
                      class="celda-vigencia-inventario"
                      data-tipo-registro="NORMA"
                      data-vigencia-manual="${vigenciaManual}"
                      data-fondo-restringido="${sinPermiso}"
                      style="
                        ${esAdmin && isUpdate
                                ? "background-color: #FF9800; color: #FFFFFF;"
                                : estiloFila
                            }
                      "
                    >
                      ${semaforo(
                                item.vigencia,
                                item.semaforo,
                                esAdmin && isUpdate,
                                vigenciaManual
                            )}
                    </td>
        
                    ${esAdmin
                                ? `<td>
                      ${String(item.fechaModificacion ?? "").slice(0, 10)}
                    </td>`
                                : ""
                            }
          
                    <td style="${estiloFila}">
                      ${documentosUsoNorma(item)}
                    </td>
      
                    ${esAdmin && esNormaAdjunta && !esHistorico
                                ? `
                        <td class="text-center" >
                          <div class="d-inline-flex align-items-center justify-content-center gap-2">
                            <input
                              type="checkbox"
                              class="check-acciones-inventario check-acciones-norma-adjunta"
                              data-id="${idDocumento}"
                              data-id-padre="${item.idPadre ?? ""}"
                              data-tipo-registro="NORMA_ADJUNTA"
                              data-is-update="${isUpdate}"
                              aria-label="Actualizar vigencia"
                              title="Actualizar vigencia"
                              data-titulo="${item.titulo ?? item.nombre ?? ""}"
                              ${isUpdate ? "checked" : ""}
                            >
                            ${botonEngraneNormaAdjunta}
                          </div>
                        </td>
                      `
                                : ""
                            }
          
                  `;
                    })
                );

                const columnasNorma = [
                    ...(esAdmin
                        ? [
                            {
                                titulo: "Código",
                                ordenar: true,
                            },
                        ]
                        : []),
                    {
                        titulo: "Nombre de la norma",
                        ordenar: true,
                    },
                    {
                        titulo: "Clasificación",
                        ordenar: true,
                    },
                    {
                        titulo: "Fecha de vigencia",
                        ordenar: true,
                    },
                    ...(esAdmin
                        ? [
                            {
                                titulo: "Última fecha de actualización",
                                ordenar: true,
                            },
                        ]
                        : []),
                    {
                        titulo: "Documentos",
                        ordenar: true,
                    },
                ];

                if (esAdmin && !esHistorico) {
                    columnasNorma.push({
                        titulo: "Actualizar",
                        ordenar: false,
                    });
                }

                configuracionTabla = {
                    contenedor: "#tabla-dinamica",

                    titulo: `${obtenerTituloTabla(detalle, recursos.length)}`,

                    botonAccion: {
                        mostrar: false,
                    },

                    columnas: columnasNorma,

                    filas,
                };
            } else {
                /*
                 * DOCUMENTOS: BLOQUE ORIGINAL SIN CAMBIOS.
                 */
                filas = recursos.map((item, index) => {
                    const esNormaAdjunta = item.tipoRecursoTabla === "NORMA_ADJUNTA";

                    const tituloConVistaPrevia = esNormaAdjunta
                        ? `
                        <a
                          href="#"
                          class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
                          data-id="${item.id ?? ""}"
                          data-contenido-id="${item.id ?? ""}"
                          data-version-id="${item.versionId ?? ""}"
                          data-id-archivo="${item.idArchivo ?? ""}"
                          data-documento-id="${item.idArchivo ?? ""}"
                          data-archivo-id="${item.idArchivo ?? ""}"
                          data-codigo="${item.codigo ?? ""}"
                          data-titulo="${item.titulo ?? item.nombre ?? ""}"
                          data-titulo-norma="${item.titulo ?? item.nombre ?? ""
                        }"
                          data-fecha-modificacion="${item.fechaModificacion ??
                        item.fechaActualizacion ??
                        ""
                        }"
                          data-clasificacion="${item.clasificacion ?? ""}"
                          data-vigencia="${item.vigencia ?? ""}"
                          data-tipo="${item.tipoOriginal ?? "NORMA_ADJUNTA"}"
                          data-fecha-vigencia="${item.fechaVigencia ?? item.vigencia ?? ""
                        }"
                            data-fhasta="${item.fhasta ?? ""}"
                            data-fecha-desde="${item.fechaVigencia ?? item.vigencia ?? ""
                        }"
                            data-fecha-hasta="${item.fhasta ?? ""}"
                          data-is-update="${item.isUpdate === true}"
                          data-vigencia-manual="${item.vigenciaManual === true}"
                          data-renovacion="${item.renovacion === true}"
                          data-nombre-archivo="${item.nombreArchivo ?? ""}"
                          data-ruta="${item.ruta ?? ""}"
                          data-nombre="${item.nombreArchivo ?? item.nombre ?? ""
                        }"
                          data-descarga-permitida="${item.descargaPermitida !== false
                        }"
                          data-mostrar-descargar="true"
                          data-mostrar-actualizar="false"
                          data-mostrar-eliminar="false"
                          data-mostrar-agregar-formato="false"
                          data-mostrar-actualizar-norma="${esAdmin}"
                          title="Ver"
                          aria-label="Ver"
                        >
                          ${tipo === "DOCUMENTO" || tipo === "DOCUMENTOS"
                            ? quitarExtensionTitulo(
                                item.nombre ?? item.titulo ?? ""
                            )
                            : item.nombre ?? item.titulo ?? ""
                        }
                        </a>
                      `
                        : `
                        <a
                          href="#"
                          class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
                          data-id="${detalle.id ?? ""}"
                          data-contenido-id="${detalle.id ?? ""}"
                          data-id-archivo="${item.idArchivo ?? item.id ?? ""}"
                          data-documento-id="${item.idArchivo ?? item.id ?? ""}"
                          data-archivo-id="${item.idArchivo ?? item.id ?? ""}"
                          data-id-registro="${detalle.id ?? ""}"
                          data-id-contenido="${detalle.id ?? ""}"
                          data-codigo="${detalle.codigo ?? ""}"
                          data-titulo="${item.nombre ?? ""}"
                          data-titulo-norma="${detalle.titulo ?? ""}"
                          data-fecha-modificacion="${item.fechaModificacion ??
                        item.fechaActualizacion ??
                        ""
                        }"
                          data-clasificacion="${detalle.clasificacion ?? ""}"
                          data-vigencia="${detalle.vigencia ?? ""}"
                          data-semaforo="${detalle.semaforo ?? ""}"
                          data-tipo="DOCUMENTO"
                          data-extension-archivo="${escaparDatoDocumento(
                            item.tipo ||
                            obtenerExtensionArchivo(item.nombre) ||
                            ""
                        )}"
                          data-peso-archivo="${escaparDatoDocumento(
                            item.tamanio ?? ""
                        )}"
                          data-fecha-creacion="${escaparDatoDocumento(
                            item.fechaCreacion ?? ""
                        )}"
                          data-tipo-archivo="${item.tipo ?? item.tipoRecurso ?? "DOCUMENTO"
                        }"
                          data-tipo-actualizacion="documento"
                          data-ruta="${item.ruta ?? ""}"
                          data-nombre="${item.nombre ?? ""}"
                          data-endpoint="/api/v1/inventario/${esVistaFormatosNorma ? "normas" : "documentos"}/${detalle.id ?? ""
                        }/formatos/${item.idArchivo ?? item.id ?? ""}"
                          data-mostrar-descargar="true"
                          data-mostrar-actualizar="${esAdmin && !esVistaFormatosNorma}"
                          data-mostrar-eliminar="${esAdmin && !esVistaFormatosNorma}"
                          data-mostrar-agregar-formato="${esAdmin && !esVistaFormatosNorma}"
                          data-mostrar-actualizar-norma="false"
                          title="Ver"
                          aria-label="Ver"
                        >
                          ${tipo === "DOCUMENTO" || tipo === "DOCUMENTOS"
                            ? quitarExtensionTitulo(item.nombre ?? "")
                            : item.nombre ?? ""
                        }
                        </a>
                      `;

                    const idContenidoDescarga = esNormaAdjunta
                        ? item.id ?? ""
                        : detalle.id ?? "";

                    const idArchivoDescarga = item.idArchivo ?? item.id ?? "";

                    const codigoDescarga = esNormaAdjunta
                        ? item.codigo ?? ""
                        : detalle.codigo ?? "";

                    const tituloDescarga = item.titulo ?? item.nombre ?? codigoDescarga;

                    const tituloNormaDescarga = esNormaAdjunta
                        ? item.titulo ?? item.nombre ?? ""
                        : detalle.titulo ?? "";

                    const tipoDescarga = esNormaAdjunta
                        ? item.tipoOriginal ?? "NORMA_ADJUNTA"
                        : "DOCUMENTO";

                    const accionDescargar = `
                    <button
                      type="button"
                      class="btn btn-link p-0 btn-descargar descargar-registro-inventario"
                      data-id="${idContenidoDescarga}"
                      data-contenido-id="${idContenidoDescarga}"
                      data-version-id="${item.versionId ?? ""}"
                      data-id-archivo="${idArchivoDescarga}"
                      data-documento-id="${idArchivoDescarga}"
                      data-archivo-id="${idArchivoDescarga}"
                      data-id-contenido="${idContenidoDescarga}"
                      data-id-registro="${idContenidoDescarga}"
                      data-tipo-registro="${tipoDescarga}"
                      data-clasificacion="${item.clasificacion ?? detalle.clasificacion ?? ""
                        }"
                      data-vigencia="${item.vigencia ?? detalle.vigencia ?? ""}"
                      data-semaforo="${item.semaforo ?? detalle.semaforo ?? ""}"
                      data-codigo="${codigoDescarga}"
                      data-titulo="${tituloDescarga}"
                      data-titulo-norma="${tituloNormaDescarga}"
                      data-fecha-modificacion="${item.fechaModificacion ?? item.fechaActualizacion ?? ""
                        }"
                      data-tipo="${tipoDescarga}"
                      data-ruta="${item.ruta ?? ""}"
                      data-nombre="${item.nombreArchivo ?? item.nombre ?? ""}"
                      data-descarga-permitida="${item.descargaPermitida !== false
                        }"
                      title="Descargar"
                      aria-label="Descargar"
                    >
                      <i class="bi bi-file-earmark-arrow-down"></i>
                    </button>
                  `;

                    const accionEliminar = esVistaFormatosNorma && puedeEliminarFormatoNorma
                        ? `<button
                            type="button"
                            class="btn btn-link p-0 btn-eliminar-formato-norma"
                            data-contenido-id="${escaparDatoDocumento(detalle.id ?? idDocumento)}"
                            data-documento-id="${escaparDatoDocumento(idArchivoDescarga)}"
                            data-nombre-formato="${escaparDatoDocumento(item.nombre ?? item.titulo ?? "")}"
                            data-titulo-norma="${escaparDatoDocumento(detalle.titulo ?? detalle.nombre ?? "")}"
                            title="Eliminar formato"
                            aria-label="Eliminar formato"
                          ><i class="bi bi-trash"></i></button>`
                        : "";

                    return `
                    <td>
                      ${tituloConVistaPrevia}
                    </td>
          
                    <td class="text-center">
                      ${iconoArchivoPorTipo(item.tipo)}
                    </td>
          
                    <td>
                      ${item.tamanio ?? ""}
                    </td>
          
                    <td>
                      ${formatearFechaDetalle(item.fechaCreacion)}
                    </td>
        
                    ${esAdmin
                            ? `<td>
                      ${formatearFechaDetalle(
                                item.fechaModificacion ?? item.fechaActualizacion
                            )}
                    </td>`
                            : ""
                        }
      
                    <td class="text-center">
                      ${accionDescargar}
                      ${accionEliminar}
                    </td>
          
                  `;
                });

                configuracionTabla = {
                    contenedor: "#tabla-dinamica",

                    titulo: esVistaFormatosNorma ? "FORMATOS ADJUNTOS" : `${obtenerTituloTabla(detalle, recursos.length)}`,

                    botonAccion: {
                        mostrar: false,
                    },

                    columnas: [
                        {
                            titulo: "Nombre",
                            ordenar: true,
                        },
                        {
                            titulo: "Tipo",
                            ordenar: true,
                            centerText: true,
                        },
                        {
                            titulo: "Peso",
                            ordenar: true,
                        },
                        {
                            titulo: "Fecha de creación",
                            ordenar: true,
                        },
                        ...(esAdmin
                            ? [
                                {
                                    titulo: "Última fecha de actualización",
                                    ordenar: true,
                                },
                            ]
                            : []),
                        {
                            titulo: "Acciones",
                            ordenar: false,
                            centerText: true,
                        },
                    ],

                    filas,
                };
            }

            configuracionTabla.contenedor = selectorTabla;
            if (indiceVista > 0) {
                configuracionTabla.selectRows = "#selectRows-formatos-norma";
                configuracionTabla.paginador = "#paginador-formatos-norma";
            }
            if (tipo === "NORMA") configuracionTabla.titulo = vista.formatos ? "FORMATOS ADJUNTOS" : "NORMAS ADJUNTAS";
            window.crearTablaDinamica(configuracionTabla);
            aplicarEstilosDetalleTabla(selectorTabla);
            if (esVistaFormatosNorma && errorFormatos) {
                const aviso = document.createElement("div");
                aviso.className = "alert alert-warning";
                aviso.setAttribute("role", "alert");
                aviso.textContent = `${errorFormatos} La lista de formatos puede estar incompleta; vuelva a cargar el detalle.`;
                document.querySelector(selectorTabla)?.prepend(aviso);
            }
            }

            if (window.bitacoraService?.operationLog) {
                await window.bitacoraService.operationLog(
                    "GET",
                    "Consultar",
                    "Obtener detalle de inventario",
                    "Se consulta el detalle del documento",
                    response?.data?.statusCode ?? 200,
                    JSON.stringify(response?.data?.message || "Consulta exitosa")
                );
            }

            window.ocultarLoaderPeticion();
            return response?.data;
        } catch (e) {
            console.error(e);
            window.ocultarLoaderPeticion();
        }
    }

    function pintarEncabezadoDetalle(detalle, esAdmin, esHistorico) {
        const hrRed = document.querySelector("hr.red");

        if (!hrRed) {
            console.warn("No se encontró <hr class='red'>");
            return;
        }

        const encabezadoAnterior = document.querySelector(
            "#detalle-documento-header"
        );

        if (encabezadoAnterior) {
            encabezadoAnterior.remove();
        }

        const tipo = (detalle.tipo || "").toUpperCase();
        const icono = obtenerIconoEncabezado(tipo);
        const principal = detalle.documentoPrincipal || {};
        const fechaCreacion = principal.fechaCreacion;
        const tamanio = principal.tamanio;
        const idDocumentoPrincipal = principal.id ?? "";
        const tieneDocumentoPrincipal =
            detalle.tieneDocumentoPrincipal !== false && idDocumentoPrincipal !== "";

        const esDocumento = tipo === "DOCUMENTO" || tipo === "DOCUMENTOS";

        const esFormato = detalle.tieneFormatosAdjuntos === true;

        const botonVistaPreviaNormaPrincipal =
            (tipo === "NORMA" || esDocumento) && tieneDocumentoPrincipal
                ? `
                  <button
                    type="button"
                    class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
                    data-id="${detalle.id ?? ""}"
                    data-id-padre="${detalle.idPadre ?? ""}"
                    data-id-registro="${detalle.id ?? ""}"
                    data-tipo-registro="${detalle.tipo ?? "NORMA"}"
                    data-tiene-documento-principal="${tieneDocumentoPrincipal}"
                    data-datos-adjuntos="${detalle.datosAdjuntos === true}"
                    data-tiene-formatos-adjuntos="${detalle.tieneFormatosAdjuntos === true
                }"
                    data-contenido-id="${detalle.id ?? ""}"
                    data-id-contenido="${detalle.id ?? ""}"
                    data-version-id="${detalle.versionId ?? ""}"
                    data-id-archivo="${idDocumentoPrincipal}"
                    data-documento-id="${idDocumentoPrincipal}"
                    data-archivo-id="${idDocumentoPrincipal}"
                    data-codigo="${detalle.codigo ?? ""}"
                    data-titulo="${detalle.titulo ?? ""}"
                    data-titulo-norma="${detalle.titulo ?? ""}"
                    data-fecha-modificacion="${detalle.fechaModificacion ??
                detalle.fechaActualizacion ??
                ""
                }"
                    data-clasificacion="${detalle.clasificacion ?? ""}"
                    data-vigencia="${detalle.vigencia ?? ""}"
                    data-semaforo="${detalle.semaforo ?? ""}"
                    data-tipo="${detalle.tipo ?? "NORMA"}"
                    ${esDocumento
                    ? `
                    data-extension-archivo="${escaparDatoDocumento(
                        principal.tipo ||
                        obtenerExtensionArchivo(principal.nombre) ||
                        ""
                    )}"
                    data-peso-archivo="${escaparDatoDocumento(
                        principal.tamanio ?? ""
                    )}"
                    data-fecha-creacion="${escaparDatoDocumento(
                        detalle.fechaCreacion ?? principal.fechaCreacion ?? ""
                    )}"
                    `
                    : ""
                }
                    data-fecha-vigencia="${detalle.fechaVigencia ?? detalle.vigencia ?? ""
                }"
                    data-fhasta="${detalle.fhasta ?? ""}"
                    data-fecha-desde="${detalle.fechaVigencia ?? detalle.vigencia ?? ""
                }"
                    data-fecha-hasta="${detalle.fhasta ?? ""}"
                    data-is-update="${detalle.isUpdate === true}"
                    data-vigencia-manual="${detalle.vigenciaManual === true}"
                    data-renovacion="${detalle.renovacion === true}"
                    data-nombre-archivo="${principal.nombre ?? ""}"
                    data-ruta="${principal.ruta ?? ""}"
                    data-nombre="${principal.nombre ?? ""}"
                    data-descarga-permitida="${detalle.descargaPermitida !== false
                }"
                    data-mostrar-descargar="true"
                    data-mostrar-actualizar="${esDocumento && esAdmin}"
                    data-mostrar-eliminar="${esDocumento && esAdmin}"
                    data-mostrar-agregar-formato="${esDocumento && esAdmin}"
                    data-mostrar-actualizar-norma="${tipo === "NORMA" && esAdmin && !esHistorico
                }"
                    title="${esDocumento
                    ? "Ver documento principal"
                    : "Ver norma principal"
                }"
                    aria-label="${esDocumento
                    ? "Ver documento principal"
                    : "Ver norma principal"
                }"
                    style="position: absolute; top: 2px; right: -10px; z-index: 2; font-size: 1.25rem; line-height: 1;"
                  >
                    <i class="bi bi-eye" aria-hidden="true"></i>
                  </button>
                `
                : "";

        const bloque = document.createElement("div");
        bloque.id = "detalle-documento-header";
        bloque.className = "pt-5 pb-4";

        bloque.innerHTML = `
              <div class="mb-4 d-flex justify-content-between">
                <button type="button" class="btn btn-primary btn-regresar">
                  <i class="bi bi-arrow-left"></i> Regresar
                </button>
          
                ${tipo === "NORMA" && esAdmin && !esHistorico ? `
                  <button type="button" class="btn btn-primary btn-agregar-formato-norma"
                    data-contenido-id="${escaparDatoDocumento(detalle.id ?? "")}"
                    data-titulo-norma="${escaparDatoDocumento(detalle.titulo ?? "")}">
                    Agregar formato adjunto
                  </button>` : ""}
                ${!esDocumento
                ? `
               `
                : esFormato
                    ? `
          
                        `
                    : ""
            }
              </div>
          
              <div class="d-flex align-items-start gap-3">
                <div class="detalle-card-doc d-flex align-items-center justify-content-between position-relative">
          
                  <div class="d-flex align-items-start gap-3">
                    <div class="icono-hdr mr-2">
                      <i class="${icono}"></i>
                    </div>
          
                    <div class="bloque-inf">
                      ${esAdmin
                ? `<h3 class="titulo-h3 mb-0">${detalle.codigo ?? ""
                }</h3>`
                : ""
            }
                      <h3 class="titulo-h3 mb-1">${esDocumento
                ? quitarExtensionTitulo(detalle.titulo)
                : detalle.titulo ?? ""
            }</h3>
          
                      ${tipo === "NORMA"
                ? `
                          <div class="detalle-meta">Clasificación: ${detalle.clasificacion ?? ""
                }</div>
                          <div class="detalle-meta">
                            Fecha vigencia:
                            ${{
                    ROJO: "#dc3545",
                    AMARILLO: "#ffc107",
                    VERDE: "#28a745",
                }[
                    String(detalle.semaforo ?? "")
                        .trim()
                        .toUpperCase()
                ]
                    ? `<span
                                  role="img"
                                  aria-label="Semáforo ${String(
                        detalle.semaforo
                    )
                        .trim()
                        .toLowerCase()}"
                                  style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${{
                        ROJO: "#dc3545",
                        AMARILLO: "#ffc107",
                        VERDE: "#28a745",
                    }[
                    String(detalle.semaforo)
                        .trim()
                        .toUpperCase()
                    ]
                    };margin:0 6px;vertical-align:middle;"
                                ></span>`
                    : ""
                }
                            ${formatearFechaDetalle(detalle.vigencia)}
                          </div>
                        `
                : `
                          <div class="detalle-meta">
                            Fecha de creación: ${formatearFechaDetalle(
                    fechaCreacion
                )}
                          </div>
                          <div class="detalle-meta">
                          Tipo de documento: ${String(
                    principal.tipo ||
                    obtenerExtensionArchivo(principal.nombre) ||
                    "No disponible"
                ).toUpperCase()}
                          </div>
                          <div class="detalle-meta">Peso: ${tamanio ?? "10px"
                }</div>
                        `
            }
                    </div>
                  </div>
          
                  <div class="detalle-preview position-relative">
                    <i class="bi bi-file-earmark-text"></i>
                    ${botonVistaPreviaNormaPrincipal}
                  </div>
                </div>
              </div>
            `;

        // Conservar la cabecera dentro del contenedor original y antes del título de normas.
        const contenedorTabla = document.querySelector("#tabla-dinamica");
        if (contenedorTabla) {
            contenedorTabla.prepend(bloque);
        } else {
            hrRed.insertAdjacentElement("afterend", bloque);
        }
    }

    function obtenerIconoEncabezado(tipo) {
        if (tipo === "NORMA") {
            return "bi bi-folder";
        }
        if (tipo === "DOCUMENTO" || tipo === "DOCUMENTOS") {
            return "bi bi-paperclip";
        }

        return "bi bi-file-earmark-fill";
    }

    function obtenerRecursosPorTipo(detalle) {
        const tieneNormasAdjuntas = detalle?.tieneNormasAdjuntas === true;

        const tieneFormatosAdjuntos = detalle?.tieneFormatosAdjuntos === true;

        const normasAdjuntas = Array.isArray(detalle?.normasAdjuntas)
            ? detalle.normasAdjuntas
            : [];

        const formatosAdjuntos = Array.isArray(detalle?.formatosAdjuntos)
            ? detalle.formatosAdjuntos
            : [];

        /*
         * Cuando el detalle indica normas adjuntas,
         * la tabla se alimenta de normasAdjuntas.
         */
        if (tieneNormasAdjuntas && normasAdjuntas.length > 0) {
            return normasAdjuntas.map(function (norma) {
                const archivo = norma?.documentoPrincipal || {};

                return {
                    tipoRecursoTabla: "NORMA_ADJUNTA",

                    id: norma?.id ?? "",

                    idPadre: detalle?.id ?? "",

                    contenidoId: norma?.id ?? "",

                    versionId: norma?.versionId ?? "",

                    codigo: norma?.codigo ?? "",

                    titulo: norma?.titulo ?? "",

                    clasificacion: norma?.clasificacion ?? "",

                    fechaVigencia: norma?.fechaVigencia ?? norma?.vigencia ?? "",

                    fhasta: norma?.fhasta ?? "",

                    fechaDesde: norma?.fechaVigencia ?? norma?.vigencia ?? "",

                    fechaHasta: norma?.fhasta ?? "",

                    vigencia: norma?.vigencia ?? "",

                    isUpdate: norma?.isUpdate === true,

                    vigenciaManual: norma?.vigenciaManual === true,

                    renovacion: norma?.renovacion === true,

                    tipoOriginal: norma?.tipo ?? "NORMA_ADJUNTA",

                    idArchivo: archivo?.id ?? "",

                    nombreArchivo: archivo?.nombre ?? "",

                    nombre: norma?.titulo ?? archivo?.nombre ?? norma?.codigo ?? "",

                    tipo:
                        archivo?.tipo ?? obtenerExtensionArchivo(archivo?.nombre) ?? "pdf",

                    tamanio: archivo?.tamanio ?? "",

                    fechaCreacion: norma?.fechaCreacion ?? archivo?.fechaCreacion ?? "",

                    fechaModificacion: norma?.fechaModificacion ?? "",

                    ruta: archivo?.ruta ?? "",

                    documentoPrincipal: archivo,

                    tieneDocumentoPrincipal:
                        norma?.tieneDocumentoPrincipal !== false && !!archivo?.id,

                    descargaPermitida: norma?.descargaPermitida !== false,

                    datosAdjuntos: norma?.datosAdjuntos === true,

                    tieneFormatosAdjuntos: norma?.tieneFormatosAdjuntos === true,

                    semaforo: norma?.semaforo ?? "",
                };
            });
        }

        /*
         * Cuando el detalle indica formatos adjuntos,
         * la tabla se alimenta de formatosAdjuntos.
         */
        if (tieneFormatosAdjuntos && formatosAdjuntos.length > 0) {
            return formatosAdjuntos.map(function (archivo) {
                return {
                    tipoRecursoTabla: "FORMATO_ADJUNTO",

                    id: archivo?.id ?? "",

                    idArchivo: archivo?.id ?? "",

                    nombre: archivo?.nombre ?? "",

                    tipo: archivo?.tipo ?? obtenerExtensionArchivo(archivo?.nombre) ?? "",

                    tamanio: archivo?.tamanio ?? "",

                    fechaCreacion: archivo?.fechaCreacion ?? "",

                    fechaActualizacion: archivo?.fechaActualizacion ?? "",

                    usuarioCreacion: archivo?.usuarioCreacion ?? "",

                    version: archivo?.version ?? "",

                    ruta: archivo?.ruta ?? "",

                    tipoRecurso: archivo?.tipoRecurso ?? "DOCUMENTO",
                };
            });
        }

        return [];
    }

    function obtenerTituloTabla(detalle, total = 0) {
        if (detalle?.tieneNormasAdjuntas === true) {
            return `NORMAS ADJUNTAS`;
        }

        if (detalle?.tieneFormatosAdjuntos === true) {
            return `FORMATOS ADJUNTOS`;
        }

        return `ARCHIVOS ADJUNTOS`;
    }

    function quitarExtensionTitulo(titulo) {
        return String(titulo ?? "").replace(/\.[a-z0-9]+\s*$/i, "");
    }

    function escaparDatoDocumento(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, function (caracter) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[caracter];
        });
    }

    function obtenerExtensionArchivo(nombre) {
        const valor = String(nombre || "")
            .trim()
            .toLowerCase();

        if (!valor || !valor.includes(".")) {
            return "";
        }

        return valor.split(".").pop();
    }

    function formatearFechaDetalle(fecha) {
        if (!fecha) {
            return "";
        }

        const valor = String(fecha).trim();

        const coincidencia = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (coincidencia) {
            const [, anio, mes, dia] = coincidencia;

            return `${dia}-${mes}-${anio}`;
        }

        const fechaObjeto = new Date(valor);

        if (Number.isNaN(fechaObjeto.getTime())) {
            return valor;
        }

        return fechaObjeto.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    function iconoArchivoPorTipo(tipo) {
        const extension = (tipo || "").toLowerCase();

        if (extension.includes("pdf")) return `<i class="bi bi-filetype-pdf"></i>`;
        if (extension.includes("doc") || extension.includes("word"))
            return `<i class="bi bi-filetype-doc"></i>`;
        if (extension.includes("xls") || extension.includes("excel"))
            return `<i class="bi bi-filetype-xls"></i>`;

        return `<i class="bi bi-file-earmark"></i>`;
    }

    function aplicarEstilosDetalleTabla(selector = "#tabla-dinamica") {
        const tabla = document.querySelector(`${selector} table`);

        if (!tabla) return;

        tabla.classList.add("table-hover");
        tabla.style.border = "1px solid #d9dff5";
        tabla.style.borderRadius = "4px";

        tabla.style.overflow = "visible";

        const responsive = document.querySelector(
            `${selector} .table-responsive`
        );

        if (responsive) {
            responsive.style.overflow = "visible";
        }

        tabla.querySelectorAll("thead th").forEach((th) => {
            th.style.fontWeight = "700";
            th.style.background = "#fff";
        });

        tabla.querySelectorAll("tbody tr").forEach((tr, index) => {
            tr.style.background = index % 2 === 0 ? "#f5f5f5" : "#fff";
        });

        tabla.querySelectorAll(".btn-link").forEach((btn) => {
            btn.style.color = "#8a3d62";
            btn.style.textDecoration = "none";
        });
    }

    /*************************************/
    /* EXPONER RECARGA DE TABLA */
    /*************************************/
    window.obtenerInformacionTabla = obtenerInformacionTabla;

    function inicializarDetalleInventario() {
        const contenedor = document.getElementById("tabla-dinamica");
        if (!contenedor) return Promise.resolve();
        const clave = window.location.pathname + window.location.search;
        const anterior = window.detalleInventarioCargasIniciales.get(contenedor);
        if (anterior?.clave === clave) return anterior.promesa;
        const promesa = obtenerInformacionTabla();
        window.detalleInventarioCargasIniciales.set(contenedor, { clave, promesa });
        return promesa;
    }

    if (window.Liferay) {
        window.informacionEventoNavigate = inicializarDetalleInventario;
        window.Liferay.on("endNavigate", window.informacionEventoNavigate);
    }
    await inicializarDetalleInventario();
})();

document.addEventListener("click", function (e) {
    const btnToggleMenu = e.target.closest(".btn-toggle-menu");

    if (btnToggleMenu) {
        e.stopPropagation();

        const wrapper = btnToggleMenu.closest(".menu-acciones-wrapper");
        const cardDoc = btnToggleMenu.closest(".detalle-card-doc");

        const menu = wrapper
            ? wrapper.querySelector(".menu-acciones-card")
            : cardDoc?.querySelector(".detalle-menu-principal");

        if (!menu) return;

        const estabaAbierto = !menu.classList.contains("d-none");

        document.querySelectorAll(".menu-acciones-card").forEach((menuAbierto) => {
            menuAbierto.classList.add("d-none");
        });

        if (!estabaAbierto) {
            menu.classList.remove("d-none");
        }

        return;
    }

    const btnRegresar = e.target.closest(".btn-regresar");

    if (btnRegresar) {
        e.preventDefault();
        window.history.back();
        return;
    }

    const btnHistorico = e.target.closest(".btn-historico");

    if (btnHistorico) {
        const idDocumento =
            btnHistorico.dataset.id ||
            new URLSearchParams(window.location.search).get("id") ||
            "";

        if (!idDocumento) {
            console.warn(
                "No se encontró el identificador para consultar el histórico."
            );
            return;
        }

        const parametros = new URLSearchParams();

        parametros.set("documento-prin", idDocumento);

        window.location.href =
            "/web/normateca/historico" + `?${parametros.toString()}`;

        return;
    }

    const btnPantallaPrincipal = e.target.closest(".btn-pantalla-principal");

    if (btnPantallaPrincipal) {
        window.location.href = "/web/normateca/inicio";
        return;
    }

    const btnVistaPrevia = e.target.closest(".btn-vista-previa");

    if (btnVistaPrevia) {
        console.log("Vista previa temporalmente deshabilitada:", {
            id: btnVistaPrevia.dataset.id,
            ruta: btnVistaPrevia.dataset.ruta,
        });
        return;
    }

    const btnDescargar = e.target.closest(".btn-descargar");

    if (btnDescargar) {
        console.log("Descargar archivo:", {
            id: btnDescargar.dataset.id,
            ruta: btnDescargar.dataset.ruta,
        });
        return;
    }

    const btnEditar = e.target.closest(".btn-editar");

    if (btnEditar) {
        console.log("Actualizar archivo:", btnEditar.dataset.id);
        return;
    }

    const btnEliminar = e.target.closest(".btn-eliminar-formato, .btn-eliminar");

    if (btnEliminar) {
        console.log("Eliminar archivo:", btnEliminar.dataset.id);
        return;
    }

    const btnVistaPreviaPrincipal = e.target.closest(
        ".btn-vista-previa-principal"
    );

    if (btnVistaPreviaPrincipal) {
        console.log("Vista previa principal:", {
            id: btnVistaPreviaPrincipal.dataset.id,
            ruta: btnVistaPreviaPrincipal.dataset.ruta,
        });
        return;
    }

    const btnDescargarPrincipal = e.target.closest(".btn-descargar-principal");

    if (btnDescargarPrincipal) {
        console.log("Descargar principal:", {
            id: btnDescargarPrincipal.dataset.id,
            ruta: btnDescargarPrincipal.dataset.ruta,
        });
        return;
    }

    document.querySelectorAll(".menu-acciones-card").forEach((menu) => {
        menu.classList.add("d-none");
    });
});

