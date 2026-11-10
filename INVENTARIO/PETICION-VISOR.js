/*************************************/
/* ESTADO */
/*************************************/
let consultaUrlInventarioEnProceso = false;

/*************************************/
/* OBTENER PERMISO DEL DOCUMENTO */
/*************************************/
window.obtenerPermisoDocumentoNormateca = async function (
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
                            permiso && String(permiso.contenidoId ?? "").trim() === idBuscado
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
};

/*************************************/
/* VALIDAR ADMINISTRADOR */
/*************************************/
async function obtenerPermisoAdminInventario(intentos = 50) {
    for (let i = 0; i < intentos; i++) {
        if (typeof window.usuarioEsAdminNormateca === "function") {
            return Boolean(await window.usuarioEsAdminNormateca());
        }

        await new Promise(function (resolve) {
            setTimeout(resolve, 200);
        });
    }

    return false;
}

/*************************************/
/* MODAL SIN PERMISO DE VISUALIZACIÓN */
/*************************************/
function mostrarModalSinPermisoDocumento() {
    if (typeof window.abrirModal === "function") {
        window.abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Sin permiso",
            contenido: "No tiene permiso para ver este documento.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    console.error("[PERMISOS] No se encuentra disponible abrirModal.");
}

/*************************************/
/* REGISTRAR BITÁCORA */
/*************************************/
async function registrarBitacoraUrlInventario(
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
            "[VISOR INVENTARIO] El servicio de bitácora no está disponible."
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
            "[VISOR INVENTARIO] No fue posible registrar la bitácora:",
            error
        );
    }
}

/*************************************/
/* EXTRAER URL DE LA RESPUESTA */
/*************************************/
function obtenerUrlDocumentoInventario(dataResponse) {
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
/* QUITAR DOWNLOAD DE LA URL */
/*************************************/
function quitarDownloadUrlInventario(url) {
    if (typeof url !== "string") {
        return "";
    }

    try {
        const urlDocumento = new URL(url.trim(), window.location.origin);

        urlDocumento.searchParams.delete("download");

        return urlDocumento.toString();
    } catch (error) {
        return url
            .trim()
            .replace(
                /([?&])download=true(&|$)/i,
                function (coincidencia, separador, final) {
                    if (separador === "?" && final === "&") {
                        return "?";
                    }

                    if (separador === "&" && final === "&") {
                        return "&";
                    }

                    return "";
                }
            )
            .replace(/[?&]$/, "");
    }
}

/*************************************/
/* FORMATEAR FECHA DD-MM-AAAA */
/*************************************/
function formatearFechaVigenciaInventario(fecha) {
    if (typeof fecha !== "string") {
        return "";
    }

    const fechaLimpia = fecha.trim();
    const coincidencia = fechaLimpia.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!coincidencia) {
        return fechaLimpia;
    }

    const [, anio, mes, dia] = coincidencia;

    return `${dia}-${mes}-${anio}`;
}

/*************************************/
/* CONVERTIR DATASET A BOOLEANO */
/*************************************/
function obtenerBooleanoDatasetInventario(valor, valorPredeterminado = false) {
    if (valor === undefined || valor === null || valor === "") {
        return valorPredeterminado;
    }

    return valor === true || valor === "true" || valor === 1 || valor === "1";
}

/*************************************/
/* VALIDAR CLASIFICACIÓN PROTEGIDA */
/*************************************/
function esClasificacionProtegidaInventario(clasificacion) {
    const clasificacionNormalizada = String(clasificacion || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

    return (
        clasificacionNormalizada === "RESTRINGIDA" ||
        clasificacionNormalizada === "CONFIDENCIAL"
    );
}

/*************************************/
/* ABRIR VISOR DESDE INVENTARIO */
/*************************************/
async function abrirVistaPreviaInventario(boton) {
    if (consultaUrlInventarioEnProceso) {
        return;
    }

    consultaUrlInventarioEnProceso = true;

    if (typeof window.mostrarLoaderPeticion === "function") {
        window.mostrarLoaderPeticion();
    }

    const idInventario = boton?.dataset?.id || "";

    const idArchivo = boton?.dataset?.idArchivo || "";

    const codigo = boton?.dataset?.codigo || "";

    const titulo = boton?.dataset?.titulo || "";

    const clasificacion = boton?.dataset?.clasificacion || "Pública";

    const vigencia = boton?.dataset?.vigencia || "";

    const semaforo = boton?.dataset?.semaforo || "";

    const vigenciaFormateada = formatearFechaVigenciaInventario(vigencia);

    const tipoRegistro = String(
        boton?.dataset?.tipoRegistro || boton?.dataset?.tipo || ""
    )
        .trim()
        .toUpperCase();

    const esDocumento =
        tipoRegistro === "DOCUMENTO" || tipoRegistro === "DOCUMENTOS";

    const esNorma = tipoRegistro === "NORMA";

    const datosBoton = boton?.dataset || {};

    const contenidoId =
        datosBoton.contenidoId || datosBoton.idContenido || idInventario;

    const idContenido = datosBoton.idContenido || contenidoId;

    const idRegistro = datosBoton.idRegistro || contenidoId || idInventario;

    const documentoId =
        datosBoton.documentoId || datosBoton.archivoId || idArchivo;

    const archivoId = datosBoton.archivoId || documentoId || idArchivo;

    const versionId = datosBoton.versionId || "";

    const tituloNorma = datosBoton.tituloNorma || titulo;

    const fechaDesde = datosBoton.fechaDesde || "";

    const fechaHasta = datosBoton.fechaHasta || vigencia;

    const fechaModificacion = datosBoton.fechaModificacion || "";

    const nombreArchivo = datosBoton.nombreArchivo || datosBoton.nombre || "";

    const nombre = datosBoton.nombre || nombreArchivo;

    const endpoint =
        datosBoton.endpoint ||
        (contenidoId && idArchivo
            ? `/api/v1/inventario/documentos/${contenidoId}/formatos/${idArchivo}`
            : "");

    const isUpdate = obtenerBooleanoDatasetInventario(datosBoton.isUpdate);

    const vigenciaManual = obtenerBooleanoDatasetInventario(
        datosBoton.vigenciaManual
    );

    const renovacion = obtenerBooleanoDatasetInventario(datosBoton.renovacion);

    const mostrarTituloNorma = obtenerBooleanoDatasetInventario(
        datosBoton.mostrarTituloNorma,
        Boolean(tituloNorma)
    );

    /*************************************/
    /* VALIDAR IDENTIFICADOR DEL ARCHIVO */
    /*************************************/
    try {
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

    /*************************************/
    /* VALIDAR ROL Y PERMISO DEL DOCUMENTO */
    /*************************************/
    const esAdministrador = await obtenerPermisoAdminInventario();

    const requiereValidarPermisos =
        !esAdministrador &&
        esNorma &&
        esClasificacionProtegidaInventario(clasificacion);

    let permisoDocumento = null;

    if (requiereValidarPermisos) {
        permisoDocumento = await window.obtenerPermisoDocumentoNormateca(
            contenidoId
        );
    }

    const puedeVerDocumento =
        esAdministrador ||
        !requiereValidarPermisos ||
        obtenerBooleanoDatasetInventario(permisoDocumento?.verPdf);

    const puedeDescargarDocumento =
        esAdministrador ||
        !requiereValidarPermisos ||
        obtenerBooleanoDatasetInventario(permisoDocumento?.descargarPdf);

    if (!puedeVerDocumento) {
        mostrarModalSinPermisoDocumento();

        return;
    }

        /*************************************/
        /* CONFIGURAR TRANSACCIÓN */
        /*************************************/
        sessionStorage.setItem(
            "functional-id",
            "Consultar url del documento en inventario"
        );

        if (typeof window.tokenizerTransactionId !== "function") {
            throw new Error(
                "No se encuentra disponible el tokenizador de transacciones."
            );
        }

        await window.tokenizerTransactionId();

        /*************************************/
        /* CONSULTAR URL DEL DOCUMENTO */
        /*************************************/
        if (typeof window.apiFetch !== "function") {
            throw new Error(
                "No se encuentra disponible el servicio para consultar el documento."
            );
        }

        const response = await window.apiFetch(
            "normativas",
            `/api/v1/inventario/${idArchivo}/url-descarga`
        );

        const result = response?.data || {};

        /*************************************/
        /* VALIDAR ERROR HTTP */
        /*************************************/
        const statusHttp = Number(response?.status || 200);

        const statusCode = Number(
            result?.errorMessageDTO?.statusCode ||
            result?.statusCode ||
            response?.status ||
            500
        );

        if (statusHttp < 200 || statusHttp >= 300) {
            const mensajeError =
                result?.errorMessageDTO?.message ||
                result?.errorMessageDTO?.detail ||
                result?.message ||
                `Error HTTP ${statusHttp}`;

            const error = new Error(mensajeError);

            error.statusCode = statusCode;

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
                "No fue posible consultar el documento.";

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
                "No fue posible consultar el documento.";

            const error = new Error(mensajeError);

            error.statusCode =
                result?.errorMessageDTO?.statusCode || result?.statusCode || 500;

            error.response = result;

            throw error;
        }

        /*************************************/
        /* OBTENER URL */
        /*************************************/
        const rutaDocumento = obtenerUrlDocumentoInventario(result?.dataResponse);

        if (!rutaDocumento) {
            const error = new Error(
                "El servicio no devolvió una URL válida para visualizar el documento."
            );

            error.statusCode = result?.statusCode || response?.status || 500;

            error.response = result;

            throw error;
        }

        const rutaDocumentoVisor = quitarDownloadUrlInventario(rutaDocumento);

        /*************************************/
        /* REGISTRAR BITÁCORA EXITOSA */
        /*************************************/
        const mensajeExito =
            result?.message || "Se consultó correctamente la URL del documento.";

        await registrarBitacoraUrlInventario(
            "GET",
            "Consultar url del documento en inventario",
            `Se consulta la URL del documento del inventario: ${tituloNorma || titulo || nombreArchivo || nombre || "Sin título"
            }`,
            result?.statusCode || response?.status || 200,
            mensajeExito
        );

        /*************************************/
        /* VALIDAR VISOR */
        /*************************************/
        if (typeof window.abrirVisorDocumento !== "function") {
            throw new Error("El visor de documentos no se encuentra disponible.");
        }

        /*************************************/
        /* METADATOS DEL DOCUMENTO */
        /*************************************/
        const extensionArchivo = esDocumento
            ? datosBoton.extensionArchivo || ""
            : "";

        const pesoArchivo = esDocumento ? datosBoton.pesoArchivo || "" : "";

        const fechaCreacion = esDocumento
            ? formatearFechaVigenciaInventario(datosBoton.fechaCreacion || "")
            : "";

        /*************************************/
        /* ABRIR VISOR */
        /*************************************/
        await window.abrirVisorDocumento({
            tipo: tipoRegistro,

            id: idInventario,

            idRegistro: idRegistro,

            contenidoId: contenidoId,

            idContenido: idContenido,

            versionId: versionId,

            idArchivo: idArchivo,

            documentoId: documentoId,

            archivoId: archivoId,

            codigo: codigo,

            titulo: titulo || codigo || "Documento",

            tituloNorma: tituloNorma,

            icono: esDocumento
                ? "bi bi-paperclip"
                : esNorma
                    ? "bi bi-folder"
                    : "bi bi-folder",

            clasificacion: clasificacion,

            fechaVigencia: vigenciaFormateada,

            semaforo: semaforo,

            vigencia: vigencia,

            fechaDesde: fechaDesde,

            fechaHasta: fechaHasta,

            fechaModificacion: fechaModificacion,

            ruta: datosBoton.ruta || rutaDocumentoVisor,

            nombre: nombre,

            nombreArchivo: nombreArchivo,

            ...(esDocumento
                ? {
                    extensionArchivo: extensionArchivo,
                    pesoArchivo: pesoArchivo,
                    fechaCreacion: fechaCreacion,
                }
                : {}),

            endpoint: endpoint,

            isUpdate: isUpdate,

            vigenciaManual: vigenciaManual,

            renovacion: renovacion,

            textoBoton: "Histórico",

            iconoBoton: "",

            rutaPdf: rutaDocumentoVisor,

            mostrarHome: true,
            tipoHome: "icono",
            iconoHome: "bi bi-house-fill",
            textoHome: "Pantalla principal",

            rutaHome: "/web/normateca/inventario",

            mostrarTitulo: true,

            mostrarIcono: true,

            mostrarClasificacion: true,

            mostrarFechaVigencia: true,

            mostrarTituloNorma: mostrarTituloNorma,

            mostrarDescargar: puedeDescargarDocumento,

            mostrarActualizar: esAdministrador && esDocumento,

            mostrarEliminar: esAdministrador && esDocumento,

            mostrarAgregarFormato: esAdministrador && (esDocumento || esNorma),

            mostrarActualizarNorma: false,

            mostrarBoton: esNorma,

            mostrarPdf: true,

            mostrarCerrar: true,

            onHome: function (data) {
                console.log("[VISOR INVENTARIO] Click Home:", data);

                window.location.href = "/web/normateca/inventario";
            },

            onBoton: function (data) {
                console.log("[VISOR INVENTARIO] Click Histórico:", data);

                const parametros = new URLSearchParams();

                if (idInventario) {
                    parametros.set("documento-prin", idInventario);
                }

                const queryString = parametros.toString();

                window.location.href =
                    "/web/normateca/historico" + (queryString ? `?${queryString}` : "");
            },

            onCerrar: function () {
                console.log("[VISOR INVENTARIO] Visor cerrado.");
            },
        });
    } catch (error) {
        console.error("[VISOR INVENTARIO] Error:", error);

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
            "No fue posible consultar el documento.";

        /*************************************/
        /* REGISTRAR BITÁCORA DE ERROR */
        /*************************************/
        await registrarBitacoraUrlInventario(
            "GET",
            "Consultar url documento inventario",
            `Error al consultar la URL del documento del inventario: ${tituloNorma || titulo || nombreArchivo || nombre || "Sin título"
            }`,
            statusCode,
            mensajeError
        );

        /*************************************/
        /* MOSTRAR MODAL DE ERROR */
        /*************************************/
        await new Promise((resolve) => setTimeout(resolve, 500));
            if (typeof abrirModal === "function") {
                abrirModal({
                    paso: 2,
                    tipo: "Error",
                    titulo: "Error",
                    contenido: mensajeError,
                    btnAceptar: "Cerrar",
                });
            }
    } finally {
        consultaUrlInventarioEnProceso = false;

        if (typeof window.ocultarLoaderPeticion === "function") {
            window.ocultarLoaderPeticion();
        }
    }
}

/*************************************/
/* EVENTOS DE INVENTARIO */
/*************************************/
document.addEventListener("click", async function (e) {
    /*************************************/
    /* BOTÓN ABRIR VISOR */
    /*************************************/
    const btnVisor = e.target.closest(".llamar-visor");

    if (btnVisor) {
        e.preventDefault();
        e.stopPropagation();

        await abrirVistaPreviaInventario(btnVisor);

        return;
    }

    /*************************************/
    /* BOTÓN ENGRANAJE */
    /*************************************/
    const btn = e.target.closest(".btn-engranaje");

    if (btn) {
        e.preventDefault();
        e.stopPropagation();

        console.log("ID seleccionado:", btn.dataset.id);

        return;
    }
});
