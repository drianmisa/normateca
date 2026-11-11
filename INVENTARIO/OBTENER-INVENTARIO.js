(async () => {
    // Retirar el listener anterior antes de iniciar cualquier petición.
    if (window.Liferay && window.informacionEventoNavigate) {
        window.Liferay.detach("endNavigate", window.informacionEventoNavigate);
    }

    // Cada contenedor tiene una sola carga automática, incluso si Liferay
    // ejecuta otra vez el fragmento o dispara endNavigate durante la carga.
    if (!(window.inventarioCargasIniciales instanceof WeakMap)) {
        window.inventarioCargasIniciales = new WeakMap();
    }

    const rolNORMATECA = window.obtenerRolNORMATECA?.() || null;

    const rolUsuario = rolNORMATECA?.nombre || "";
    const nivelPermiso = Number(rolNORMATECA?.permisos ?? -1);

    const esLectorNORMATECA = nivelPermiso === 1;
    /*
        |--------------------------------------------------------------------------
        | FUNCIÓN PRINCIPAL
        |--------------------------------------------------------------------------
        */

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

    async function obtenerPermisoNormaInventarioTabla(
        contenidoId,
        intentos = 50
    ) {
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

    async function obtenerInformacionTabla() {
        window.mostrarLoaderPeticion();

        try {
            sessionStorage.setItem("functional-id", "CONSULTA INVENTARIO NORMATIVAS");

            if (typeof window.tokenizerTransactionId !== "function") {
                window.ocultarLoaderPeticion();
                return;
            }

            await window.tokenizerTransactionId();

            const response = await window.apiFetch(
                "normativas",
                "/api/v1/inventario/"
            );

            const esAdmin = await obtenerPermisoAdminNormateca();

            const recursos = response?.data?.dataResponse || [];

            const recursosOrdenados = [...recursos].sort((a, b) => {
                const codigoA = String(a.codigo ?? "").toUpperCase();
                const codigoB = String(b.codigo ?? "").toUpperCase();

                const ordenA = codigoA.startsWith("N-")
                    ? 0
                    : codigoA.startsWith("D-")
                        ? 1
                        : 2;

                const ordenB = codigoB.startsWith("N-")
                    ? 0
                    : codigoB.startsWith("D-")
                        ? 1
                        : 2;

                if (ordenA !== ordenB) {
                    return ordenA - ordenB;
                }

                return codigoA.localeCompare(codigoB, undefined, {
                    numeric: true,
                    sensitivity: "base",
                });
            });

            if (typeof window.crearTablaDinamica !== "function") {
                console.error("crearTablaDinamica no existe");

                window.ocultarLoaderPeticion();
                return;
            }

            if (esAdmin) {
                crearBotonCargarNuevo();
            }

            const filas = await Promise.all(
                recursosOrdenados.map(async (item) => {
                    const idDocumento = item.id ?? "";
                    const idArchivoPrincipal = item.documentoPrincipal?.id ?? "";

                    /*
                      |--------------------------------------------------------------------------
                      | BOTÓN ACTUALIZAR SEGÚN EL TIPO
                      |--------------------------------------------------------------------------
                      */

                    const tipoRegistro = (item.tipo || "").toUpperCase();

                    const esNorma = tipoRegistro === "NORMA";
                    const isUpdate = item.isUpdate === true;
                    const vigenciaManual = item.vigenciaManual === true;
                    const clasificacionNormalizada = String(item.clasificacion ?? "")
                        .trim()
                        .toLowerCase();
                    const esClasificacionRestringida =
                        clasificacionNormalizada === "restringida" ||
                        clasificacionNormalizada === "confidencial";
                    const requiereValidarPermisos =
                        !esAdmin && esNorma && esClasificacionRestringida;
                    const permisoNorma = requiereValidarPermisos
                        ? await obtenerPermisoNormaInventarioTabla(
                            item.contenidoId || item.idContenido || idDocumento
                        )
                        : null;
                    const puedeVerNorma =
                        !requiereValidarPermisos ||
                        [true, "true", 1, "1"].includes(permisoNorma?.verPdf);
                    const normaSinPermiso = requiereValidarPermisos && !puedeVerNorma;
                    const estiloFila =
                        esNorma && !esAdmin
                            ? normaSinPermiso
                                ? "background-color: #E9ECEF !important;"
                                : "background-color: #FFFFFF !important;"
                            : "";
                    const estiloFilaClase = (
                        esNorma
                            ? normaSinPermiso
                            : esClasificacionRestringida && esLectorNORMATECA
                    )
                        ? "estilo"
                        : "";

                    const botonEngraneNorma = esNorma
                        ? `
                          <div
                            class="acciones-inventario acciones-norma-externas"
                            data-tipo-registro="${tipoRegistro}"
                            style="display:${isUpdate ? "inline-flex" : "none"
                        } !important;"
                          >
                            <button
                              type="button"
                              class="btn btn-link p-0 editar-norma-inv"
                              data-id="${idDocumento}"
                              data-contenido-id="${idDocumento}"
                              data-codigo="${item.codigo ?? ""}"
                              data-titulo="${item.titulo ?? ""}"
                              data-clasificacion="${(
                            item.clasificacion ?? ""
                        ).toLowerCase()}"
                              data-fecha-vigencia="${item.fechaVigencia ?? item.vigencia ?? ""
                        }"
                                data-fhasta="${item.fhasta ?? ""}"
                                data-fecha-desde="${item.fechaVigencia ?? item.vigencia ?? ""
                        }"
                                data-fecha-hasta="${item.fhasta ?? ""}"
                              data-is-update="${isUpdate}"
                              data-vigencia-manual="${vigenciaManual}"
                              data-archivo-id="${idArchivoPrincipal}"
                              data-nombre-archivo="${item.documentoPrincipal?.nombre ?? ""
                        }"
                              title="Editar norma"
                              aria-label="Editar norma"
                            >
                              <i class="bi bi-gear"></i>
                            </button>
                          </div>
                        `
                        : "";

                    return `  
            ${esAdmin
                            ? `
            <td>
              ${item.codigo ?? ""}
            </td>`
                            : ""
                        }
    
            <td class="${estiloFilaClase}" style="${estiloFila}">
              ${tituloVistaPrevia(item)}
            </td>
    
            <td style="${estiloFila}">
              ${semaforoNormas(item.clasificacion) ?? ""}
            </td>
    
            <td
              class="celda-vigencia-inventario"
              data-tipo-registro="${tipoRegistro}"
              data-vigencia-manual="${vigenciaManual}"
              data-fondo-restringido="${esNorma ? normaSinPermiso : esClasificacionRestringida
                        }"
              style="${estiloFila}
                ${esAdmin && esNorma && isUpdate
                            ? "background-color: #FF9800; color: #FFFFFF;"
                            : ""
                        }
              "
            >
            ${semaforo(
                            formatearFecha(item.vigencia),
                            item.semaforo,
                            esAdmin && esNorma && isUpdate,
                            vigenciaManual
                        )}
            </td>
    
            <td class="${estiloFilaClase}" style="${estiloFila}">
              ${documentosUso(item)}
            </td>
    
            ${esAdmin
                            ? `
                    <td class="text-center">
                      ${esNorma
                                ? `
                              <div class="d-inline-flex align-items-center justify-content-center gap-2">
                              <input
                                type="checkbox"
                                class="check-acciones-inventario"
                                data-id="${idDocumento}"
                                data-tipo-registro="${tipoRegistro}"
                                data-is-update="${isUpdate}"
                                aria-label="Actualizar vigencia"
                                title="Actualizar vigencia"
                                ${isUpdate ? "checked" : ""}
                              >
                              ${botonEngraneNorma}
                              </div>
                            `
                                : ""
                            }
                    </td>
                  `
                            : ""
                        }
          `;
                })
            );

            /*
                |--------------------------------------------------------------------------
                | TÍTULO CON VISTA PREVIA
                |--------------------------------------------------------------------------
                */

            function escaparPropiedadDocumento(valor) {
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

            function datosDocumentoVisor(fila) {
                if (
                    String(fila.tipo ?? "")
                        .trim()
                        .toUpperCase() !== "DOCUMENTO"
                ) {
                    return "";
                }

                return `
            data-extension-archivo="${escaparPropiedadDocumento(
                    fila.documentoPrincipal?.tipo ?? ""
                )}"
            data-peso-archivo="${escaparPropiedadDocumento(
                    fila.documentoPrincipal?.tamanio ?? ""
                )}"
            data-fecha-creacion="${escaparPropiedadDocumento(
                    fila.fechaCreacion ?? ""
                )}"
            `;
            }

            function tituloSinExtensionDocumento(fila) {
                const titulo = fila.titulo ?? "";

                if (
                    String(fila.tipo ?? "")
                        .trim()
                        .toUpperCase() !== "DOCUMENTO"
                ) {
                    return titulo;
                }

                return String(titulo)
                    .replace(/(?:\.\s*[a-z0-9]{1,15})+\s*$/i, "")
                    .trimEnd();
            }

            function tituloVistaPrevia(fila) {
                const idDocumentoPrincipal = fila.documentoPrincipal?.id ?? "";

                const tieneDocumentoPrincipal =
                    fila.tieneDocumentoPrincipal === true && idDocumentoPrincipal !== "";

                if (!tieneDocumentoPrincipal) {
                    return tituloSinExtensionDocumento(fila);
                }

                return `
          <a
            href="#"
            class="llamar-visor"
            data-id="${fila.id ?? ""}"
            data-id-archivo="${idDocumentoPrincipal}"
            data-codigo="${fila.codigo ?? ""}"
            data-titulo="${tituloSinExtensionDocumento(fila)}"
            data-clasificacion="${fila.clasificacion ?? ""}"
            data-vigencia="${fila.vigencia ?? ""}"
            data-semaforo="${fila.semaforo ?? ""}"
            data-tipo="${(fila.tipo ?? "").toUpperCase()}"
            ${datosDocumentoVisor(fila)}
            data-tipo-registro="${(fila.tipo ?? "").toUpperCase()}"
            data-contenido-id="${fila.id ?? ""}"
            data-id-contenido="${fila.id ?? ""}"
            data-documento-id="${idDocumentoPrincipal}"
            data-archivo-id="${idDocumentoPrincipal}"
            data-descarga-permitida="${fila.descargaPermitida === true}"
            data-tiene-documento-principal="${tieneDocumentoPrincipal}"
            data-fecha-vigencia="${fila.fechaVigencia ?? fila.vigencia ?? ""}"
            data-fhasta="${fila.fhasta ?? ""}"
            data-fecha-desde="${fila.fechaVigencia ?? fila.vigencia ?? ""}"
            data-fecha-hasta="${fila.fhasta ?? ""}"
            data-is-update="${fila.isUpdate === true}"
            data-vigencia-manual="${fila.vigenciaManual === true}"
            data-nombre="${fila.documentoPrincipal?.nombre ?? ""}"
            data-nombre-archivo="${fila.documentoPrincipal?.nombre ?? ""}"
            data-datos-adjuntos="${fila.datosAdjuntos === true}"
            data-tiene-formatos-adjuntos="${fila.tieneFormatosAdjuntos === true
                    }"
            title="Vista previa"
            aria-label="Ver ${tituloSinExtensionDocumento(fila) || "documento"}"
          >
            ${tituloSinExtensionDocumento(fila)}
          </a>
        `;
            }

            /*
                |--------------------------------------------------------------------------
                | SEMÁFORO DE CLASIFICACIÓN
                |--------------------------------------------------------------------------
                */

            function semaforoNormas(frase) {
                const colorTexto =
                    frase === "Restringida" || frase === "Confidencial" ? "red" : "green";

                return `
            <span style="color:${colorTexto}">
              ${frase ?? ""}
            </span>
          `;
            }

            /*
                |--------------------------------------------------------------------------
                | SEMÁFORO DE VIGENCIA
                |--------------------------------------------------------------------------
                */

            function semaforo(
                frase,
                color,
                actualizarActivo = false,
                vigenciaManual = false
            ) {
                const colorTexto =
                    color === "rojo" ? "red" : color === "amarillo" ? "#FFC107" : "green";

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

            /*
                |--------------------------------------------------------------------------
                | DOCUMENTOS
                |--------------------------------------------------------------------------
                */

            function documentosUso(fila) {
                const tipo = (fila.tipo || "").toUpperCase();

                const tieneAdjuntos = fila.datosAdjuntos === true;

                const tieneFormatosAdjuntos = fila.tieneFormatosAdjuntos === true;

                if (tipo === "NORMA") {
                    const idNorma = encodeURIComponent(fila.id ?? "");

                    let botonNormasAdjuntas = "";
                    let botonFormatosAdjuntos = "";

                    // Validación independiente: normas adjuntas.
                    if (fila.tieneNormasAdjuntas === true) {
                        botonNormasAdjuntas = `
              <a
                title="Ver normas adjuntas"
                aria-label="Ver normas adjuntas"
                href="/web/normateca/detalle-inventario?id=${idNorma}"
              >
                <i class="bi bi-folder-fill"></i>
              </a>
            `;
                    }

                    // Validación independiente: formatos adjuntos.
                    if (fila.tieneFormatosAdjuntos === true) {
                        botonFormatosAdjuntos = `
              <a
                title="Ver formatos adjuntos"
                aria-label="Ver formatos adjuntos"
                href="/web/normateca/detalle-inventario?id=${idNorma}"
              >
                <i class="bi bi-paperclip"></i>
              </a>
            `;
                    }

                    if (botonNormasAdjuntas || botonFormatosAdjuntos) {
                        return `
              <div class="d-inline-flex align-items-center justify-content-center gap-2">
                ${botonNormasAdjuntas}
                ${botonFormatosAdjuntos}
              </div>
            `;
                    }
                    return `<a title="Ver detalle de norma" href="/web/normateca/detalle-inventario?id=${idNorma}">Ver</a>`;
                }

                if (tipo === "DOCUMENTOS" && tieneAdjuntos) {
                    return `
              <a
                title="Ver formatos"
                href="/web/normateca/detalle-inventario?id=${fila.id}"
              >
                <i class="bi bi-paperclip"></i>
              </a>
            `;
                }

                const idDocumentoPrincipal = fila.documentoPrincipal?.id ?? "";

                const tieneDocumentoPrincipal =
                    fila.tieneDocumentoPrincipal === true && idDocumentoPrincipal !== "";

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
              href="/web/normateca/detalle-inventario?id=${fila.id}"
            >
              <i class="bi bi-paperclip"></i>
            </a>
          `;
                }

                return `
          <a
          href="#"
          class="llamar-visor"
          data-id="${fila.id ?? ""}"
          data-id-archivo="${idDocumentoPrincipal}"
          data-codigo="${fila.codigo ?? ""}"
          data-titulo="${tituloSinExtensionDocumento(fila)}"
          data-clasificacion="${fila.clasificacion ?? ""}"
          data-vigencia="${fila.vigencia ?? ""}"
          data-semaforo="${fila.semaforo ?? ""}"
          data-tipo="${(fila.tipo ?? "").toUpperCase()}"
            ${datosDocumentoVisor(fila)}
          title="Ver documento"
          aria-label="Ver documento"
      >
          Ver
      </a>
          `;
            }

            /*
                |--------------------------------------------------------------------------
                | COLUMNAS
                |--------------------------------------------------------------------------
                */

            const columnas = [
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
                    centerText: true,
                },
                {
                    titulo: "Fecha de vigencia",
                    ordenar: true,
                    centerText: true,
                },
                {
                    titulo: "Documentos",
                    ordenar: true,
                    centerText: true,
                },
            ];

            if (esAdmin) {
                columnas.push({
                    titulo: "Actualizar",
                    ordenar: false,
                });
            }

            /*
                |--------------------------------------------------------------------------
                | CONFIGURACIÓN DE LA TABLA
                |--------------------------------------------------------------------------
                */

            const configuracionTabla = {
                contenedor: "#tabla-dinamica",

                titulo: "Inventario Único de Normativa Interna",

                botonAccion: {
                    mostrar: esAdmin,
                    titulo: "Listado PTA / Nueva norma",
                    icono: "bi bi-plus-circle",
                },

                columnas,
                filas,
            };

            window.crearTablaDinamica(configuracionTabla);

            /*
                |--------------------------------------------------------------------------
                | BITÁCORA
                |--------------------------------------------------------------------------
                */

            if (window.bitacoraService?.operationLog) {
                await window.bitacoraService.operationLog(
                    "GET",
                    "Consultar",
                    "Obtener inventario de normas",
                    "Se consulta el inventarui de normas",
                    response?.data?.statusCode ?? 200,
                    JSON.stringify(response?.data?.message || "Consulta exitosa")
                );
            } else {
                console.warn("bitacoraService no disponible");
            }

            window.ocultarLoaderPeticion();

            return response?.data;
        } catch (e) {
            const idx = e.message?.indexOf("{");

            if (idx !== -1) {
                try {
                    const errorObj = JSON.parse(e.message.substring(idx));

                    if (window.bitacoraService?.operationLog) {
                        await window.bitacoraService.operationLog(
                            "GET",
                            "Consultar",
                            "Obtener inventario de normas",
                            "Se consulta el inventario de normas",
                            errorObj?.errorMessageDTO?.statusCode || 500,
                            errorObj?.errorMessageDTO?.message || "Error desconocido"
                        );
                    }
                } catch (errorParseo) {
                    console.error("No fue posible interpretar el error:", errorParseo);
                }
            }

            console.error("Error al consultar el inventario:", e);

            window.ocultarLoaderPeticion();
        }
    }

    // Método público: permite recargas explícitas después de otras acciones.
    // No utiliza la caché de la carga automática.
    window.obtenerInformacionTabla = obtenerInformacionTabla;

    function inicializarInventario() {
        const contenedor = document.getElementById("tabla-dinamica");
        if (!contenedor) {
            return Promise.resolve();
        }

        const cargas = window.inventarioCargasIniciales;
        const cargaExistente = cargas.get(contenedor);
        if (cargaExistente) {
            return cargaExistente;
        }

        // Guardar la promesa antes de ejecutar el tokenizer y el GET.
        const carga = Promise.resolve().then(() => obtenerInformacionTabla());
        cargas.set(contenedor, carga);
        return carga;
    }

    if (!window.Liferay) {
        console.error("Liferay no está disponible");
        return;
    }

    window.informacionEventoNavigate = function () {
        return inicializarInventario();
    };
    window.Liferay.on("endNavigate", window.informacionEventoNavigate);

    await inicializarInventario();
})();

/*
    |--------------------------------------------------------------------------
    | BOTÓN CARGAR NUEVO
    |--------------------------------------------------------------------------
    */

function crearBotonCargarNuevo() {
    const contenedor = document.getElementById("contenedor-boton-accion-tab");

    if (!contenedor) {
        return;
    }

    if (document.getElementById("btn-cargar-nuevo")) {
        return;
    }

    contenedor.classList.remove("justify-content-end");

    contenedor.classList.add("justify-content-between");

    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "btn btn-primary";
    boton.id = "btn-cargar-nuevo";

    boton.innerHTML = `
      <i class="bi bi-plus-circle"></i>
      Cargar nuevo documento
    `;

    contenedor.insertBefore(boton, contenedor.firstChild);
}

function formatearFecha(fecha) {
    if (!fecha) {
        return "";
    }

    const soloFecha = String(fecha).split("T")[0];
    const partes = soloFecha.split("-");

    if (partes.length !== 3) {
        return fecha;
    }

    const [anio, mes, dia] = partes;

    return `${dia}-${mes}-${anio}`;
}
