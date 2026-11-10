/*************************************/
/* ESTADO DESCARGA */
/*************************************/
let descargaInventarioEnProceso = false;

/*************************************/
/* REGISTRAR BITÁCORA DESCARGA */
/*************************************/
async function registrarBitacoraDescargaInventario(
    metodo,
    accion,
    descripcion,
    statusCode,
    mensaje
) {
    if (
        !window.bitacoraService ||
        typeof window.bitacoraService.operationLog !== "function"
    ) {
        console.warn(
            "[DESCARGA INVENTARIO] El servicio de bitácora no está disponible."
        );

        return;
    }

    try {
        await window.bitacoraService.operationLog(
            metodo,
            "INVENTARIO",
            accion,
            descripcion,
            Number(statusCode || 500),
            mensaje || ""
        );
    } catch (error) {
        console.warn(
            "[DESCARGA INVENTARIO] No fue posible registrar la bitácora:",
            error
        );
    }
}

/*************************************/
/* EXTRAER URL DE LA RESPUESTA */
/*************************************/
function obtenerUrlDescargaDesdeRespuesta(dataResponse) {
    if (typeof dataResponse === "string") {
        return dataResponse.trim();
    }

    if (Array.isArray(dataResponse) && dataResponse.length > 0) {
        return (
            dataResponse[0]?.urlDescarga ||
            dataResponse[0]?.url ||
            dataResponse[0]?.ruta ||
            dataResponse[0]?.rutaArchivo ||
            ""
        );
    }

    if (dataResponse && typeof dataResponse === "object") {
        return (
            dataResponse?.urlDescarga ||
            dataResponse?.url ||
            dataResponse?.ruta ||
            dataResponse?.rutaArchivo ||
            ""
        );
    }

    return "";
}

/*************************************/
/* PREPARAR URL PARA DESCARGA */
/*************************************/
function prepararUrlDescargaInventario(url) {
    if (typeof url !== "string") {
        return "";
    }

    const rutaDescarga = url.trim();

    if (!rutaDescarga) {
        return "";
    }

    /*
     * Si ya contiene download=true,
     * se conserva tal como la entrega Liferay.
     */
    if (/[?&]download=true(?:&|$)/i.test(rutaDescarga)) {
        return rutaDescarga;
    }

    /*
     * Si no contiene download=true,
     * se agrega sin modificar los demás parámetros.
     */
    return (
        rutaDescarga + (rutaDescarga.includes("?") ? "&" : "?") + "download=true"
    );
}

/*************************************/
/* DESCARGAR ARCHIVO INVENTARIO */
/*************************************/
async function descargarArchivoInventario(boton) {
    if (descargaInventarioEnProceso) {
        return;
    }

    const idArchivo = boton?.dataset?.idArchivo || "";

    // Nombre utilizado exclusivamente para el detalle de la bitácora.
    const nombreBitacora =
        boton?.dataset?.tituloNorma ||
        boton?.dataset?.titulo ||
        boton?.dataset?.nombreArchivo ||
        boton?.dataset?.nombre ||
        "Sin título";

    if (!idArchivo) {
        if (typeof abrirModal === "function") {
            abrirModal({
                paso: 2,
                tipo: "Error",
                titulo: "Error",
                contenido: "No se encontró el identificador del archivo.",
                btnAceptar: "Cerrar",
            });
        }

        return;
    }

    descargaInventarioEnProceso = true;

    if (typeof window.mostrarLoaderPeticion === "function") {
        window.mostrarLoaderPeticion();
    }

    try {
        /*************************************/
        /* CONFIGURAR TRANSACCIÓN */
        /*************************************/
        sessionStorage.setItem("functional-id", "DESCARGAR ARCHIVO INVENTARIO");

        if (typeof window.tokenizerTransactionId !== "function") {
            throw new Error(
                "No se encuentra disponible el tokenizador de transacciones."
            );
        }

        await window.tokenizerTransactionId();

        /*************************************/
        /* CONSULTAR URL DE DESCARGA */
        /*************************************/
        const response = await window.apiFetch(
            "normativas",
            `/api/v1/inventario/${idArchivo}/url-descarga`
        );

        const result = response?.data || {};

        console.log("[DESCARGA INVENTARIO] Respuesta:", result);

        /*************************************/
        /* VALIDAR ERROR HTTP */
        /*************************************/
        const statusHttp = Number(response?.status || 200);

        if (statusHttp < 200 || statusHttp >= 300) {
            const mensajeError =
                result?.errorMessageDTO?.message ||
                result?.errorMessageDTO?.detail ||
                result?.message ||
                `Error HTTP ${statusHttp}`;

            const error = new Error(mensajeError);

            error.statusCode =
                result?.errorMessageDTO?.statusCode ||
                result?.statusCode ||
                statusHttp ||
                500;

            error.response = result;

            throw error;
        }

        /*************************************/
        /* VALIDAR STATUS DEL JSON */
        /*************************************/
        if (result?.statusCode !== undefined && Number(result.statusCode) !== 200) {
            const mensajeError =
                result?.errorMessageDTO?.message ||
                result?.errorMessageDTO?.detail ||
                result?.message ||
                "No fue posible obtener la URL de descarga.";

            const error = new Error(mensajeError);

            error.statusCode =
                result?.errorMessageDTO?.statusCode || result?.statusCode || 500;

            error.response = result;

            throw error;
        }

        /*************************************/
        /* VALIDAR ERROR MESSAGE DTO */
        /*************************************/
        if (result?.errorMessageDTO) {
            const mensajeError =
                result?.errorMessageDTO?.message ||
                result?.errorMessageDTO?.detail ||
                "No fue posible obtener la URL de descarga.";

            const error = new Error(mensajeError);

            error.statusCode =
                result?.errorMessageDTO?.statusCode || result?.statusCode || 500;

            error.response = result;

            throw error;
        }

        /*************************************/
        /* OBTENER URL DE DESCARGA */
        /*************************************/
        const rutaDocumento = obtenerUrlDescargaDesdeRespuesta(
            result?.dataResponse
        );

        const rutaDescarga = prepararUrlDescargaInventario(rutaDocumento);

        if (!rutaDescarga) {
            const error = new Error(
                "El servicio no devolvió una URL válida para descargar el archivo."
            );

            error.statusCode = result?.statusCode || response?.status || 500;

            error.response = result;

            throw error;
        }

        /*************************************/
        /* BITÁCORA EXITOSA */
        /*************************************/
        await registrarBitacoraDescargaInventario(
            "GET",
            "Descargar archivo inventario",
            `Descarga del archivo de inventario: ${nombreBitacora}`,
            result?.statusCode || response?.status || 200,
            result?.message || "Se obtuvo correctamente la URL de descarga."
        );

        /*************************************/
        /* OCULTAR LOADER */
        /*************************************/
        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }

        /*************************************/
        /* INICIAR DESCARGA */
        /*************************************/
        const enlace = document.createElement("a");

        enlace.href = rutaDescarga;

        enlace.target = "_blank";

        enlace.rel = "noopener noreferrer";

        enlace.style.display = "none";

        document.body.appendChild(enlace);

        enlace.click();
        enlace.remove();
    } catch (error) {
        console.error("[DESCARGA INVENTARIO] Error:", error);

        const statusCode =
            error?.response?.errorMessageDTO?.statusCode ||
            error?.response?.statusCode ||
            error?.statusCode ||
            500;

        const mensajeError =
            error?.response?.errorMessageDTO?.message ||
            error?.response?.errorMessageDTO?.detail ||
            error?.response?.message ||
            error?.message ||
            "No fue posible descargar el archivo.";

        /*************************************/
        /* BITÁCORA ERROR */
        /*************************************/
        await registrarBitacoraDescargaInventario(
            "GET",
            "Descargar archivo inventario",
            `Error al descargar el archivo de inventario: ${nombreBitacora}`,
            statusCode,
            mensajeError
        );

        /*************************************/
        /* SEGUNDO MODAL DE ERROR */
        /*************************************/
        setTimeout(function () {
            if (typeof abrirModal === "function") {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Error",
                    contenido: mensajeError,
                    btnAceptar: "Cerrar",
                });
            }
        }, 500);
    } finally {
        descargaInventarioEnProceso = false;

        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }
    }
}

/*************************************/
/* EVENTO BOTÓN DESCARGAR */
/*************************************/
document.addEventListener("click", async function (event) {
    const boton = event.target.closest(".btn-descargar");

    if (!boton) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    await descargarArchivoInventario(boton);
});