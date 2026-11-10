/*************************************/

/* VALIDAR LIMITE DE RECURSOS */

/*************************************/

async function validarLimiteRecursosAyuda() {
    window.mostrarLoaderPeticion();

    try {
        sessionStorage.setItem(
            "functional-id",

            "VALIDAR LIMITE RECURSOS AYUDA"
        );

        /*************************************/

        /* TOKEN */

        /*************************************/

        await window.tokenizerTransactionId();

        /*************************************/

        /* CONSULTAR RECURSOS */

        /*************************************/

        const response = await window.apiFetch(
            "normativas",

            "/api/v1/recursos-ayuda/"
        );

        const recursos = response?.data?.dataResponse;

        const totalRecursos = Array.isArray(recursos) ? recursos.length : 0;

        /*************************************/

        /* VALIDAR MAXIMO DE 12 */

        /*************************************/

        if (totalRecursos >= 12) {
            abrirModal({
                paso: 2,

                tipo: "Error",

                titulo: "Límite alcanzado",

                contenido: "Solo se pueden subir un máximo de 12 registros.",

                btnAceptar: "Cerrar",
            });

            return false;
        }

        return true;
    } catch (error) {
        console.error(
            "[CREAR] No fue posible validar el límite de recursos:",

            error
        );

        abrirModal({
            paso: 2,

            tipo: "Error",

            titulo: "Error",

            contenido: "No fue posible validar la cantidad de registros existentes.",

            btnAceptar: "Cerrar",
        });

        return false;
    } finally {
        window.ocultarLoaderPeticion();
    }
}

/*************************************/

/* MODAL CREAR */

/*************************************/

async function abrirModalCrearRecurso() {
    abrirModalDinamico({
        titulo: "Crear recurso",

        icono: "bi bi-plus-circle",

        confirmButton: "Guardar",

        campos: [
            {
                titulo: "Título",

                tipo: "text",

                width: "100",

                required: true,

                maxLength: 150,
            },

            {
                titulo: "Descripción",

                tipo: "textArea",

                width: "100",

                required: true,

                maxLength: 250,
            },

            {
                titulo: "Archivos",

                tipo: "file",

                width: "100",

                required: true,

                maxSizeMB: 500,

                accept: ".pdf,.doc,.pptx,.xlsx,.mp4,.mov,.avi,.mkv,.webm,.wmv",

                box: true,
            },
        ],

        onGuardar: async function (data) {
            /* VALIDAR EXTENSION ANTES DE ENVIAR EL ARCHIVO */
            const extensionesPermitidas = [
                "pdf",
                "doc",
                "pptx",
                "xlsx",
                "mp4",
                "mov",
                "avi",
                "mkv",
                "webm",
                "wmv",
            ];
            const nombreArchivo = String(data?.Archivos?.name || "");
            const ultimoPunto = nombreArchivo.lastIndexOf(".");
            const extensionArchivo =
                ultimoPunto > 0
                    ? nombreArchivo.slice(ultimoPunto + 1).toLowerCase()
                    : "";

            if (data?.Archivos && !extensionesPermitidas.includes(extensionArchivo)) {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Tipo de archivo no permitido",
                    contenido:
                        "Solo se permiten archivos .pdf, .doc, .pptx, .xlsx y videos .mp4, .mov, .avi, .mkv, .webm y .wmv.",
                    btnAceptar: "Cerrar",
                });
                return;
            }

            /* VALIDAR TAMAÑO: VIDEOS 500 MB, DEMÁS ARCHIVOS 100 MB */
            const extensionesVideo = ["mp4", "mov", "avi", "mkv", "webm", "wmv"];
            const esVideo = extensionesVideo.includes(extensionArchivo);
            const limiteArchivoMB = esVideo ? 500 : 100;

            if (data?.Archivos && data.Archivos.size > limiteArchivoMB * 1024 * 1024) {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Tamaño de archivo no permitido",
                    contenido: esVideo
                        ? "El video no debe superar los 500 MB."
                        : "El archivo no debe superar los 100 MB.",
                    btnAceptar: "Cerrar",
                });
                return;
            }

            window.mostrarLoaderPeticion();

            /*************************************/

            /* JSON */

            /*************************************/

            const dataEnviar = {
                id: 0,

                titulo: data?.Título ?? data?.Titulo ?? "",

                descripcion: data?.Descripción ?? data?.Descripcion ?? "",

                autor: window.obtenerUsuario(),

                fechaCarga: new Date().toISOString(),

                tipoArchivo: data?.Archivos?.type || "archivo",
            };

            /*************************************/

            /* FORMDATA */

            /*************************************/

            const formData = new FormData();

            /*************************************/

            /* ARCHIVO */

            /*************************************/

            if (data?.Archivos) {
                formData.append("archivo", data.Archivos, data.Archivos.name);
            }

            /*************************************/

            /* DATOS JSON */

            /*************************************/

            const jsonBlob = new Blob([JSON.stringify(dataEnviar)], {
                type: "application/json",
            });

            formData.append("datos", jsonBlob);

            try {
                sessionStorage.setItem("functional-id", "CREAR RECURSO");

                /*************************************/

                /* TOKEN */

                /*************************************/

                await window.tokenizerTransactionId();

                /*************************************/

                /* HEADERS */

                /*************************************/

                const headers = await window.getGlobalHeaders();

                /*************************************/

                /* IMPORTANTE */

                /* FETCH GENERA EL BOUNDARY */

                /*************************************/

                delete headers["Content-Type"];

                /*************************************/

                /* REQUEST */

                /*************************************/

                const response = await fetch(
                    `${window.apiConfig.normativas}/api/v1/recursos-ayuda/`,

                    {
                        method: "POST",

                        headers,

                        body: formData,
                    }
                );

                const responseText = await response.text();

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${responseText}`);
                }

                let result = {};

                try {
                    result = responseText ? JSON.parse(responseText) : {};
                } catch {
                    result = {
                        respuesta: responseText,
                    };
                }

                /*************************************/
                /* VALIDAR RESPUESTA DEL ENDPOINT */
                /*************************************/
                if (
                    result?.statusCode != null &&
                    !(Number(result.statusCode) >= 200 && Number(result.statusCode) < 300)
                ) {
                    throw new Error(`Respuesta no exitosa: ${responseText}`);
                }

                /*************************************/
                /* RECARGAR SOLO TRAS CREAR CON ÉXITO */
                /*************************************/
                try {
                    await window.obtenerInformacionAyuda();
                } catch (errorRecarga) {
                    console.error("[CREAR] El recurso se creó, pero falló la recarga:", errorRecarga);
                }

                /*************************************/

                /* BITACORA OK */

                /*************************************/

                try {
                    await window.bitacoraService.operationLog(
                        "POST",

                        "RECURSOS AYUDA",

                        "CREAR RECURSO",

                        "Alta de recurso ayuda",

                        result?.statusCode || 200,

                        result?.message || "Se creó el recurso de ayuda"
                    );
                } catch (bitacoraError) {
                    console.warn(
                        "[CREAR] Error en bitácora, pero el recurso sí se creó:",

                        bitacoraError
                    );
                }

                window.ocultarLoaderPeticion();

                /*************************************/

                /* MODAL OK */

                /*************************************/

                setTimeout(() => {
                    abrirModal({
                        paso: 2,

                        tipo: "Aceptar",

                        titulo: "Completado",

                        contenido: "Recurso creado correctamente",

                        btnAceptar: "Cerrar",


                    });
                }, 500);
            } catch (e) {
                /*************************************/

                /* BITACORA ERROR */

                /*************************************/

                const idx = e.message.indexOf("{");

                if (idx !== -1) {
                    const errorObj = JSON.parse(e.message.substring(idx));

                    try {
                        await window.bitacoraService.operationLog(
                            "POST",

                            "RECURSOS AYUDA",

                            "CREAR RECURSO",

                            "Alta de recurso ayuda",

                            errorObj?.errorMessageDTO?.statusCode || 500,

                            errorObj?.errorMessageDTO?.message || "Error desconocido"
                        );
                    } catch (bitacoraError) {
                        console.warn("[CREAR] Error en bitácora:", bitacoraError);
                    }

                    window.ocultarLoaderPeticion();

                    abrirModal({
                        paso: 2,

                        tipo: "Error",

                        titulo: "Error",

                        contenido: escaparTextoOracle(errorObj?.errorMessageDTO?.message),

                        btnAceptar: "Cerrar",
                    });
                }
            }
        },
    });
}

/*************************************/

/* EVENTO BOTON CREAR */

/*************************************/

document.addEventListener(
    "click",

    async function (e) {
        const boton = e.target.closest("#btn-tab-accion");

        if (!boton) return;

        e.preventDefault();

        /*************************************/

        /* VALIDAR LIMITE */

        /*************************************/

        const puedeCrear = await validarLimiteRecursosAyuda();

        if (!puedeCrear) return;

        abrirModalCrearRecurso();
    }
);



/*************************************/

/* ESCAPAR TEXTO PARA ORACLE */

/*************************************/

function escaparTextoOracle(texto = "") {
    return String(texto).replace(/'/g, "''");
}