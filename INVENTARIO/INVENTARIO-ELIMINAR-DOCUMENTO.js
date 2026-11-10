/*************************************/
/* ESTADO ELIMINACIÓN DOCUMENTO */
/*************************************/
let eliminacionDocumentoEnProceso = false;

/*************************************/
/* CONFIGURACIÓN */
/*************************************/
const configuracionEliminarDocumento = {
    endpoint: "/api/v1/inventario/documentos/:contenidoId/archivo",

    functionalId: "Eliminar archivo de documento",

    moduloBitacora: "INVENTARIO",

    accionBitacora: "Eliminar archivo",

    descripcionBitacora: "Se eliminar el archivo principal del documento",
};

/*************************************/
/* OBTENER MENSAJE DE ERROR */
/*************************************/
function obtenerMensajeErrorEliminarDocumento(
    error,
    mensajePorDefecto = "No fue posible eliminar el documento."
) {
    if (!error) {
        return mensajePorDefecto;
    }

    if (error?.response?.errorMessageDTO?.message) {
        return error.response.errorMessageDTO.message;
    }

    if (error?.response?.errorMessageDTO?.detail) {
        return error.response.errorMessageDTO.detail;
    }

    if (error?.response?.message) {
        return error.response.message;
    }

    if (error?.data?.errorMessageDTO?.message) {
        return error.data.errorMessageDTO.message;
    }

    if (error?.data?.errorMessageDTO?.detail) {
        return error.data.errorMessageDTO.detail;
    }

    if (error?.data?.message) {
        return error.data.message;
    }

    if (error?.message) {
        const mensaje = String(error.message);

        const indiceJson = mensaje.indexOf("{");

        if (indiceJson !== -1) {
            try {
                const errorObj = JSON.parse(mensaje.substring(indiceJson));

                return (
                    errorObj?.errorMessageDTO?.message ||
                    errorObj?.errorMessageDTO?.detail ||
                    errorObj?.message ||
                    mensajePorDefecto
                );
            } catch (parseError) {
                console.warn(
                    "[ELIMINAR DOCUMENTO] No fue posible interpretar el error:",
                    parseError
                );
            }
        }

        return mensaje;
    }

    return mensajePorDefecto;
}

/*************************************/
/* OBTENER STATUS CODE */
/*************************************/
function obtenerStatusCodeEliminarDocumento(error, statusPorDefecto = 500) {
    return Number(
        error?.response?.errorMessageDTO?.statusCode ||
        error?.response?.statusCode ||
        error?.data?.errorMessageDTO?.statusCode ||
        error?.data?.statusCode ||
        error?.statusCode ||
        error?.status ||
        statusPorDefecto
    );
}

/*************************************/
/* REGISTRAR BITÁCORA */
/*************************************/
async function registrarBitacoraEliminarDocumento({
    contenidoId,
    codigo = "",
    statusCode = 500,
    mensaje = "",
} = {}) {
    if (
        !window.bitacoraService ||
        typeof window.bitacoraService.operationLog !== "function"
    ) {
        console.warn(
            "[ELIMINAR DOCUMENTO] El servicio de bitácora no está disponible."
        );

        return;
    }

    const descripcion =
        `${configuracionEliminarDocumento.descripcionBitacora}. ` +
        `ContenidoId: ${contenidoId}` +
        (codigo ? `. Código: ${codigo}` : "");

    try {
        await window.bitacoraService.operationLog(
            "DELETE",
            configuracionEliminarDocumento.moduloBitacora,
            configuracionEliminarDocumento.accionBitacora,
            descripcion,
            Number(statusCode || 500),
            mensaje || ""
        );
    } catch (error) {
        console.warn(
            "[ELIMINAR DOCUMENTO] No fue posible registrar la bitácora:",
            error
        );
    }
}

/*************************************/
/* MOSTRAR RESULTADO */
/*************************************/
function mostrarResultadoEliminarDocumento({
    tipo = "Aceptar",
    titulo = "Completado",
    mensaje = "",
    recargarPagina = false,
} = {}) {
    setTimeout(function () {
        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }

        if (typeof window.abrirModal !== "function") {
            return;
        }

        window.abrirModal({
            paso: 2,
            tipo,
            titulo,
            contenido:
                mensaje ||
                (tipo === "Error"
                    ? "No fue posible eliminar."
                    : "Registro eliminado correctamente."),
            btnAceptar: "Cerrar",
        });

        /*
         * Sólo el modal exitoso debe recargar.
         * El evento se agrega directamente al botón
         * generado por este modal.
         */
        if (!recargarPagina) {
            return;
        }

        requestAnimationFrame(function () {
            const botonCerrarResultado = document.getElementById("btn-aceptar");

            if (!botonCerrarResultado) {
                console.error(
                    "[ELIMINAR DOCUMENTO] No se encontró el botón para cerrar el modal exitoso."
                );

                return;
            }

            botonCerrarResultado.addEventListener(
                "click",
                function () {
                    window.location.reload();
                },
                {
                    once: true,
                }
            );
        });
    }, 500);
}

/*************************************/
/* ELIMINAR DOCUMENTO */
/*************************************/
async function eliminarDocumento({
    contenidoId,
    codigo = "",
    titulo = "",
} = {}) {
    if (eliminacionDocumentoEnProceso) {
        return;
    }

    if (!contenidoId) {
        mostrarResultadoEliminarDocumento({
            tipo: "Error",
            titulo: "Error",
            mensaje: "No se encontró el identificador del contenido.",
        });

        return;
    }

    setTimeout(function () {
        if (typeof window.abrirModal !== "function") {
            console.error(
                "[ELIMINAR DOCUMENTO] No se encontró la función abrirModal."
            );

            return;
        }

        window.abrirModal({
            paso: 1,

            titulo: "Eliminar documento",

            contenido: codigo
                ? `¿Deseas eliminar el archivo del documento ${codigo}?`
                : "¿Deseas eliminar el archivo de este documento?",

            contenido1: "Esta acción no se puede deshacer.",

            btnAceptar: "Aceptar",

            btnCerrar: "Cancelar",

            onAceptar: async function (ok) {
                if (!ok) {
                    return;
                }

                if (eliminacionDocumentoEnProceso) {
                    return;
                }

                eliminacionDocumentoEnProceso = true;

                if (typeof window.mostrarLoaderPeticion === "function") {
                    window.mostrarLoaderPeticion();
                }

                try {
                    sessionStorage.setItem(
                        "functional-id",
                        configuracionEliminarDocumento.functionalId
                    );

                    if (typeof window.tokenizerTransactionId !== "function") {
                        throw new Error("No se encontró tokenizerTransactionId.");
                    }

                    await window.tokenizerTransactionId();

                    const endpoint = configuracionEliminarDocumento.endpoint.replace(
                        ":contenidoId",
                        encodeURIComponent(contenidoId)
                    );

                    const response = await window.apiDelete("normativas", endpoint);

                    /*
                     * apiDelete puede devolver:
                     * - { ok, data }
                     * - una respuesta directa con dataResponse
                     */
                    const responseOk = response?.ok !== undefined ? response.ok : true;

                    if (!responseOk) {
                        const error = new Error(
                            response?.data?.message ||
                            response?.message ||
                            "No fue posible eliminar el documento."
                        );

                        error.statusCode =
                            response?.data?.statusCode || response?.status || 500;

                        error.response = response?.data || response;

                        throw error;
                    }

                    const resultado = response?.data || response || {};

                    const statusCode = resultado?.statusCode || response?.status || 200;

                    if (Number(statusCode) >= 400) {
                        const error = new Error(
                            resultado?.errorMessageDTO?.message ||
                            resultado?.errorMessageDTO?.detail ||
                            resultado?.message ||
                            "No fue posible eliminar el documento."
                        );

                        error.statusCode =
                            resultado?.errorMessageDTO?.statusCode || statusCode;

                        error.response = resultado;

                        throw error;
                    }

                    const mensajeExito =
                        resultado?.message ||
                        "El archivo del documento se eliminó correctamente.";

                    await registrarBitacoraEliminarDocumento({
                        contenidoId,
                        codigo,
                        statusCode,
                        mensaje: mensajeExito,
                    });

                    mostrarResultadoEliminarDocumento({
                        tipo: "Aceptar",

                        titulo: "Completado",

                        mensaje: mensajeExito,

                        recargarPagina: true,
                    });
                } catch (error) {
                    console.error("[ELIMINAR DOCUMENTO] Error:", error);

                    const statusCode = obtenerStatusCodeEliminarDocumento(error);

                    const mensajeError = obtenerMensajeErrorEliminarDocumento(error);

                    await registrarBitacoraEliminarDocumento({
                        contenidoId,
                        codigo,
                        statusCode,
                        mensaje: mensajeError,
                    });

                    mostrarResultadoEliminarDocumento({
                        tipo: "Error",

                        titulo: "Error",

                        mensaje: mensajeError,
                    });
                } finally {
                    eliminacionDocumentoEnProceso = false;
                }
            },
        });
    }, 500);
}

/*************************************/
/* CLICK ELIMINAR */
/*************************************/
const claveEventoEliminarDocumento = "eventoEliminarDocumentoInventario";

if (window[claveEventoEliminarDocumento] !== true) {
    window[claveEventoEliminarDocumento] = true;

    document.addEventListener("click", function (event) {
        const boton = event.target.closest(
            ".btn-eliminar-formato.eliminar-registro-inventario"
        );

        if (!boton) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const contenidoId =
            boton.dataset.contenidoId ||
            boton.dataset.idContenido ||
            boton.dataset.id ||
            "";

        const codigo = boton.dataset.codigo || "";

        const titulo = boton.dataset.titulo || "";

        eliminarDocumento({
            contenidoId,
            codigo,
            titulo,
        });
    });
}
