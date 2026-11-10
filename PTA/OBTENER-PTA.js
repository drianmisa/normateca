(async () => {
    /*
            |--------------------------------------------------------------------------
            | FUNCIÓN PRINCIPAL
            |--------------------------------------------------------------------------
            */

    async function usuarioEsAdminNormateca() {
        try {
            if (typeof window.usuarioEsAdminNormateca === "function") {
                return Boolean(await window.usuarioEsAdminNormateca());
            }
            const grupos = JSON.parse(sessionStorage.getItem("userGroups") || "[]");
            return (
                Array.isArray(grupos) &&
                grupos.some((grupo) => {
                    const codigo = String(grupo?.codigo || "")
                        .trim()
                        .toLowerCase();
                    return (
                        codigo === "normateca-admin" ||
                        codigo === "normateca-admin-principal"
                    );
                })
            );
        } catch (error) {
            console.error("No fue posible validar el administrador:", error);
            return false;
        }
    }

    /*
            |--------------------------------------------------------------------------
            | NORMALIZAR TEXTO
            |--------------------------------------------------------------------------
            */

    function normalizarTexto(valor) {
        return String(valor || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    /*
            |--------------------------------------------------------------------------
            | FORMATEAR FECHA
            |--------------------------------------------------------------------------
            |
            | Convierte:
            | 2026-07-31T10:43:09
            |
            | En:
            | 31-07-2026
            |--------------------------------------------------------------------------
            */

    function formatearFecha(fecha) {
        if (!fecha) {
            return "";
        }

        const fechaTexto = String(fecha).trim();
        const coincidencia = fechaTexto.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (!coincidencia) {
            return fechaTexto;
        }

        const [, anio, mes, dia] = coincidencia;

        return `${dia}-${mes}-${anio}`;
    }

    /*
            |--------------------------------------------------------------------------
            | COLOR SEGÚN CLASIFICACIÓN
            |--------------------------------------------------------------------------
            |
            | Pública       = Verde
            | Confidencial  = Rojo
            | Restringida   = Rojo
            |--------------------------------------------------------------------------
            */

    function obtenerColorClasificacion(clasificacion) {
        const valor = normalizarTexto(clasificacion);

        if (valor === "publica") {
            return "green";
        }

        if (valor === "confidencial" || valor === "restringida") {
            return "red";
        }

        return "inherit";
    }

    /*
            |--------------------------------------------------------------------------
            | PINTAR CLASIFICACIÓN
            |--------------------------------------------------------------------------
            */

    function pintarClasificacion(clasificacion) {
        const color = obtenerColorClasificacion(clasificacion);

        return `
              <span
                style="
                  color: ${color};
                  font-weight: 600;
                "
              >
                ${clasificacion ?? ""}
              </span>
            `;
    }

    /*
            |--------------------------------------------------------------------------
            | COLOR DEL TEXTO SEGÚN SEMÁFORO
            |--------------------------------------------------------------------------
            |
            | VERDE     = Texto verde
            | AMARILLO  = Texto amarillo
            | ROJO      = Texto rojo
            |--------------------------------------------------------------------------
            */

    function obtenerColorSemaforo(semaforo) {
        const valor = normalizarTexto(semaforo);

        if (valor === "verde") {
            return "#198754";
        }

        if (valor === "amarillo") {
            return "#FFC107";
        }

        if (valor === "rojo") {
            return "#DC3545";
        }

        return "inherit";
    }

    /*
            |--------------------------------------------------------------------------
            | PINTAR FECHA DE VIGENCIA
            |--------------------------------------------------------------------------
            |
            | Únicamente cambia el color del texto.
            |--------------------------------------------------------------------------
            */

    function pintarFechaVigencia(fechaVigencia, semaforo) {
        const color = obtenerColorSemaforo(semaforo);

        return `
              <span
                title="Semáforo: ${semaforo ?? "Sin información"}"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 26px;
                  color: inherit;
                  font-weight: normal;
                "
              >
                <span
                  aria-hidden="true"
                  style="
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    flex: 0 0 10px;
                    border-radius: 50%;
                    background-color: ${color};
                    border: 1px solid rgba(0, 0, 0, 0.12);
                  "
                ></span>
          
                <span>
                  ${formatearFecha(fechaVigencia)}
                </span>
              </span>
            `;
    }
    async function obtenerPermisoNormaTablaPTA(contenidoId, intentos = 50) {
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

    // Preparado para integrar la acción de detener versionamiento.
    // No se deduce su estado de isUpdate ni de vigenciaManual.
    function crearCheckDetenerVersionamiento(item) {
        const escaparAtributo = (valor) => String(valor ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/'/g, "&#39;");
        const contenidoId = item.contenidoId ?? item.idContenido ?? item.id ?? "";
        const atributos = {
            "id": item.id ?? contenidoId,
            "contenido-id": contenidoId,
            "version-id": item.versionId ?? "",
            "codigo": item.codigo ?? "",
            "titulo": item.titulo ?? "",
            "tipo": item.tipo ?? "NORMA",
            "documento-id": item.documentoPrincipal?.id ?? "",
            "is-update": item.isUpdate ?? "",
            "vigencia-manual": item.vigenciaManual ?? "",
            "renovacion": item.renovacion ?? "",
            "fecha-vigencia": item.fechaVigencia ?? item.vigencia ?? "",
            "fhasta": item.fhasta ?? "",
            "fecha-modificacion": item.fechaModificacion ?? "",
            // Conserva la respuesta completa, incluidos adjuntos y permisos.
            "norma": JSON.stringify(item),
        };
        return `<input type="checkbox"
      class="check-detener-versionamiento"
      aria-label="${escaparAtributo(`Detener versionamiento de ${item.titulo ?? item.codigo ?? contenidoId}`)}"
      ${Object.entries(atributos).map(([nombre, valor]) =>
            `data-${nombre}="${escaparAtributo(valor)}"`
        ).join(" ")}
    >`;
    }

    async function obtenerInformacionTabla() {
        window.mostrarLoaderPeticion();

        try {
            /*
                    |--------------------------------------------------------------------------
                    | IDENTIFICADOR FUNCIONAL PTA
                    |--------------------------------------------------------------------------
                    */

            sessionStorage.setItem("functional-id", "CONSULTA LISTADO PTA");

            if (typeof window.tokenizerTransactionId !== "function") {
                console.error("tokenizerTransactionId no está disponible");

                window.ocultarLoaderPeticion();
                return;
            }

            await window.tokenizerTransactionId();

            /*
                    |--------------------------------------------------------------------------
                    | CONSULTAR LISTADO PTA
                    |--------------------------------------------------------------------------
                    */

            const response = await window.apiFetch(
                "normativas",
                "/api/v1/masiva-pta/pta"
            );

            const dataResponse = response?.data?.dataResponse;

            const recursos = Array.isArray(dataResponse) ? dataResponse : [];

            if (typeof window.crearTablaDinamica !== "function") {
                console.error("crearTablaDinamica no existe");

                window.ocultarLoaderPeticion();
                return;
            }

            /*
                    |--------------------------------------------------------------------------
                    | FILAS PTA
                    |--------------------------------------------------------------------------
                    |
                    | La tabla muestra:
                    |
                    | 1. Código
                    | 2. Nombre
                    | 3. Clasificación
                    | 4. Fecha de vigencia
                    |--------------------------------------------------------------------------
                    */

            const esAdmin = await usuarioEsAdminNormateca();
            const filas = await Promise.all(
                recursos.map(async (item) => {
                    const esNorma =
                        String(item.tipo ?? "NORMA")
                            .trim()
                            .toUpperCase() === "NORMA";
                    const clasificacion = normalizarTexto(item.clasificacion);
                    const requierePermiso =
                        !esAdmin &&
                        esNorma &&
                        (clasificacion === "restringida" ||
                            clasificacion === "confidencial");
                    const permiso = requierePermiso
                        ? await obtenerPermisoNormaTablaPTA(
                            item.contenidoId ?? item.idContenido ?? item.id
                        )
                        : null;
                    const sinPermiso =
                        requierePermiso &&
                        ![true, "true", 1, "1"].includes(permiso?.verPdf);
                    const estiloFila =
                        esNorma && !esAdmin
                            ? `background-color: ${sinPermiso ? "#E9ECEF" : "#FFFFFF"
                            } !important;`
                            : "";
                    return `
                    ${esAdmin
                            ? `<td>
                      ${item.codigo ?? ""}
                    </td>`
                            : ""
                        }
                
                    <td style="${estiloFila}">
                      ${tituloVistaPrevia(item)}
                    </td>
                
                    <td style="${estiloFila}">
                      ${item.clasificacion}
                    </td>
                
                    <td style="${estiloFila}">
                      ${pintarFechaVigencia(item.vigencia, item.semaforo)}
                    </td>
                    ${esAdmin
                            ? `<td>${crearCheckDetenerVersionamiento(item)}</td>`
                            : ""
                        }
                
                  `;
                })
            );

            /*
                    |--------------------------------------------------------------------------
                    | COLUMNAS PTA
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
                    titulo: "Nombre",
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
                    ? [{ titulo: "Detener versionamiento", ordenar: false }]
                    : []),
            ];

            /*
                    |--------------------------------------------------------------------------
                    | CONFIGURACIÓN DE TABLA PTA
                    |--------------------------------------------------------------------------
                    */

            const configuracionTabla = {
                contenedor: "#tabla-dinamica",

                titulo: "Programa Anual de Trabajo (PTA)",

                columnas,
                filas,
            };

            window.crearTablaDinamica(configuracionTabla);

            /*
                    |--------------------------------------------------------------------------
                    | BITÁCORA PTA
                    |--------------------------------------------------------------------------
                    */

            if (window.bitacoraService?.operationLog) {
                await window.bitacoraService.operationLog(
                    "GET",
                    "Consultar",
                    "Obtener listado de PTA",
                    "Se consulta el programa anual de trabajo",
                    response?.data?.statusCode ?? 200,
                    JSON.stringify(
                        response?.data?.message || "Consulta del listado PTA exitosa"
                    )
                );
            } else {
                console.warn("bitacoraService no disponible");
            }

            window.ocultarLoaderPeticion();

            return response?.data;
        } catch (e) {
            console.error("Error al consultar el listado PTA:", e);

            let statusCode = 500;

            let mensajeError =
                e?.message || "Error desconocido al consultar el listado PTA";

            const idx = typeof e?.message === "string" ? e.message.indexOf("{") : -1;

            if (idx !== -1) {
                try {
                    const errorObj = JSON.parse(e.message.substring(idx));

                    statusCode =
                        errorObj?.errorMessageDTO?.statusCode ||
                        errorObj?.statusCode ||
                        500;

                    mensajeError =
                        errorObj?.errorMessageDTO?.message ||
                        errorObj?.message ||
                        mensajeError;
                } catch (errorParseo) {
                    console.error("No fue posible interpretar el error:", errorParseo);
                }
            }

            /*
                    |--------------------------------------------------------------------------
                    | BITÁCORA DE ERROR PTA
                    |--------------------------------------------------------------------------
                    */

            if (window.bitacoraService?.operationLog) {
                try {
                    await window.bitacoraService.operationLog(
                        "GET",
                        "Consultar",
                        "Obtener listado PTA",
                        "Error al consultar el programa anual de trabajo",
                        statusCode,
                        mensajeError
                    );
                } catch (errorBitacora) {
                    console.error(
                        "No fue posible registrar el error en bitácora:",
                        errorBitacora
                    );
                }
            }

            window.ocultarLoaderPeticion();
        }
    }

    /*
            |--------------------------------------------------------------------------
            | EXPONER FUNCIÓN GLOBAL
            |--------------------------------------------------------------------------
            */

    window.obtenerInformacionTabla = obtenerInformacionTabla;

    /*
            |--------------------------------------------------------------------------
            | LIFERAY
            |--------------------------------------------------------------------------
            */

    if (!window.Liferay) {
        console.error("Liferay no está disponible");

        return;
    }

    /*
            |--------------------------------------------------------------------------
            | EJECUCIÓN INMEDIATA
            |--------------------------------------------------------------------------
            */

    await obtenerInformacionTabla();

    /*
            |--------------------------------------------------------------------------
            | LIMPIAR EVENTOS ANTERIORES
            |--------------------------------------------------------------------------
            */

    if (window.informacionEventoNavigate) {
        Liferay.detach("endNavigate", window.informacionEventoNavigate);
    }

    /*
            |--------------------------------------------------------------------------
            | NAVEGACIÓN SPA
            |--------------------------------------------------------------------------
            */

    window.informacionEventoNavigate = async function () {
        await obtenerInformacionTabla();
    };

    Liferay.on("endNavigate", window.informacionEventoNavigate);
})();

function tituloVistaPrevia(fila) {
    const idContenido = fila.contenidoId ?? fila.idContenido ?? fila.id ?? "";

    const idDocumentoPrincipal =
        fila.documentoPrincipal?.id ??
        fila.idArchivo ??
        fila.archivoId ??
        fila.documentoId ??
        "";

    const titulo = fila.tituloNorma ?? fila.titulo ?? "";

    const tieneDocumentoPrincipal =
        fila.tieneDocumentoPrincipal === true || idDocumentoPrincipal !== "";

    if (!tieneDocumentoPrincipal) {
        return titulo;
    }

    const tipoRegistro = String(fila.tipo ?? "NORMA").toUpperCase();

    const nombreArchivo =
        fila.documentoPrincipal?.nombre ?? fila.nombreArchivo ?? fila.nombre ?? "";

    return `
        <a
          href="#"
          class="llamar-visor"
          data-id="${fila.id ?? idContenido}"
          data-id-archivo="${idDocumentoPrincipal}"
          data-id-registro="${fila.idRegistro ?? idContenido}"
          data-version-id="${fila.versionId ?? ""}"
          data-fecha-modificacion="${fila.fechaModificacion ?? ""}"
          data-renovacion="${fila.renovacion === true}"
          data-extension-archivo="${fila.extensionArchivo ??
        fila.documentoPrincipal?.extensionArchivo ??
        ""
        }"
          data-peso-archivo="${fila.pesoArchivo ?? fila.documentoPrincipal?.pesoArchivo ?? ""
        }"
          data-fecha-creacion="${fila.fechaCreacion ?? ""}"
          data-codigo="${fila.codigo ?? ""}"
          data-titulo="${fila.titulo ?? titulo}"
          data-titulo-norma="${fila.tituloNorma ?? titulo}"
          data-clasificacion="${fila.clasificacion ?? ""}"
          data-vigencia="${fila.vigencia ?? ""}"
          data-semaforo="${fila.semaforo ?? ""}"
          data-tipo="${tipoRegistro}"
          data-tipo-registro="${tipoRegistro}"
          data-contenido-id="${idContenido}"
          data-id-contenido="${idContenido}"
          data-documento-id="${idDocumentoPrincipal}"
          data-archivo-id="${idDocumentoPrincipal}"
          data-descarga-permitida="${fila.descargaPermitida === true}"
          data-tiene-documento-principal="${tieneDocumentoPrincipal}"
          data-fecha-desde="${fila.fechaDesde ?? fila.fechaInicio ?? ""}"
          data-fecha-hasta="${fila.vigencia ?? ""}"
          data-is-update="${fila.isUpdate === true}"
          data-vigencia-manual="${fila.vigenciaManual === true}"
          data-nombre="${nombreArchivo}"
          data-nombre-archivo="${nombreArchivo}"
          data-datos-adjuntos="${fila.datosAdjuntos === true}"
          data-tiene-formatos-adjuntos="${fila.tieneFormatosAdjuntos === true}"
          title="Vista previa"
          aria-label="Ver ${titulo || "documento"}"
        >
          ${titulo}
        </a>
      `;
}