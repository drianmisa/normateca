/*************************************/
/* UTILIDADES CAMBIO DE ROL */
/*************************************/
function obtenerDatoUsuarioBitacora(valor) {
    const dato = String(valor ?? "").trim();

    return dato || "Sin dato";
}

function restaurarRolAnterior(selectorRol, rolAnterior) {
    const opcionAnterior = Array.from(selectorRol.options || []).find(function (
        opcion
    ) {
        return (
            String(opcion.value).toLowerCase() ===
            String(rolAnterior ?? "").toLowerCase()
        );
    });

    if (opcionAnterior) {
        selectorRol.value = opcionAnterior.value;
    }
}

function obtenerDatosCambioRol(selectorRol) {
    return {
        criterioBusqueda: selectorRol.dataset.criterioBusqueda || "",

        nombre: selectorRol.dataset.nombre || "",

        area: selectorRol.dataset.area || "",

        puesto: selectorRol.dataset.puesto || "",

        expediente: selectorRol.dataset.expediente || "",

        correo: selectorRol.dataset.correo || "",

        usuario: selectorRol.dataset.usuario || "",

        registradoLiferay: selectorRol.dataset.registradoLiferay === "true",

        idUsuario: selectorRol.dataset.idUsuario || "",

        idUserGroup: selectorRol.dataset.idUserGroup || "",

        rolAnterior:
            selectorRol.dataset.rolAnterior || selectorRol.dataset.rol || "",

        rolSeleccionado: String(selectorRol.value || "")
            .trim()
            .toUpperCase(),
    };
}

function obtenerErrorCambioRol(error) {
    const resultado = {
        statusCode: 500,
        mensaje: "Error desconocido",
    };

    try {
        const mensajeExcepcion = String(error?.message || "");

        const inicioJson = mensajeExcepcion.indexOf("{");

        if (inicioJson !== -1) {
            const errorObj = JSON.parse(mensajeExcepcion.substring(inicioJson));

            resultado.statusCode =
                Number(
                    errorObj?.errorMessageDTO?.statusCode ?? errorObj?.statusCode ?? 500
                ) || 500;

            resultado.mensaje =
                errorObj?.errorMessageDTO?.message ||
                errorObj?.message ||
                "Error desconocido";
        } else if (mensajeExcepcion) {
            resultado.mensaje = mensajeExcepcion;
        }
    } catch (errorParseo) {
        console.error(
            "No fue posible interpretar el error del cambio de rol:",
            errorParseo
        );
    }

    return resultado;
}

/*************************************/
/* BITÁCORA CAMBIO DE ROL */
/*************************************/
async function registrarBitacoraCambioRol(
    statusCode,
    respuestaOperacion,
    detalleOperacion,
    datosUsuario
) {
    if (!window.bitacoraService?.usuariosLog) {
        console.warn("usuariosLog no está disponible");

        return;
    }

    await window.bitacoraService.usuariosLog(
        "PATCH",

        "Actualizar rol",

        detalleOperacion,

        Number(statusCode) || 500,

        respuestaOperacion,

        {
            nombreUsuario: obtenerDatoUsuarioBitacora(datosUsuario.nombre),

            expedienteUsuario: obtenerDatoUsuarioBitacora(datosUsuario.expediente),

            rfcUsuario: "Sin dato",

            areaUsuario: obtenerDatoUsuarioBitacora(datosUsuario.area),

            puestoUsuario: obtenerDatoUsuarioBitacora(datosUsuario.puesto),

            usuario: obtenerDatoUsuarioBitacora(datosUsuario.usuario),
        },

        "Perfiles"
    );
}

/*************************************/
/* CAMBIAR ROL DE USUARIO */
/*************************************/
async function cambiarRolUsuario(selectorRol) {
    const datosUsuario = obtenerDatosCambioRol(selectorRol);

    if (!datosUsuario.criterioBusqueda) {
        restaurarRolAnterior(selectorRol, datosUsuario.rolAnterior);

        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: "No se encontró el criterio de búsqueda del usuario.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    if (!datosUsuario.rolSeleccionado) {
        restaurarRolAnterior(selectorRol, datosUsuario.rolAnterior);

        abrirModal({
            paso: 2,
            tipo: "Error",
            titulo: "Error",
            contenido: "No se encontró el rol seleccionado.",
            btnAceptar: "Cerrar",
        });

        return;
    }

    if (
        datosUsuario.rolSeleccionado.toLowerCase() ===
        datosUsuario.rolAnterior.toLowerCase()
    ) {
        return;
    }

    setTimeout(() => {
        abrirModal({
            paso: 1,

            titulo: "Cambiar rol",

            contenido: `¿Deseas cambiar el rol de ${obtenerDatoUsuarioBitacora(
                datosUsuario.nombre
            )}?`,

            contenido1: `El rol cambiará de ${obtenerDatoUsuarioBitacora(
                datosUsuario.rolAnterior
            )} a ${datosUsuario.rolSeleccionado}.`,

            btnAceptar: "Aceptar",

            btnCerrar: "Cancelar",

            onAceptar: async (ok) => {
                /*
                 * Si el usuario cancela, se restaura
                 * el rol y no se realiza la petición.
                 */
                if (!ok) {
                    restaurarRolAnterior(selectorRol, datosUsuario.rolAnterior);

                    return;
                }

                selectorRol.disabled = true;
                window.mostrarLoaderPeticion();

                const detalleOperacion =
                    `Cambio de rol del usuario ${obtenerDatoUsuarioBitacora(
                        datosUsuario.nombre
                    )}, ` +
                    `rol anterior: ${obtenerDatoUsuarioBitacora(
                        datosUsuario.rolAnterior
                    )}, rol nuevo: ${datosUsuario.rolSeleccionado}`;

                try {
                    sessionStorage.setItem("functional-id", "ACTUALIZAR ROL DE USUARIO");

                    /*************************************/
                    /* TOKEN */
                    /*************************************/
                    await window.tokenizerTransactionId();

                    /*************************************/
                    /* ACTUALIZAR ROL */
                    /*************************************/
                    const response = await window.apiPatch(
                        "normativas",
                        "/api/v1/administracion/usuarios/rol",
                        {
                            criterioBusqueda: datosUsuario.criterioBusqueda,

                            rol: datosUsuario.rolSeleccionado,
                        }
                    );

                    if (!response?.ok) {
                        throw new Error(
                            typeof response?.data === "string"
                                ? response.data
                                : JSON.stringify(
                                    response?.data || {
                                        statusCode: response?.status || 500,
                                    }
                                )
                        );
                    }

                    const statusCode =
                        Number(response?.data?.statusCode ?? response?.status ?? 200) ||
                        200;

                    const mensajeRespuesta =
                        response?.data?.message || "Rol actualizado correctamente";

                    /*************************************/
                    /* BITÁCORA OK */
                    /*************************************/
                    await registrarBitacoraCambioRol(
                        statusCode,
                        JSON.stringify(mensajeRespuesta),
                        detalleOperacion,
                        datosUsuario
                    );

                    selectorRol.dataset.rol = datosUsuario.rolSeleccionado;

                    selectorRol.dataset.rolAnterior = datosUsuario.rolSeleccionado;

                    window.ocultarLoaderPeticion();

                    /*************************************/
                    /* MODAL OK */
                    /*************************************/
                    setTimeout(() => {
                        abrirModal({
                            paso: 2,
                            tipo: "Aceptar",
                            titulo: "Completado",
                            contenido: "Rol actualizado correctamente",
                            btnAceptar: "Cerrar",
                        });
                    }, 500);
                } catch (error) {
                    /*************************************/
                    /* BITÁCORA ERROR */
                    /*************************************/
                    const detalleError = obtenerErrorCambioRol(error);

                    restaurarRolAnterior(selectorRol, datosUsuario.rolAnterior);

                    try {
                        await registrarBitacoraCambioRol(
                            detalleError.statusCode,
                            detalleError.mensaje,
                            detalleOperacion,
                            datosUsuario
                        );
                    } catch (errorBitacora) {
                        console.error(
                            "No fue posible registrar el error del cambio de rol en bitácora:",
                            errorBitacora
                        );
                    }

                    window.ocultarLoaderPeticion();

                    setTimeout(() => {
                        abrirModal({
                            paso: 2,
                            tipo: "Error",
                            titulo: "Error",
                            contenido:
                                detalleError.mensaje || "No fue posible actualizar el rol",
                            btnAceptar: "Cerrar",
                        });
                    }, 500);
                } finally {
                    selectorRol.disabled = false;
                }
            },
            onCancelar: () => {
                restaurarRolAnterior(selectorRol, datosUsuario.rolAnterior);
            },
        });
    }, 500);
}

/*************************************/
/* CHANGE DEL SELECTOR DE ROL */
/*************************************/
document.addEventListener("change", function (event) {
    const selectorRol = event.target.closest(".cambiar-rol-usuario");

    if (!selectorRol) {
        return;
    }

    cambiarRolUsuario(selectorRol);
});
