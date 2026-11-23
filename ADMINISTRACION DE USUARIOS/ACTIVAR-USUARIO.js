/* Activar el registro de login desde el check mostrado para isBloqueo=true. */
(() => {
    const controlesEnProceso = new WeakSet();

    async function registrarActivacionLogin(datos, status, mensaje, completado) {
        try {
            await window.bitacoraService?.usuariosLog(
                "PATCH",
                "Activar registro de usuario",
                `${completado ? "Se activó" : "No se pudo activar"} el registro del usuario ${datos.nombre || datos.usuario}.`,
                status,
                mensaje,
                {
                    nombreUsuario: datos.nombre || "Sin dato",
                    expedienteUsuario: datos.expediente || "Sin dato",
                    rfcUsuario: "Sin dato",
                    areaUsuario: datos.area || "Sin dato",
                    puestoUsuario: datos.puesto || "Sin dato",
                    usuario: datos.usuario,
                },
                "Usuarios"
            );
        } catch (error) {
            console.error("No fue posible registrar la activación en bitácora:", error);
        }
    }

    function confirmarActivacionLogin(check) {
        const datos = { ...check.dataset };
        datos.usuario = String(datos.usuario || "").trim();
        let fase = "confirmando";
        const disabledAnterior = check.disabled;
        check.checked = false;
        check.disabled = true;

        function liberar() {
            check.checked = false;
            check.disabled = disabledAnterior;
            controlesEnProceso.delete(check);
        }
        function cancelar() {
            if (fase !== "confirmando") return;
            fase = "finalizado";
            liberar();
        }

        if (!datos.usuario) {
            cancelar();
            window.abrirModal({
                paso: 2, tipo: "Error", titulo: "Error",
                contenido: "No se encontró el usuario para activar su registro de login.",
                btnAceptar: "Cerrar",
            });
            return;
        }

        try {
            window.abrirModal({
                paso: 1,
                titulo: "Desbloquear usuario",
                contenido: `¿Deseas activar al usuario ${datos.nombre || datos.usuario}?`,
                btnAceptar: "Aceptar",
                btnCerrar: "Cancelar",
                onCancelar: cancelar,
                onCerrar: cancelar,
                onAceptar: async function (ok) {
                    if (fase !== "confirmando") return;
                    if (!ok) { cancelar(); return; }
                    fase = "enviando";
                    let resultadoModal;
                    try {
                        window.mostrarLoaderPeticion?.();
                        sessionStorage.setItem("functional-id", "Activar registro de usuario");
                        await window.tokenizerTransactionId();
                        const response = await window.apiPatch(
                            "normativas",
                            `/api/v1/administracion/usuarios/login/activo?ldapName=${encodeURIComponent(datos.usuario)}`,
                            { activo: true }
                        );
                        const resultado = response?.data || {};
                        const status = Number(resultado?.errorMessageDTO?.statusCode || resultado?.statusCode || response?.status || 500);
                        if (!response?.ok || status >= 400) {
                            const error = new Error(
                                resultado?.errorMessageDTO?.message || resultado?.message ||
                                (typeof resultado === "string" ? resultado : "No fue posible activar el usuario.")
                            );
                            error.statusCode = status >= 400 ? status : 500;
                            throw error;
                        }
                        const mensaje = resultado?.message || "Usuario activado correctamente.";
                        await registrarActivacionLogin(datos, status, mensaje, true);
                        // Un fallo de recarga no convierte una activación exitosa en error.
                        try {
                            await window.recargarUsuariosAdministracion();
                        } catch (errorRecarga) {
                            console.error("El usuario se activó, pero no se pudo recargar el listado:", errorRecarga);
                        }
                        resultadoModal = {
                            paso: 2, tipo: "Aceptar", titulo: "Completado",
                            contenido: mensaje, btnAceptar: "Cerrar",
                        };
                    } catch (error) {
                        const mensaje = error?.message || "No fue posible activar el usuario.";
                        await registrarActivacionLogin(datos, Number(error?.statusCode || 500), mensaje, false);
                        resultadoModal = {
                            paso: 2, tipo: "Error", titulo: "Error",
                            contenido: mensaje, btnAceptar: "Cerrar",
                        };
                    } finally {
                        fase = "finalizado";
                        liberar();
                        window.ocultarLoaderPeticion?.();
                    }
                    setTimeout(function () { window.abrirModal(resultadoModal); }, 500);
                },
            });
        } catch (error) {
            cancelar();
            console.error("No fue posible abrir la confirmación de activación:", error);
        }
    }

    if (window.administracionUsuariosEventoActivarLogin) {
        document.removeEventListener("click", window.administracionUsuariosEventoActivarLogin);
    }
    window.administracionUsuariosEventoActivarLogin = function (event) {
        const check = event.target?.closest?.(".check-activar-login-usuario");
        if (!check) return;
        event.preventDefault();
        event.stopPropagation();
        if (check.disabled || controlesEnProceso.has(check)) return;
        controlesEnProceso.add(check);
        // Esperar la restauración del checkbox que hace el navegador con preventDefault.
        setTimeout(function () { confirmarActivacionLogin(check); }, 0);
    };
    document.addEventListener("click", window.administracionUsuariosEventoActivarLogin);
})();

