/*
|--------------------------------------------------------------------------
| CHECK PARA ACTUALIZAR isUpdate
|--------------------------------------------------------------------------
*/

if (window.eventoCambioCheckInventario) {
    document.removeEventListener("change", window.eventoCambioCheckInventario);
    document.removeEventListener("click", window.eventoCambioCheckInventario);
}

/*
    |--------------------------------------------------------------------------
    | APLICAR ESTADO VISUAL DEL CHECK
    |--------------------------------------------------------------------------
    */

function aplicarEstadoVisualCheckInventario(check, activo) {
    const fila = check?.closest("tr");

    if (!fila) {
        return;
    }

    const tipoRegistro = (check.dataset.tipoRegistro || "").toUpperCase();

    const acciones = fila.querySelector(".acciones-inventario");

    const celdaVigencia = fila.querySelector(".celda-vigencia-inventario");

    /*
        |--------------------------------------------------------------------------
        | MOSTRAR / OCULTAR ACCIONES
        |--------------------------------------------------------------------------
        */

    if (acciones) {
        acciones.style.setProperty(
            "display",
            activo ? "inline-flex" : "none",
            "important"
        );
    }

    /*
        |--------------------------------------------------------------------------
        | CAMBIO VISUAL SOLO PARA NORMA ADJUNTA
        |--------------------------------------------------------------------------
        */

    if (celdaVigencia && tipoRegistro === "NORMA_ADJUNTA") {
        const contenidoVigencia = celdaVigencia.querySelector("span");

        if (activo) {
            /*
                |--------------------------------------------------------------------------
                | CHECK ACTIVO
                |--------------------------------------------------------------------------
                */

            celdaVigencia.style.setProperty(
                "background-color",
                "#FF9800",
                "important"
            );

            celdaVigencia.style.setProperty("color", "#FFFFFF", "important");

            if (contenidoVigencia) {
                contenidoVigencia.style.setProperty("color", "#FFFFFF", "important");
            }
        } else {
            /*
                |--------------------------------------------------------------------------
                | CHECK INACTIVO
                |--------------------------------------------------------------------------
                */

            celdaVigencia.style.removeProperty("background-color");

            celdaVigencia.style.removeProperty("color");

            if (contenidoVigencia) {
                contenidoVigencia.style.removeProperty("color");

                /*
                    |--------------------------------------------------------------------------
                    | RECUPERAR COLOR DEL SEMÁFORO
                    |--------------------------------------------------------------------------
                    */

                contenidoVigencia.style.color =
                    contenidoVigencia.dataset.colorOriginal || "green";
            }
        }
    }
}

/*
    |--------------------------------------------------------------------------
    | OBTENER MENSAJE DE ERROR
    |--------------------------------------------------------------------------
    */

function obtenerMensajeErrorIsUpdate(resultado, response, fallback) {
    return (
        resultado?.errorMessageDTO?.message ||
        resultado?.errorMessageDTO?.detail ||
        resultado?.dataResponse?.mensaje ||
        resultado?.message ||
        (response?.status ? `Error HTTP ${response.status}` : "") ||
        fallback ||
        "No fue posible actualizar el estado de la norma."
    );
}

/*
    |--------------------------------------------------------------------------
    | EVENTO CHANGE DEL CHECK
    |--------------------------------------------------------------------------
    */

window.eventoCambioCheckInventario = async function (event) {
    const check = event.target.closest(".check-acciones-inventario");

    if (!check) {
        return;
    }

    event.preventDefault();

    if (
        check.dataset.confirmacionEnProceso === "true" ||
        check.dataset.peticionEnProceso === "true"
    ) {
        return;
    }

    /*
          |--------------------------------------------------------------------------
          | SOLO APLICA PARA NORMA ADJUNTA
          |--------------------------------------------------------------------------
          */

    const tipoRegistro = (check.dataset.tipoRegistro || "").toUpperCase();

    if (tipoRegistro !== "NORMA_ADJUNTA") {
        return;
    }

    /*
          |--------------------------------------------------------------------------
          | OBTENER ID DE LA NORMA PADRE Y DE LA NORMA HIJA
          |--------------------------------------------------------------------------
          */

    const contenidoPadreId = check.dataset.idPadre || "";

    const contenidoHijaId = check.dataset.id || "";

    const tituloNormaHija = (check.dataset.titulo || "").trim();

    if (!contenidoPadreId || !contenidoHijaId) {
        check.checked = !check.checked;

        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: !contenidoPadreId
                ? "No se encontró el identificador de la norma padre."
                : "No se encontró el identificador de la norma hija.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    /*
          |--------------------------------------------------------------------------
          | GUARDAR ESTADO ANTERIOR
          |--------------------------------------------------------------------------
          */

    const nuevoEstado = Boolean(check.checked);

    const estadoAnterior = !nuevoEstado;

    /*
          |--------------------------------------------------------------------------
          | CONFIRMAR CAMBIO DE ESTADO
          |--------------------------------------------------------------------------
          */

    check.checked = estadoAnterior;

    aplicarEstadoVisualCheckInventario(check, estadoAnterior);

    check.dataset.confirmacionEnProceso = "true";

    const confirmado = await new Promise(function (resolve) {
        let confirmacionResuelta = false;

        function removerEventoCancelar() {
            document.removeEventListener("click", detectarCancelacionModal, true);
        }

        function resolverConfirmacion(valor) {
            if (confirmacionResuelta) {
                return;
            }

            confirmacionResuelta = true;
            removerEventoCancelar();
            delete check.dataset.confirmacionEnProceso;

            if (!valor) {
                check.checked = estadoAnterior;
                aplicarEstadoVisualCheckInventario(check, estadoAnterior);
            }

            resolve(Boolean(valor));
        }

        function detectarCancelacionModal(evento) {
            const boton = evento.target.closest("button");

            if (!boton) {
                return;
            }

            const textoBoton = String(boton.textContent || "")
                .trim()
                .toLowerCase();

            if (textoBoton === "cancelar") {
                resolverConfirmacion(false);
            }
        }

        document.addEventListener("click", detectarCancelacionModal, true);

        abrirModal({
            paso: 1,
            titulo: nuevoEstado
                ? "Activar actualización"
                : "Desactivar actualización",
            contenido: nuevoEstado
                ? "¿Deseas activar la actualización de esta norma?"
                : "¿Deseas desactivar la actualización de esta norma?",
            contenido1: nuevoEstado
                ? "Se habilitarán las acciones disponibles para la norma."
                : "Se ocultarán las acciones disponibles para la norma.",
            btnAceptar: "Aceptar",
            btnCerrar: "Cancelar",
            onAceptar: function (ok) {
                resolverConfirmacion(ok);
            },
            onCerrar: function () {
                resolverConfirmacion(false);
            },
            onCancelar: function () {
                resolverConfirmacion(false);
            },
        });
    });

    if (!confirmado) {
        check.checked = estadoAnterior;

        aplicarEstadoVisualCheckInventario(check, estadoAnterior);

        return;
    }

    check.checked = nuevoEstado;

    check.dataset.peticionEnProceso = "true";

    if (typeof window.mostrarLoaderPeticion === "function") {
        window.mostrarLoaderPeticion();
    }

    let resultado = {};
    let statusCode = 500;

    try {
        /*
              |--------------------------------------------------------------------------
              | FUNCTIONAL ID
              |--------------------------------------------------------------------------
              */

        sessionStorage.setItem("functional-id", "ACTUALIZAR ESTADO NORMA ADJUNTA");

        /*
              |--------------------------------------------------------------------------
              | TOKEN
              |--------------------------------------------------------------------------
              */

        if (typeof window.tokenizerTransactionId !== "function") {
            throw new Error("No se encontró tokenizerTransactionId.");
        }

        await window.tokenizerTransactionId();

        /*
              |--------------------------------------------------------------------------
              | HEADERS
              |--------------------------------------------------------------------------
              */

        const headers =
            typeof window.getGlobalHeaders === "function"
                ? await window.getGlobalHeaders()
                : {};

        headers["Content-Type"] = "application/json";

        headers.Accept = "application/json";

        /*
              |--------------------------------------------------------------------------
              | PATCH isUpdate
              |--------------------------------------------------------------------------
              */

        const response = await fetch(
            `${window.apiConfig.normativas
            }/api/v1/inventario/normas/${encodeURIComponent(
                contenidoPadreId
            )}/hijas/${encodeURIComponent(contenidoHijaId)}/is-update`,
            {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    isUpdate: nuevoEstado,
                }),
            }
        );

        statusCode = response.status;

        /*
              |--------------------------------------------------------------------------
              | LEER RESPONSE
              |--------------------------------------------------------------------------
              */

        const responseText = await response.text();

        try {
            resultado = responseText ? JSON.parse(responseText) : {};
        } catch {
            resultado = {
                statusCode: response.status,
                message: responseText,
            };
        }

        /*
              |--------------------------------------------------------------------------
              | VALIDAR ERROR
              |--------------------------------------------------------------------------
              */

        if (
            !response.ok ||
            (resultado?.statusCode !== undefined &&
                Number(resultado.statusCode) >= 400)
        ) {
            const error = new Error(
                obtenerMensajeErrorIsUpdate(
                    resultado,
                    response,
                    "No fue posible actualizar el estado de la norma."
                )
            );

            error.statusCode =
                resultado?.errorMessageDTO?.statusCode ||
                resultado?.statusCode ||
                response.status;

            error.response = resultado;

            throw error;
        }

        /*
              |--------------------------------------------------------------------------
              | ACTUALIZAR DATASET
              |--------------------------------------------------------------------------
              */

        check.dataset.isUpdate = String(nuevoEstado);

        /*
              |--------------------------------------------------------------------------
              | ACTUALIZAR VISUALMENTE
              |--------------------------------------------------------------------------
              */

        aplicarEstadoVisualCheckInventario(check, nuevoEstado);

        /*
              |--------------------------------------------------------------------------
              | BITÁCORA
              |--------------------------------------------------------------------------
              */

        try {
            if (
                window.bitacoraService &&
                typeof window.bitacoraService.operationLog === "function"
            ) {
                await window.bitacoraService.operationLog(
                    "PATCH",
                    "Inventario",
                    "Actualizar estado de norma adjunta",
                    `Se actualizó el check de actualización de la norma hija: ${tituloNormaHija}`,
                    resultado?.statusCode || statusCode || 200,
                    resultado?.message || `El estado isUpdate cambió a ${nuevoEstado}`
                );
            }
        } catch (bitacoraError) {
            console.warn("Error en bitácora OK:", bitacoraError);
        }

        /*
          |--------------------------------------------------------------------------
          | ACTUALIZAR TABLA
          |--------------------------------------------------------------------------
          */

        if (typeof window.obtenerInformacionTabla === "function") {
            await window.obtenerInformacionTabla();
        }

        /*
              |--------------------------------------------------------------------------
              | OCULTAR LOADER
              |--------------------------------------------------------------------------
              */

        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }

        abrirModal({
            paso: 2,
            tipo: "Ok",
            titulo: "Completado",
            contenido: "El indicador se actualizó correctamente",
            btnAceptar: "Cerrar",
        });
    } catch (error) {
        console.error("Error al actualizar isUpdate:", error);

        /*
              |--------------------------------------------------------------------------
              | REGRESAR CHECK AL ESTADO ANTERIOR
              |--------------------------------------------------------------------------
              */

        check.checked = estadoAnterior;

        check.dataset.isUpdate = String(estadoAnterior);

        /*
              |--------------------------------------------------------------------------
              | REGRESAR ESTADO VISUAL
              |--------------------------------------------------------------------------
              */

        aplicarEstadoVisualCheckInventario(check, estadoAnterior);

        /*
              |--------------------------------------------------------------------------
              | MENSAJE DE ERROR
              |--------------------------------------------------------------------------
              */

        const mensaje = obtenerMensajeErrorIsUpdate(
            error?.response,
            {
                status: error?.statusCode,
            },
            error?.message
        );

        /*
              |--------------------------------------------------------------------------
              | BITÁCORA ERROR
              |--------------------------------------------------------------------------
              */

        try {
            if (
                window.bitacoraService &&
                typeof window.bitacoraService.operationLog === "function"
            ) {
                await window.bitacoraService.operationLog(
                    "PATCH",
                    "InventarioO",
                    "Actualizar estado de norma adjunta",
                    `Error al actualizar el check de actualización de la norma hija: ${tituloNormaHija}`,
                    error?.response?.errorMessageDTO?.statusCode ||
                    error?.response?.statusCode ||
                    error?.statusCode ||
                    statusCode ||
                    500,
                    mensaje
                );
            }
        } catch (bitacoraError) {
            console.warn("Error en bitácora ERROR:", bitacoraError);
        }

        /*
              |--------------------------------------------------------------------------
              | OCULTAR LOADER
              |--------------------------------------------------------------------------
              */

        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }

        /*
              |--------------------------------------------------------------------------
              | MODAL ERROR
              |--------------------------------------------------------------------------
              */

        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: mensaje,
            btnAceptar: "Cerrar",
        });
    } finally {
        delete check.dataset.peticionEnProceso;
    }
};

/*
    |--------------------------------------------------------------------------
    | REGISTRAR EVENTO
    |--------------------------------------------------------------------------
    */

document.addEventListener("click", window.eventoCambioCheckInventario);