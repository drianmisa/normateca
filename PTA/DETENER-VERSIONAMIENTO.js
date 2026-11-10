/*
|--------------------------------------------------------------------------
| DETENER VERSIONAMIENTO DE NORMA
|--------------------------------------------------------------------------
*/

if (window.eventoDetenerVersionamientoInventario) {
    document.removeEventListener(
        "change",
        window.eventoDetenerVersionamientoInventario
    );
}

function obtenerMensajeErrorDetenerVersionamiento(
    resultado,
    response,
    fallback
) {
    return (
        resultado?.errorMessageDTO?.message ||
        resultado?.errorMessageDTO?.detail ||
        resultado?.dataResponse?.mensaje ||
        resultado?.message ||
        fallback ||
        (response?.status ? `Error HTTP ${response.status}` : "") ||
        "No fue posible detener el versionamiento de la norma."
    );
}

async function detenerVersionamientoInventario(check) {
    if (!check) return;

    /*
    |--------------------------------------------------------------------------
    | EVITAR PETICIONES DUPLICADAS
    |--------------------------------------------------------------------------
    */

    if (
        check.dataset.confirmacionDetenerEnProceso === "true" ||
        check.dataset.peticionDetenerEnProceso === "true"
    ) {
        check.checked =
            check.dataset.versionamientoDetenido === "true";

        return;
    }

    const estadoAnterior =
        check.dataset.versionamientoDetenido === "true";

    // Esta acción únicamente detiene el versionamiento.
    const deseaDetener = check.checked;

    check.checked = estadoAnterior;

    if (!deseaDetener || estadoAnterior) return;

    const contenidoId =
        check.dataset.contenidoId || check.dataset.id || "";

    const tituloNorma =
        String(check.dataset.titulo || "").trim() ||
        String(check.dataset.codigo || "").trim() ||
        "Sin título";

    if (!contenidoId) {
        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: "No se encontró el identificador de la norma.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | CONFIRMAR
    |--------------------------------------------------------------------------
    */

    check.dataset.confirmacionDetenerEnProceso = "true";

    const confirmado = await new Promise(function (resolve) {
        let confirmacionResuelta = false;

        function resolverConfirmacion(valor) {
            if (confirmacionResuelta) return;

            confirmacionResuelta = true;

            document.removeEventListener(
                "click",
                detectarCancelacionModal,
                true
            );

            delete check.dataset.confirmacionDetenerEnProceso;

            check.checked = estadoAnterior;

            resolve(Boolean(valor));
        }

        function detectarCancelacionModal(evento) {
            const boton = evento.target?.closest?.("button");

            if (!boton) return;

            const textoBoton = String(boton.textContent || "")
                .trim()
                .toLowerCase();

            if (textoBoton === "cancelar") {
                resolverConfirmacion(false);
            }
        }

        document.addEventListener(
            "click",
            detectarCancelacionModal,
            true
        );

        try {
            abrirModal({
                paso: 1,
                titulo: "Detener versionamiento",
                contenido: "¿Deseas detener el versionamiento de esta norma?",
                contenido1: tituloNorma,
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
        } catch (error) {
            console.error("Error al abrir la confirmación:", error);
            resolverConfirmacion(false);
        }
    });

    if (!confirmado) return;

    /*
    |--------------------------------------------------------------------------
    | PETICIÓN
    |--------------------------------------------------------------------------
    */

    check.dataset.peticionDetenerEnProceso = "true";

    const disabledAnterior = check.disabled;

    check.disabled = true;

    let resultado = {};
    let statusCode = 500;
    let peticionExitosa = false;

    try {
        if (typeof window.mostrarLoaderPeticion === "function") {
            window.mostrarLoaderPeticion();
        }

        sessionStorage.setItem(
            "functional-id",
            "Detener versionamiento norma"
        );

        if (typeof window.tokenizerTransactionId !== "function") {
            throw new Error("No se encontró tokenizerTransactionId.");
        }

        await window.tokenizerTransactionId();

        const headers =
            typeof window.getGlobalHeaders === "function"
                ? await window.getGlobalHeaders()
                : {};

        headers["Content-Type"] = "application/json";
        headers.Accept = "application/json";

        const response = await fetch(
            `${window.apiConfig.normativas}/api/v1/inventario/normas/${encodeURIComponent(
                contenidoId
            )}/detener-versionamiento`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    confirmar: true,
                    versionEsperada: 0,
                }),
            }
        );

        statusCode = response.status;

        const responseText = await response.text();

        try {
            resultado = responseText ? JSON.parse(responseText) : {};
        } catch {
            resultado = {
                statusCode: response.status,
                message: responseText,
            };
        }

        if (
            !response.ok ||
            (resultado?.statusCode !== undefined &&
                Number(resultado.statusCode) >= 400)
        ) {
            const error = new Error(
                obtenerMensajeErrorDetenerVersionamiento(
                    resultado,
                    response,
                    "No fue posible detener el versionamiento de la norma."
                )
            );

            error.statusCode =
                resultado?.errorMessageDTO?.statusCode ||
                resultado?.statusCode ||
                response.status;

            error.response = resultado;

            throw error;
        }

        peticionExitosa = true;

        check.checked = true;
        check.dataset.versionamientoDetenido = "true";

        /*
        |--------------------------------------------------------------------------
        | BITÁCORA ÉXITO
        |--------------------------------------------------------------------------
        */

        const mensajeBitacora =
            `Se detuvo correctamente el versionamiento de la norma: ${tituloNorma}.`;

        try {
            if (
                window.bitacoraService &&
                typeof window.bitacoraService.operationLog === "function"
            ) {
                await window.bitacoraService.operationLog(
                    "POST",
                    "Inventario",
                    "Detener versionamiento norma",
                    mensajeBitacora,
                    resultado?.statusCode || statusCode || 200,
                    mensajeBitacora
                );
            }
        } catch (bitacoraError) {
            console.warn("Error en bitácora OK:", bitacoraError);
        }

        /*
        |--------------------------------------------------------------------------
        | RECARGAR TABLA
        |--------------------------------------------------------------------------
        */

        // Una falla al recargar no revierte una operación ya confirmada.
        try {
            if (typeof window.obtenerInformacionTabla === "function") {
                await window.obtenerInformacionTabla();
            }
        } catch (recargaError) {
            console.error(
                "El versionamiento se detuvo, pero no se pudo recargar la tabla:",
                recargaError
            );
        }
    } catch (error) {
        console.error("Error al detener versionamiento:", error);

        check.checked = estadoAnterior;
        check.dataset.versionamientoDetenido = String(estadoAnterior);

        const mensaje = obtenerMensajeErrorDetenerVersionamiento(
            error?.response,
            { status: error?.statusCode },
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
                    "POST",
                    "Inventario",
                    "Detener versionamiento norma",
                    `Error al detener el versionamiento de la norma: ${tituloNorma}.`,
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

        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: mensaje,
            btnAceptar: "Cerrar",
        });
    } finally {
        delete check.dataset.peticionDetenerEnProceso;

        check.disabled = peticionExitosa ? true : disabledAnterior;

        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }
    }

    if (peticionExitosa) {
        abrirModal({
            paso: 2,
            tipo: "Ok",
            titulo: "Completado",
            contenido: "El versionamiento de la norma se detuvo correctamente.",
            btnAceptar: "Cerrar",
        });
    }
}

/*
|--------------------------------------------------------------------------
| EVENTO INDEPENDIENTE DEL CHECK
|--------------------------------------------------------------------------
*/

window.eventoDetenerVersionamientoInventario = function (event) {
    const check = event.target?.closest?.(
        ".check-detener-versionamiento"
    );

    if (!check) return;

    void detenerVersionamientoInventario(check);
};

document.addEventListener(
    "change",
    window.eventoDetenerVersionamientoInventario
);