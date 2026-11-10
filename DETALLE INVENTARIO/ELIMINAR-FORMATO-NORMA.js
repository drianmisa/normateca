(function () {
    let enProceso = false;

    async function registrarBitacora(nombreFormato, tituloNorma, status, mensaje, eliminado) {
        try {
            await window.bitacoraService?.operationLog(
                "DELETE",
                "Inventario",
                "Eliminar formato de norma",
                eliminado
                    ? `Se ha eliminado el formato adjunto "${nombreFormato}" de la norma "${tituloNorma}".`
                    : `No se pudo eliminar el formato adjunto "${nombreFormato}" de la norma "${tituloNorma}".`,
                status,
                mensaje
            );
        } catch (error) {
            console.error("No fue posible registrar la eliminación del formato en bitácora:", error);
        }
    }

    async function eliminarFormatoNorma(contenidoId, documentoId, nombreFormato, tituloNorma) {
        if (enProceso) return;
        if (!contenidoId || !documentoId) {
            window.abrirModal({
                paso: 2, tipo: "Error", titulo: "Error",
                contenido: "No se encontraron los identificadores de la norma y del formato.",
                btnAceptar: "Cerrar",
            });
            return;
        }

        enProceso = true;
        window.abrirModal({
            paso: 1,
            titulo: "Eliminar formato",
            contenido: "¿Deseas eliminar este formato de la norma?",
            contenido1: "Esta acción no se puede deshacer.",
            btnAceptar: "Aceptar",
            btnCerrar: "Cancelar",
            onAceptar: async function (ok) {
                if (!ok) {
                    enProceso = false;
                    return;
                }

                window.mostrarLoaderPeticion();
                let resultadoModal;
                try {
                    sessionStorage.setItem("functional-id", "Eliminar formato de norma");
                    await window.tokenizerTransactionId();
                    const response = await window.apiDelete(
                        "normativas",
                        `/api/v1/inventario/normas/${encodeURIComponent(contenidoId)}/formatos/${encodeURIComponent(documentoId)}`
                    );
                    const resultado = response?.data || {};
                    const status = Number(resultado?.errorMessageDTO?.statusCode || resultado?.statusCode || response?.status || 500);
                    if (!response || response.ok === false || status >= 400) {
                        const error = new Error(resultado?.errorMessageDTO?.message || resultado?.message || "No fue posible eliminar el formato.");
                        error.statusCode = status;
                        throw error;
                    }
                    await registrarBitacora(nombreFormato, tituloNorma, status, JSON.stringify(resultado?.message || "Formato eliminado correctamente"), true);
                    resultadoModal = {
                        paso: 2, tipo: "Aceptar", titulo: "Completado",
                        contenido: "Formato eliminado correctamente", btnAceptar: "Cerrar",
                    };
                    // La eliminación ya terminó; un fallo al refrescar no debe registrarse como fallo del DELETE.
                    try {
                        await window.obtenerInformacionTabla();
                    } catch (error) {
                        console.error("No fue posible refrescar los formatos:", error);
                    }
                } catch (error) {
                    await registrarBitacora(nombreFormato, tituloNorma, Number(error?.statusCode || 500), error.message || "Error desconocido", false);
                    resultadoModal = {
                        paso: 2, tipo: "Error", titulo: "Error",
                        contenido: error.message || "No fue posible eliminar el formato.", btnAceptar: "Cerrar",
                    };
                } finally {
                    window.ocultarLoaderPeticion();
                    setTimeout(function () {
                        enProceso = false;
                        window.abrirModal(resultadoModal);
                    }, 500);
                }
            },
        });
    }

    // Reemplazar el listener evita duplicarlo cuando Liferay vuelve a cargar el fragmento.
    if (window.eventoEliminarFormatoNorma) {
        document.removeEventListener("click", window.eventoEliminarFormatoNorma);
    }
    window.eventoEliminarFormatoNorma = function (event) {
        const boton = event.target.closest(".btn-eliminar-formato-norma");
        if (!boton) return;
        event.preventDefault();
        event.stopPropagation();
        eliminarFormatoNorma(
            boton.dataset.contenidoId,
            boton.dataset.documentoId,
            boton.dataset.nombreFormato || "Sin nombre",
            boton.dataset.tituloNorma || "Sin título"
        );
    };
    document.addEventListener("click", window.eventoEliminarFormatoNorma);
})();
