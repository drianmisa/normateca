/*************************************/
/* DESCARGAR */
/*************************************/
async function descargarRecurso(id, titulo = "") {
    window.mostrarLoaderPeticion();

    try {
        sessionStorage.setItem("functional-id", "DESCARGAR REGISTRO AYUDA");

        /*************************************/
        /* TOKEN */
        /*************************************/
        await window.tokenizerTransactionId();

        /*************************************/
        /* HEADERS */
        /*************************************/
        const headers = await window.getGlobalHeaders();

        /*************************************/
        /* OBTENER URL */
        /*************************************/
        const response = await fetch(
            `${window.apiConfig.normativas}/api/v1/recursos-ayuda/${id}/url-descarga`,
            {
                method: "GET",
                headers,
            }
        );

        /*************************************/
        /* LEER RESPUESTA */
        /*************************************/
        let result = null;

        try {
            result = await response.json();
        } catch (error) {
            result = null;
        }

        /*************************************/
        /* VALIDAR RESPUESTA */
        /*************************************/
        if (!response.ok || Number(result?.statusCode) >= 400) {
            throw new Error(
                JSON.stringify(
                    result || {
                        errorMessageDTO: {
                            statusCode: response.status || 500,
                            message: "No fue posible obtener la URL de descarga",
                        },
                    }
                )
            );
        }

        const urlDescarga = result?.dataResponse;

        if (!urlDescarga) {
            throw new Error(
                JSON.stringify({
                    errorMessageDTO: {
                        statusCode: result?.statusCode || 500,
                        message: "No se recibió la URL de descarga",
                    },
                })
            );
        }

        /*************************************/
        /* DESCARGAR ARCHIVO */
        /*************************************/
        const link = document.createElement("a");

        link.href = urlDescarga;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        document.body.appendChild(link);

        link.click();
        link.remove();

        /*************************************/
        /* BITÁCORA EXITOSA */
        /*************************************/
        try {
            await window.bitacoraService.operationLog(
                "GET",
                "RECURSOS AYUDA",
                "DESCARGAR RECURSO",
                `Descarga recurso ayuda: ${titulo}`,
                result?.statusCode || response.status || 200,
                JSON.stringify(result?.message || "Descarga completada")
            );
        } catch (errorBitacora) {
            console.error(
                "No fue posible registrar la bitácora de descarga:",
                errorBitacora
            );
        }
    } catch (e) {
        let statusCode = 500;
        let mensajeError = "Error desconocido";

        /*************************************/
        /* OBTENER DETALLE DEL ERROR */
        /*************************************/
        try {
            const mensaje = String(e?.message || "");
            const idx = mensaje.indexOf("{");

            if (idx !== -1) {
                const errorObj = JSON.parse(mensaje.substring(idx));

                statusCode =
                    errorObj?.errorMessageDTO?.statusCode || errorObj?.statusCode || 500;

                mensajeError =
                    errorObj?.errorMessageDTO?.message ||
                    errorObj?.message ||
                    "Error desconocido";
            } else if (mensaje) {
                mensajeError = mensaje;
            }
        } catch (errorParseo) {
            mensajeError = e?.message || "Error desconocido";
        }

        /*************************************/
        /* BITÁCORA DE ERROR */
        /*************************************/
        try {
            await window.bitacoraService.operationLog(
                "GET",
                "RECURSOS AYUDA",
                "DESCARGAR RECURSO",
                `Descarga recurso ayuda: ${titulo}`,
                statusCode,
                mensajeError
            );
        } catch (errorBitacora) {
            console.error(
                "No fue posible registrar la bitácora del error:",
                errorBitacora
            );
        }

        /*************************************/
        /* MODAL SOLO CUANDO HAY ERROR */
        /*************************************/
        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: "No fue posible descargar el archivo",
            btnAceptar: "Cerrar",
        });
    } finally {
        window.ocultarLoaderPeticion();
    }
}

/*************************************/
/* CLICK DESCARGAR */
/*************************************/
document.addEventListener("click", function (e) {
    const botonDescargar = e.target.closest("#download");

    if (!botonDescargar) return;

    e.preventDefault();

    const id = botonDescargar.dataset.id;
    const titulo = botonDescargar.dataset.titulo || "";

    if (!id) return;

    descargarRecurso(id, titulo);
});
