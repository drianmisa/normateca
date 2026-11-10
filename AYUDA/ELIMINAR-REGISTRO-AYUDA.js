/*************************************/
/* ELIMINAR */
/*************************************/
async function eliminarRecurso(id, titulo = "") {
    setTimeout(() => {
        abrirModal({
            paso: 1,

            titulo: "Eliminar registro",

            contenido: "¿Deseas eliminar este registro?",

            contenido1: "Esta acción no se puede deshacer.",

            btnAceptar: "Aceptar",

            btnCerrar: "Cancelar",

            onAceptar: async (ok) => {
                if (!ok) return;

                window.mostrarLoaderPeticion();

                try {
                    sessionStorage.setItem("functional-id", "ELIMINAR REGISTRO AYUDA");

                    /*************************************/
                    /* TOKEN */
                    /*************************************/
                    await window.tokenizerTransactionId();

                    /*************************************/
                    /* ELIMINAR */
                    /*************************************/
                    const response = await window.apiDelete(
                        "normativas",
                        `/api/v1/recursos-ayuda/${id}`
                    );

                    const statusCode = response?.data?.statusCode;

                    if (
                        !response.ok ||
                        (statusCode != null &&
                            !(Number(statusCode) >= 200 && Number(statusCode) < 300))
                    ) {
                        throw new Error(statusCode || response.status);
                    }

                    /*************************************/
                    /* RECARGAR SOLO TRAS ELIMINAR CON ÉXITO */
                    /*************************************/
                    await window.obtenerInformacionAyuda();

                    /*************************************/
                    /* BITACORA OK */
                    /*************************************/
                    await window.bitacoraService.operationLog(
                        "DELETE",

                        "RECURSOS AYUDA",

                        "ELIMINAR RECURSO",

                        `Eliminación recurso ayuda: ${titulo}`,

                        response.data.statusCode || 200,

                        JSON.stringify(response?.data?.message || "Eliminacion completada")
                    );

                    window.ocultarLoaderPeticion();

                    /*************************************/
                    /* MODAL OK */
                    /*************************************/
                    setTimeout(() => {
                        abrirModal({
                            paso: 2,

                            tipo: "Aceptar",

                            titulo: "Completado",

                            contenido: "Registro eliminado correctamente",

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

                        await window.bitacoraService.operationLog(
                            "DELETE",

                            "RECURSOS AYUDA",

                            "ELIMINAR RECURSO",

                            `Eliminación recurso ayuda: ${titulo}`,

                            errorObj?.errorMessageDTO?.statusCode || 500,

                            errorObj?.errorMessageDTO?.message || "Error desconocido"
                        );
                    }

                    window.ocultarLoaderPeticion();

                    abrirModal({
                        paso: 2,

                        tipo: "Error",

                        titulo: "Error",

                        contenido: "No fue posible eliminar",

                        btnAceptar: "Cerrar",
                    });
                }
            },
        });
    }, 500);
}

/*************************************/
/* CLICK ELIMINAR */
/*************************************/
document.addEventListener("click", function (e) {
    const btnEliminar = e.target.closest("#delete");

    if (!btnEliminar) return;

    eliminarRecurso(btnEliminar.dataset.id, btnEliminar.dataset.titulo || "");
});
