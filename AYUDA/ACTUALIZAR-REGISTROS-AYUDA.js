/*************************************/
/* MODAL EDITAR */
/*************************************/
async function abrirModalrecurso(id = "", titulo = "", descripcion = "") {
    abrirModalDinamico({
        titulo: "Editar recurso",
        icono: "bi bi-pencil-square",
        confirmButton: "Actualizar",
        campos: [
            {
                titulo: "Titulo",
                tipo: "text",
                width: "100",
                required: true,
                valueDefault: titulo,
            },
            {
                titulo: "Descripción",
                tipo: "textArea",
                width: "100",
                required: true,
                valueDefault: descripcion,
            },
            {
                titulo: "Archivos",
                tipo: "file",
                width: "100",
                required: false,
                maxSizeMB: 500,
                accept: ".pdf,.doc,.pptx,.xlsx,.mp4,.mov,.avi,.mkv,.webm,.wmv",
                box: true,
            },
        ],
        onGuardar: async function (data) {
            /*************************************/
            /* VALIDAR EXTENSION SI HAY ARCHIVO */
            /*************************************/
            const extensionesPermitidas = [
                "pdf", "doc", "pptx", "xlsx",
                "mp4", "mov", "avi", "mkv", "webm", "wmv",
            ];
            const nombreArchivo = String(data?.Archivos?.name || "");
            const ultimoPunto = nombreArchivo.lastIndexOf(".");
            const extensionArchivo = ultimoPunto > 0
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

            /*************************************/
            /* VALIDAR PESO DE DOCUMENTOS: 100 MB */
            /*************************************/
            const extensionesDocumentos = ["pdf", "doc", "pptx", "xlsx"];
            const pesoMaximoDocumentos = 100 * 1024 * 1024;

            if (
                data?.Archivos &&
                extensionesDocumentos.includes(extensionArchivo) &&
                data.Archivos.size > pesoMaximoDocumentos
            ) {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Archivo demasiado grande",
                    contenido:
                        "El tamaño máximo permitido para archivos PDF, Word, PowerPoint y Excel es de 100 MB.",
                    btnAceptar: "Cerrar",
                });
                return;
            }

            /*************************************/
            /* VALIDAR PESO DE VIDEOS: 500 MB */
            /*************************************/
            const extensionesVideos = ["mp4", "mov", "avi", "mkv", "webm", "wmv"];
            const pesoMaximoVideos = 500 * 1024 * 1024;

            if (
                data?.Archivos &&
                extensionesVideos.includes(extensionArchivo) &&
                data.Archivos.size > pesoMaximoVideos
            ) {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Archivo demasiado grande",
                    contenido: "El tamaño máximo permitido para videos es de 500 MB.",
                    btnAceptar: "Cerrar",
                });
                return;
            }

            window.mostrarLoaderPeticion();

            const dataEnviar = {
                id: Number(id),
                titulo: data?.Titulo || "",
                descripcion: data?.Descripción || "",
                autor: window.obtenerUsuario(),
                fechaCarga: new Date().toISOString(),
                tipoArchivo: data?.Archivos?.type || "archivo",
            };

            const formData = new FormData();

            if (data?.Archivos) {
                formData.append("archivo", data.Archivos, data.Archivos.name);
            }

            const jsonBlob = new Blob([JSON.stringify(dataEnviar)], {
                type: "application/json",
            });

            formData.append("datos", jsonBlob);

            let responseText = "";
            let result = {};
            let statusCode = 500;

            try {
                sessionStorage.setItem("functional-id", "ACTUALIZAR RECURSO");
                await window.tokenizerTransactionId();
                const headers = await window.getGlobalHeaders();
                delete headers["Content-Type"];
                delete headers["content-type"];

                const response = await fetch(
                    `${window.apiConfig.normativas}/api/v1/recursos-ayuda/${id}`,
                    {
                        method: "PATCH",
                        headers,
                        body: formData,
                    }
                );

                statusCode = response.status;
                responseText = await response.text();

                try {
                    result = responseText ? JSON.parse(responseText) : {};
                } catch {
                    result = {
                        respuesta: responseText,
                    };
                }

                if (
                    !response.ok ||
                    (result?.statusCode != null &&
                        !(Number(result.statusCode) >= 200 && Number(result.statusCode) < 300))
                ) {
                    throw {
                        tipo: "HTTP",
                        status: response.status,
                        body: result,
                        raw: responseText,
                    };
                }

                /*************************************/
                /* RECARGAR SOLO TRAS ACTUALIZAR CON ÉXITO */
                /*************************************/
                try {
                    await window.obtenerInformacionAyuda();
                } catch (errorRecarga) {
                    console.error("El recurso se actualizó, pero falló la recarga:", errorRecarga);
                }

                /*************************************/
                /* BITACORA OK SEPARADA */
                /*************************************/
                try {
                    await window.bitacoraService.operationLog(
                        "PATCH",
                        "RECURSOS AYUDA",
                        "ACTUALIZAR RECURSO",
                        `Actualización recurso ${data?.Titulo || titulo || ""}`,
                        result?.statusCode || statusCode || 200,
                        result?.message || "Recurso actualizado correctamente"
                    );
                } catch (bitacoraError) {
                    console.warn("Error en bitácora OK:", bitacoraError);
                }

                window.ocultarLoaderPeticion();

                setTimeout(() => {
                    abrirModal({
                        paso: 2,
                        tipo: "Aceptar",
                        titulo: "Completado",
                        contenido: "Registro actualizado correctamente",
                        btnAceptar: "Cerrar",
                    });
                }, 500);
            } catch (e) {
                console.log("Error al actualizar recurso:", e);

                /*************************************/
                /* BITACORA ERROR SEPARADA */
                /*************************************/
                try {
                    const errorBody = e?.body || {};
                    const errorDTO = errorBody?.errorMessageDTO || {};

                    await window.bitacoraService.operationLog(
                        "PATCH",
                        "RECURSOS AYUDA",
                        "ACTUALIZAR RECURSO",
                        `Actualización recurso ${data?.Titulo || titulo || ""}`,
                        errorDTO?.statusCode || e?.status || statusCode || 500,
                        errorDTO?.message ||
                        errorBody?.message ||
                        e?.message ||
                        "Error desconocido"
                    );
                } catch (bitacoraError) {
                    console.warn("Error en bitácora ERROR:", bitacoraError);
                }

                window.ocultarLoaderPeticion();

                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Error",
                    contenido: "No fue posible actualizar el recurso",
                    btnAceptar: "Cerrar",
                });
            }
        },
    });
}

/*************************************/
/* EVENTO EDITAR */
/*************************************/
document.addEventListener("click", function (e) {
    const botonEditar = e.target.closest("#editar-recurso");
    if (!botonEditar) return;

    abrirModalrecurso(
        botonEditar.dataset.id,
        botonEditar.dataset.titulo,
        botonEditar.dataset.descripcion
    );
});