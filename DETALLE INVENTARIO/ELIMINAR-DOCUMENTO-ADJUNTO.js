/*************************************/
/* ESTADO ELIMINAR FORMATO INVENTARIO */
/*************************************/
let eliminarFormatoInventarioEnProceso = false;

/*************************************/
/* BUSCAR DOCUMENTO PADRE EN EL VISOR */
/*************************************/
function buscarDocumentoPadreInventario(contenidoId, documentoId) {
    const botonesVisor = document.querySelectorAll(
        ".btn-vista-previa-inventario.llamar-visor"
    );

    return Array.from(botonesVisor).find(function (boton) {
        const datos = boton.dataset;

        const tipo = String(
            datos.tipoRegistro || datos.tipo || ""
        ).toUpperCase();

        const idContenido =
            datos.contenidoId ||
            datos.idContenido ||
            datos.idRegistro ||
            datos.id ||
            "";

        const idArchivo =
            datos.documentoId ||
            datos.idArchivo ||
            datos.archivoId ||
            "";

        return (
            tipo === "DOCUMENTO" &&
            String(idContenido) === String(contenidoId) &&
            String(idArchivo) === String(documentoId)
        );
    }) || null;
}

/*************************************/
/* ELIMINAR FORMATO INVENTARIO */
/*************************************/
async function eliminarFormatoInventario(contenidoId, documentoId) {
    if (eliminarFormatoInventarioEnProceso) {
        return;
    }

    if (!contenidoId || !documentoId) {
        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: !contenidoId
                ? "No se encontró el identificador del contenido."
                : "No se encontró el identificador del documento.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    const botonDocumentoPadre = buscarDocumentoPadreInventario(
        contenidoId,
        documentoId
    );

    const esDocumentoPadre = Boolean(botonDocumentoPadre);

    const tituloDocumento =
        botonDocumentoPadre?.dataset.tituloNorma ||
        botonDocumentoPadre?.dataset.titulo ||
        "";

    const functionalId = esDocumentoPadre
        ? "Eliminar archivo de documento"
        : "Eliminar formato inventario";

    const accionBitacora = esDocumentoPadre
        ? "Eliminar archivo"
        : "Eliminar formato inventario";

    const descripcionBitacora = esDocumentoPadre
        ? `Eliminación del archivo principal del documento: ${tituloDocumento || contenidoId
        }`
        : `Eliminación formato inventario contenidoId: ${contenidoId}, documentoId: ${documentoId}`;

    const endpoint = esDocumentoPadre
        ? `/api/v1/inventario/documentos/${encodeURIComponent(contenidoId)}/archivo`
        : `/api/v1/inventario/documentos/${encodeURIComponent(
            contenidoId
        )}/formatos/${encodeURIComponent(documentoId)}`;

    eliminarFormatoInventarioEnProceso = true;

    setTimeout(() => {
        abrirModal({
            paso: 1,
            titulo: esDocumentoPadre
                ? "Eliminar documento"
                : "Eliminar registro",
            contenido: esDocumentoPadre
                ? "¿Deseas eliminar el archivo principal de este documento?"
                : "¿Deseas eliminar este formato?",
            contenido1: "Esta acción no se puede deshacer.",
            btnAceptar: "Aceptar",
            btnCerrar: "Cancelar",

            onAceptar: async (ok) => {
                if (!ok) {
                    eliminarFormatoInventarioEnProceso = false;
                    return;
                }

                window.mostrarLoaderPeticion();

                try {
                    sessionStorage.setItem("functional-id", functionalId);

                    /*************************************/
                    /* TOKEN */
                    /*************************************/
                    await window.tokenizerTransactionId();

                    /*************************************/
                    /* ELIMINAR */
                    /*************************************/
                    const response = await window.apiDelete(
                        "normativas",
                        endpoint
                    );

                    const resultado = response?.data || response || {};

                    const statusCode = Number(
                        resultado?.errorMessageDTO?.statusCode ||
                        resultado?.statusCode ||
                        response?.status ||
                        200
                    );

                    if (
                        !response ||
                        response?.ok === false ||
                        statusCode >= 400
                    ) {
                        const error = new Error(
                            typeof resultado === "string"
                                ? resultado
                                : resultado?.errorMessageDTO?.message ||
                                resultado?.message ||
                                "No fue posible eliminar el archivo."
                        );

                        error.statusCode = statusCode >= 400 ? statusCode : 500;
                        throw error;
                    }

                    /*************************************/
                    /* BITÁCORA OK */
                    /*************************************/
                    try {
                        await window.bitacoraService.operationLog(
                            "DELETE",
                            "Inventario",
                            accionBitacora,
                            descripcionBitacora,
                            statusCode,
                            JSON.stringify(
                                resultado?.message ||
                                "Archivo de inventario eliminado correctamente"
                            )
                        );
                    } catch (errorBitacora) {
                        console.error(
                            "No fue posible registrar la eliminación en bitácora:",
                            errorBitacora
                        );
                    }

                    window.ocultarLoaderPeticion();

                    /*************************************/
                    /* MODAL OK */
                    /*************************************/
                    setTimeout(() => {
                        let salidaRealizada = false;
                        let temporizadorSalida = null;

                        function salirDespuesDeEliminar() {
                            if (salidaRealizada) {
                                return;
                            }

                            salidaRealizada = true;
                            clearTimeout(temporizadorSalida);

                            if (esDocumentoPadre) {
                                window.location.assign("/web/normateca/inventario");
                            } else {
                                window.location.reload();
                            }
                        }

                        abrirModal({
                            paso: 2,
                            tipo: "Aceptar",
                            titulo: "Completado",
                            contenido: esDocumentoPadre
                                ? "El archivo principal del documento se eliminó correctamente."
                                : "Formato eliminado correctamente",
                            btnAceptar: esDocumentoPadre ? "Aceptar" : "Cerrar",
                        });

                        // El documento padre también redirige automáticamente.
                        if (esDocumentoPadre) {
                            temporizadorSalida = setTimeout(
                                salirDespuesDeEliminar,
                                2000
                            );
                        }

                        requestAnimationFrame(function () {
                            const botonCerrarResultado =
                                document.getElementById("btn-aceptar");

                            if (!botonCerrarResultado) {
                                console.error(
                                    "[ELIMINAR FORMATO] No se encontró el botón del modal exitoso."
                                );
                                return;
                            }

                            botonCerrarResultado.addEventListener(
                                "click",
                                salirDespuesDeEliminar,
                                { once: true }
                            );
                        });
                    }, 500);
                } catch (e) {
                    /*************************************/
                    /* BITÁCORA ERROR */
                    /*************************************/
                    let statusCode = Number(e?.statusCode || 500);
                    let mensajeError = String(e?.message || "Error desconocido");

                    try {
                        const inicioJson = mensajeError.indexOf("{");

                        if (inicioJson !== -1) {
                            const errorObj = JSON.parse(
                                mensajeError.substring(inicioJson)
                            );

                            statusCode =
                                errorObj?.errorMessageDTO?.statusCode ||
                                errorObj?.statusCode ||
                                statusCode;

                            mensajeError =
                                errorObj?.errorMessageDTO?.message ||
                                errorObj?.message ||
                                mensajeError;
                        }
                    } catch (errorParseo) {
                        console.error(
                            "No fue posible interpretar el error de eliminación:",
                            errorParseo
                        );
                    }

                    try {
                        await window.bitacoraService.operationLog(
                            "DELETE",
                            "inventario",
                            accionBitacora,
                            descripcionBitacora,
                            statusCode,
                            mensajeError
                        );
                    } catch (errorBitacora) {
                        console.error(
                            "No fue posible registrar el error en bitácora:",
                            errorBitacora
                        );
                    }

                    window.ocultarLoaderPeticion();
                    eliminarFormatoInventarioEnProceso = false;

                    setTimeout(() => {
                        abrirModal({
                            paso: 2,
                            tipo: "Error",
                            titulo: "Error",
                            contenido: mensajeError || "No fue posible eliminar el formato",
                            btnAceptar: "Cerrar",
                        });
                    }, 500);
                }
            },
        });
    }, 500);
}

/*************************************/
/* CLICK ELIMINAR FORMATO */
/*************************************/
document.addEventListener("click", function (event) {
    const btnEliminarFormato =
        event.target.closest(".btn-eliminar-formato");

    if (!btnEliminarFormato) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const contenidoId =
        btnEliminarFormato.dataset.contenidoId ||
        btnEliminarFormato.dataset.idContenido ||
        btnEliminarFormato.dataset.idRegistro ||
        "";

    const documentoId =
        btnEliminarFormato.dataset.documentoId ||
        btnEliminarFormato.dataset.idArchivo ||
        btnEliminarFormato.dataset.archivoId ||
        btnEliminarFormato.dataset.id ||
        "";

    eliminarFormatoInventario(contenidoId, documentoId);
});