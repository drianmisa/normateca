
(async () => {
    // Retirar el listener anterior antes de cualquier operación asíncrona.
    if (window.Liferay && window.administracionUsuariosEventoNavigate) {
        window.Liferay.detach(
            "endNavigate",
            window.administracionUsuariosEventoNavigate
        );
    }

    // Compartir el estado entre ejecuciones del fragmento.
    // Un contenedor nuevo permite cargar de nuevo al regresar a esta página.
    if (!(window.administracionUsuariosCargas instanceof WeakMap)) {
        window.administracionUsuariosCargas = new WeakMap();
    }
    const rolNORMATECA = window.obtenerRolNORMATECA?.() || null;

    const rolUsuario = rolNORMATECA?.nombre || "";
    const nivelPermiso = Number(rolNORMATECA?.permisos ?? -1);

    const esAdministradorPrincipalNORMATECA = nivelPermiso === 3;
    const esAdministradorNORMATECA = nivelPermiso === 2;
    const esLectorNORMATECA = nivelPermiso === 1;

    /*
        |--------------------------------------------------------------------------
        | CONFIGURACIÓN
        |--------------------------------------------------------------------------
        */

    const CONFIGURACION_ADMINISTRACION_USUARIOS = {
        endpoint: "/api/v1/administracion/usuarios",
        functionalId: "Consulta de administración de usuarios",
        nombreOperacion: "Obtener usuarios de normateca",
        descripcionOperacion:
            "Se consulta el listado de usuarios para su administración",
    };

    /*
        |--------------------------------------------------------------------------
        | UTILIDADES
        |--------------------------------------------------------------------------
        */

    function escaparHtml(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function obtenerDataResponse(response) {
        const dataResponse =
            response?.data?.dataResponse ?? response?.dataResponse ?? [];

        return Array.isArray(dataResponse) ? dataResponse : [];
    }

    function obtenerDetalleError(error) {
        const resultado = {
            statusCode: 500,
            message: error?.message || "Error desconocido al consultar los usuarios",
        };

        const mensajeError = String(error?.message ?? "");
        const indiceJson = mensajeError.indexOf("{");

        if (indiceJson === -1) {
            return resultado;
        }

        try {
            const errorObj = JSON.parse(mensajeError.substring(indiceJson));

            resultado.statusCode =
                errorObj?.errorMessageDTO?.statusCode ?? errorObj?.statusCode ?? 500;

            resultado.message =
                errorObj?.errorMessageDTO?.message ||
                errorObj?.message ||
                resultado.message;
        } catch (errorParseo) {
            console.error(
                "[ADMINISTRACIÓN USUARIOS] No fue posible interpretar el error:",
                errorParseo
            );
        }

        return resultado;
    }

    /*
        |--------------------------------------------------------------------------
        | BITÁCORA
        |--------------------------------------------------------------------------
        */

    async function registrarBitacoraUsuarios(statusCode, mensaje) {
        if (!window.bitacoraService?.operationLog) {
            console.warn(
                "[ADMINISTRACIÓN USUARIOS] bitacoraService no está disponible"
            );
            return;
        }

        await window.bitacoraService.operationLog(
            "GET",
            "Consultar",
            CONFIGURACION_ADMINISTRACION_USUARIOS.nombreOperacion,
            CONFIGURACION_ADMINISTRACION_USUARIOS.descripcionOperacion,
            statusCode,
            JSON.stringify(mensaje || "Consulta exitosa")
        );
    }

    /*
        |--------------------------------------------------------------------------
        | NORMALIZAR USUARIOS
        |--------------------------------------------------------------------------
        */

    function normalizarUsuario(usuario) {
        const registro = usuario && typeof usuario === "object" ? usuario : {};

        return {
            criterioBusqueda: registro.criterioBusqueda ?? "",
            nombre: registro.nombre ?? "",
            area: registro.area ?? "",
            puesto: registro.puesto ?? "",
            expediente: registro.expediente ?? "",
            correo: registro.correo ?? "",
            usuario: registro.usuario ?? "",
            registradoLiferay: registro.registradoLiferay === true,
            idUsuario: registro.idUsuario ?? "",
            idUserGroup: registro.idUserGroup ?? "",
            rol: registro.rol ?? "Lector",
            activo: registro.activo === true,
        };
    }

    /*
        |--------------------------------------------------------------------------
        | CREAR SELECTOR DE ROL
        |--------------------------------------------------------------------------
        */

    function crearSelectorRol(usuario) {
        const rolActual = String(usuario.rol ?? "").trim();

        return `
            <select
              class="form-select selector-rol-usuario cambiar-rol-usuario"
              data-criterio-busqueda="${escaparHtml(usuario.criterioBusqueda)}"
              data-id="${escaparHtml(usuario.idUsuario)}"
              data-id-usuario="${escaparHtml(usuario.idUsuario)}"
              data-user-group-id="${escaparHtml(usuario.idUserGroup)}"
              data-id-user-group="${escaparHtml(usuario.idUserGroup)}"
              data-nombre="${escaparHtml(usuario.nombre)}"
              data-area="${escaparHtml(usuario.area)}"
              data-puesto="${escaparHtml(usuario.puesto)}"
              data-expediente="${escaparHtml(usuario.expediente)}"
              data-correo="${escaparHtml(usuario.correo)}"
              data-usuario="${escaparHtml(usuario.usuario)}"
              data-registrado-liferay="${escaparHtml(usuario.registradoLiferay)}"
              data-rol="${escaparHtml(rolActual)}"
              data-rol-anterior="${escaparHtml(rolActual)}"
              aria-label="Rol de ${escaparHtml(usuario.nombre)}"
            >
              <option
                value="Administrador"
                ${rolActual.toLowerCase() === "administrador" ? "selected" : ""}
              >
                Administrador
              </option>
      
              <option
                value="Lector"
                ${rolActual.toLowerCase() === "lector" ? "selected" : ""}
              >
                Lector
              </option>
            </select>
          `;
    }

    /*
        |--------------------------------------------------------------------------
        | CREAR TABLA
        |--------------------------------------------------------------------------
        */

    function deshabilitarSelectoresAdministrador(esAdministrador) {
        if (!esAdministrador) return;

        const selectoresAdministrador = document.querySelectorAll(
            'select.selector-rol-usuario[data-rol="ADMINISTRADOR"]'
        );

        selectoresAdministrador.forEach((selector) => {
            selector.disabled = true;
        });
    }
    function deshabilitarSelectoresLectura(esLector) {
        if (!esLector) return;

        const selectores = document.querySelectorAll("select.selector-rol-usuario");

        selectores.forEach((selector) => {
            selector.disabled = true;
        });

        const botones = document.querySelectorAll("a.btn.btn-primary");

        botones.forEach((boton) => {
            if (boton.textContent.trim() === "Asignar permisos") {
                boton.style.display = "none";
            }
        });
    }
    function crearTablaAdministracionUsuarios(usuarios) {
        if (typeof window.crearTablaDinamica !== "function") {
            throw new Error("crearTablaDinamica no está disponible");
        }

        const filas = usuarios.map(function (usuario) {
            const urlPermisos =
                "/web/normateca/administracion-permisos" +
                `?criterioBusqueda=${encodeURIComponent(usuario.criterioBusqueda)}` +
                `&nombre=${encodeURIComponent(usuario.nombre)}` +
                `&area=${encodeURIComponent(usuario.area)}` +
                `&puesto=${encodeURIComponent(usuario.puesto)}` +
                `&expediente=${encodeURIComponent(usuario.expediente)}` +
                `&correo=${encodeURIComponent(usuario.correo)}` +
                `&usuario=${encodeURIComponent(usuario.nombre)}` +
                `&registradoLiferay=${encodeURIComponent(usuario.registradoLiferay)}` +
                `&idUsuario=${encodeURIComponent(usuario.idUsuario)}` +
                `&idUserGroup=${encodeURIComponent(usuario.idUserGroup)}` +
                `&rol=${encodeURIComponent(usuario.rol)}`;

            return `
              <td>
                ${escaparHtml(usuario.nombre)}
              </td>
      
              <td>
                ${escaparHtml(usuario.area)}
              </td>
      
              <td>
                ${escaparHtml(usuario.puesto)}
              </td>
      
              <td>
                ${escaparHtml(usuario.expediente)}
              </td>
      
              <td>
                ${crearSelectorRol(usuario)}
              </td>
      
              <td>
                <div class="form-check form-switch">
                    <input
                        class="form-check-input switch-activo-usuario"
                        type="checkbox"
                        role="switch"
                        data-id-usuario="${escaparHtml(usuario.idUsuario)}"
                        data-activo-anterior="${usuario.activo}"
                        data-nombre="${escaparHtml(usuario.nombre)}"
                        data-area="${escaparHtml(usuario.area)}"
                        data-puesto="${escaparHtml(usuario.puesto)}"
                        data-expediente="${escaparHtml(usuario.expediente)}"
                        data-usuario="${escaparHtml(usuario.usuario)}"
                        aria-label="Usuario activo: ${escaparHtml(
                usuario.nombre
            )}"
                        ${usuario.activo ? "checked" : ""}
                        ${esLectorNORMATECA ||
                    (esAdministradorNORMATECA &&
                        String(usuario.rol).trim().toLowerCase() ===
                        "administrador")
                    ? "disabled"
                    : ""
                }
                    >
                </div>
              </td>
      
              <td>
                <a
                  class="btn btn-primary"
                  href="${escaparHtml(urlPermisos)}"
                >
                  Asignar permisos
                </a>
              </td>
            `;
        });

        window.crearTablaDinamica({
            contenedor: "#tabla-dinamica",
            titulo: "Administración de usuarios",
            mostrarFiltroAnio: false,
            botonAccion: {
                mostrar: false,
                titulo: "",
                icono: "",
            },
            columnas: [
                {
                    titulo: "Nombre",
                    ordenar: true,
                },
                {
                    titulo: "Área de adscripción",
                    ordenar: true,
                },
                {
                    titulo: "Puesto",
                    ordenar: true,
                },
                {
                    titulo: "Número de expediente",
                    ordenar: true,
                },
                {
                    titulo: "Rol",
                    ordenar: false,
                },
                {
                    titulo: "Activo",
                    ordenar: false,
                },
                {
                    titulo: "Acciones",
                    ordenar: false,
                },
            ],
            filas,
        });

        deshabilitarSelectoresAdministrador(esAdministradorNORMATECA);
        deshabilitarSelectoresLectura(esLectorNORMATECA);
    }

    /*
        |--------------------------------------------------------------------------
        | CONSULTAR USUARIOS
        |--------------------------------------------------------------------------
        */
    function cambiarMensajeSinResultados() {
        const celdas = document.querySelectorAll("#tabla-dinamica td.text-center");

        celdas.forEach((td) => {
            if (td.textContent.trim() === "No se encontraron resultados") {
                td.textContent =
                    "Usuario no encontrado en la base de datos de Recursos Humanos (SIAL)";
            }
        });
    }
    // Ejecutar inicialmente
    cambiarMensajeSinResultados();

    // Detectar cuando el buscador modifica/reconstruye la tabla
    const tabla = document.getElementById("tabla-dinamica");

    if (tabla) {
        const observer = new MutationObserver(() => {
            cambiarMensajeSinResultados();
        });

        observer.observe(tabla, {
            childList: true,
            subtree: true,
        });
    }

    function validarServiciosConsultaUsuarios() {
        if (typeof window.tokenizerTransactionId !== "function") {
            throw new Error("tokenizerTransactionId no está disponible");
        }

        if (typeof window.apiFetch !== "function") {
            throw new Error("apiFetch no está disponible");
        }
    }

    function validarRespuestaConsultaUsuarios(response) {
        const statusCode = Number(
            response?.data?.errorMessageDTO?.statusCode ??
            response?.data?.statusCode ??
            response?.statusCode ??
            response?.status ??
            200
        );

        const esError = !response || response.ok === false || statusCode >= 400;

        if (!esError) {
            return;
        }

        const message =
            response?.data?.errorMessageDTO?.message ||
            response?.data?.message ||
            response?.errorMessageDTO?.message ||
            response?.message ||
            "No fue posible consultar los usuarios";

        throw new Error(
            JSON.stringify({
                statusCode: statusCode >= 400 ? statusCode : 500,
                message,
            })
        );
    }

    async function registrarBitacoraConsultaSegura(statusCode, mensaje) {
        try {
            await registrarBitacoraUsuarios(statusCode, mensaje);
        } catch (errorBitacora) {
            // La falla de bitácora no cambia el resultado de la consulta.
            console.error(
                "[ADMINISTRACIÓN USUARIOS] Error al registrar la bitácora:",
                errorBitacora
            );
        }
    }

    async function obtenerUsuariosAdministracion() {
        try {
            if (typeof window.mostrarLoaderPeticion === "function") {
                window.mostrarLoaderPeticion();
            }

            validarServiciosConsultaUsuarios();

            sessionStorage.setItem(
                "functional-id",
                CONFIGURACION_ADMINISTRACION_USUARIOS.functionalId
            );

            // Esperar la preparación de los tokens antes de ejecutar el GET.
            await window.tokenizerTransactionId();

            console.log(
                "[ADMINISTRACIÓN USUARIOS] Ejecutando GET",
                CONFIGURACION_ADMINISTRACION_USUARIOS.endpoint
            );

            const response = await window.apiFetch(
                "normativas",
                CONFIGURACION_ADMINISTRACION_USUARIOS.endpoint
            );

            // Un 403 u otro error no debe convertirse en una tabla vacía.
            validarRespuestaConsultaUsuarios(response);

            const usuarios = obtenerDataResponse(response).map(normalizarUsuario);

            crearTablaAdministracionUsuarios(usuarios);

            await registrarBitacoraConsultaSegura(
                response?.data?.statusCode ??
                response?.statusCode ??
                response?.status ??
                200,
                response?.data?.message || response?.message || "Consulta exitosa"
            );

            return usuarios;
        } catch (error) {
            const detalleError = obtenerDetalleError(error);

            console.error(
                "[ADMINISTRACIÓN USUARIOS] Error al consultar los usuarios:",
                error
            );

            await registrarBitacoraConsultaSegura(
                detalleError.statusCode,
                detalleError.message
            );

            return [];
        } finally {
            if (typeof window.ocultarLoaderPeticion === "function") {
                window.ocultarLoaderPeticion();
            }
        }
    }

    /*
        |--------------------------------------------------------------------------
        | INICIALIZAR
        |--------------------------------------------------------------------------
        */

    function inicializarAdministracionUsuarios() {
        const contenedor = document.getElementById("tabla-dinamica");
        if (!contenedor) {
            return Promise.resolve([]);
        }

        const cargas = window.administracionUsuariosCargas;
        const cargaExistente = cargas.get(contenedor);
        if (cargaExistente) {
            return cargaExistente;
        }

        // Registrar la promesa antes de iniciar el GET: tanto la ejecución
        // inmediata como endNavigate reutilizan la misma carga.
        const carga = Promise.resolve().then(() => obtenerUsuariosAdministracion());
        cargas.set(contenedor, carga);
        return carga;
    }

    /*
        |--------------------------------------------------------------------------
        | NAVEGACIÓN SPA DE LIFERAY
        |--------------------------------------------------------------------------
        */

    if (window.Liferay) {
        window.administracionUsuariosEventoNavigate = function () {
            return inicializarAdministracionUsuarios();
        };

        window.Liferay.on(
            "endNavigate",
            window.administracionUsuariosEventoNavigate
        );
    }

    /*
        |--------------------------------------------------------------------------
        | EJECUCIÓN INMEDIATA
        |--------------------------------------------------------------------------
        */

    await inicializarAdministracionUsuarios();
})();

/*************************************/
/* ACTIVAR / INACTIVAR USUARIO */
/*************************************/
(() => {
    const switchesEnProceso = new WeakSet();

    function obtenerDato(valor) {
        return String(valor ?? "").trim() || "Sin dato";
    }

    function obtenerDatos(switchUsuario) {
        return {
            idUsuario: switchUsuario.dataset.idUsuario || "",
            activoAnterior: switchUsuario.dataset.activoAnterior === "true",
            nombre: switchUsuario.dataset.nombre || "",
            area: switchUsuario.dataset.area || "",
            puesto: switchUsuario.dataset.puesto || "",
            expediente: switchUsuario.dataset.expediente || "",
            usuario: switchUsuario.dataset.usuario || "",
        };
    }

    function obtenerError(error) {
        const resultado = {
            statusCode: 500,
            mensaje:
                error?.message || "No fue posible actualizar el estado del usuario",
        };
        const texto = String(error?.message || "");
        const inicioJson = texto.indexOf("{");
        if (inicioJson === -1) {
            return resultado;
        }
        try {
            const data = JSON.parse(texto.substring(inicioJson));
            resultado.statusCode =
                Number(data?.errorMessageDTO?.statusCode ?? data?.statusCode ?? 500) ||
                500;
            resultado.mensaje =
                data?.errorMessageDTO?.message || data?.message || resultado.mensaje;
        } catch (errorParseo) {
            console.error(
                "No fue posible interpretar el error del estado del usuario:",
                errorParseo
            );
        }
        return resultado;
    }

    /*************************************/
    /* BITÁCORA DE USUARIOS */
    /*************************************/
    async function registrarBitacora(
        statusCode,
        respuestaOperacion,
        detalleOperacion,
        datosUsuario,
        activoNuevo
    ) {
        try {
            if (!window.bitacoraService?.usuariosLog) {
                console.warn("usuariosLog no está disponible");
                return;
            }
            await window.bitacoraService.usuariosLog(
                "PATCH",
                activoNuevo ? "ACTIVAR USUARIO" : "INACTIVAR USUARIO",
                detalleOperacion,
                Number(statusCode) || 500,
                respuestaOperacion,
                {
                    nombreUsuario: obtenerDato(datosUsuario.nombre),
                    expedienteUsuario: obtenerDato(datosUsuario.expediente),
                    rfcUsuario: "Sin dato",
                    areaUsuario: obtenerDato(datosUsuario.area),
                    puestoUsuario: obtenerDato(datosUsuario.puesto),
                    usuario: obtenerDato(datosUsuario.usuario),
                },
                "Usuarios"
            );
        } catch (errorBitacora) {
            // Un error en bitácora no revierte un cambio exitoso del servidor.
            console.error(
                "No fue posible registrar el cambio de estado en bitácora:",
                errorBitacora
            );
        }
    }

    /*************************************/
    /* CONFIRMAR CAMBIO DE ESTADO */
    /*************************************/
    function confirmarCambio(switchUsuario) {
        const datosUsuario = obtenerDatos(switchUsuario);
        const activoNuevo = !datosUsuario.activoAnterior;
        const accion = activoNuevo ? "Activar" : "Inactivar";
        const estabaDeshabilitado = switchUsuario.disabled;

        switchUsuario.checked = datosUsuario.activoAnterior;
        switchUsuario.disabled = true;

        function liberarSwitch() {
            switchUsuario.disabled = estabaDeshabilitado;
            switchesEnProceso.delete(switchUsuario);
        }
        function cancelarCambio() {
            switchUsuario.checked = datosUsuario.activoAnterior;
            liberarSwitch();
        }

        // El endpoint identifica al usuario mediante data-usuario.
        if (!datosUsuario.usuario.trim()) {
            cancelarCambio();
            abrirModal({
                paso: 2,
                tipo: "Error",
                titulo: "Error",
                contenido:
                    "No se encontró el usuario en data-usuario para el criterio de búsqueda.",
                btnAceptar: "Cerrar",
            });
            return;
        }

        // Evita ejecutar dos veces la petición si el modal repite el callback.
        let confirmacionProcesada = false;
        try {
            abrirModal({
                paso: 1,
                titulo: `${accion} usuario`,
                contenido:
                    `¿Deseas ${accion.toLowerCase()} al usuario ` +
                    `${obtenerDato(datosUsuario.nombre)}?`,
                contenido1:
                    `El estado cambiará de ` +
                    `${datosUsuario.activoAnterior ? "Activo" : "Inactivo"} a ` +
                    `${activoNuevo ? "Activo" : "Inactivo"}.`,
                btnAceptar: "Aceptar",
                btnCerrar: "Cancelar",

                onAceptar: async (ok) => {
                    if (confirmacionProcesada) {
                        return;
                    }
                    confirmacionProcesada = true;
                    if (!ok) {
                        cancelarCambio();
                        return;
                    }

                    const detalleOperacion =
                        `Cambio de estado del usuario ${obtenerDato(
                            datosUsuario.nombre
                        )}, ` +
                        `estado anterior: ${datosUsuario.activoAnterior ? "Activo" : "Inactivo"
                        }, ` +
                        `estado nuevo: ${activoNuevo ? "Activo" : "Inactivo"}`;
                    let resultadoModal;
                    try {
                        window.mostrarLoaderPeticion();
                        sessionStorage.setItem(
                            "functional-id",
                            activoNuevo ? "ACTIVAR USUARIO" : "INACTIVAR USUARIO"
                        );
                        await window.tokenizerTransactionId();

                        /*************************************/
                        /* ACTUALIZAR ESTADO */
                        /*************************************/
                        const response = await window.apiPatch(
                            "normativas",
                            "/api/v1/administracion/usuarios/estado",
                            {
                                criterioBusqueda: datosUsuario.usuario,
                                activo: activoNuevo,
                            }
                        );

                        if (!response?.ok) {
                            throw new Error(
                                typeof response?.data === "string"
                                    ? response.data
                                    : JSON.stringify({
                                        ...(response?.data || {}),
                                        statusCode:
                                            response?.data?.statusCode ?? response?.status ?? 500,
                                    })
                            );
                        }

                        // Actualizar el switch sólo después del éxito del servidor.
                        switchUsuario.checked = activoNuevo;
                        switchUsuario.dataset.activoAnterior = String(activoNuevo);
                        const statusCode =
                            Number(response?.data?.statusCode ?? response?.status ?? 200) ||
                            200;
                        const mensajeRespuesta =
                            response?.data?.message ||
                            (activoNuevo
                                ? "Usuario activado correctamente"
                                : "Usuario inactivado correctamente");
                        await registrarBitacora(
                            statusCode,
                            JSON.stringify(mensajeRespuesta),
                            detalleOperacion,
                            datosUsuario,
                            activoNuevo
                        );
                        resultadoModal = {
                            paso: 2,
                            tipo: "Aceptar",
                            titulo: "Completado",
                            contenido: mensajeRespuesta,
                            btnAceptar: "Cerrar",
                        };
                    } catch (error) {
                        const detalleError = obtenerError(error);
                        switchUsuario.checked = datosUsuario.activoAnterior;
                        await registrarBitacora(
                            detalleError.statusCode,
                            detalleError.mensaje,
                            detalleOperacion,
                            datosUsuario,
                            activoNuevo
                        );
                        resultadoModal = {
                            paso: 2,
                            tipo: "Error",
                            titulo: "Error",
                            contenido: detalleError.mensaje,
                            btnAceptar: "Cerrar",
                        };
                    } finally {
                        try {
                            window.ocultarLoaderPeticion();
                        } finally {
                            liberarSwitch();
                        }
                    }
                    setTimeout(() => {
                        abrirModal(resultadoModal);
                    }, 500);
                },

                onCancelar: () => {
                    if (confirmacionProcesada) {
                        return;
                    }
                    confirmacionProcesada = true;
                    cancelarCambio();
                },
            });
        } catch (error) {
            cancelarCambio();
            console.error("No fue posible abrir el modal:", error);
        }
    }

    /*************************************/
    /* CLICK DEL SWITCH */
    /*************************************/
    function manejarClick(event) {
        const switchUsuario = event.target?.closest?.(".switch-activo-usuario");
        if (!switchUsuario) {
            return;
        }
        // Cancela el cambio automático del checkbox.
        event.preventDefault();
        if (switchUsuario.disabled || switchesEnProceso.has(switchUsuario)) {
            return;
        }
        switchesEnProceso.add(switchUsuario);
        /*
         * Se espera a que termine el click: el navegador restaura
         * el checkbox al cancelar su acción con preventDefault().
         */
        setTimeout(() => {
            confirmarCambio(switchUsuario);
        }, 0);
    }

    // Evita duplicar este listener cuando Liferay ejecuta el fragmento otra vez.
    if (window.administracionUsuariosEventoEstado) {
        document.removeEventListener(
            "click",
            window.administracionUsuariosEventoEstado
        );
    }
    window.administracionUsuariosEventoEstado = manejarClick;
    document.addEventListener("click", window.administracionUsuariosEventoEstado);
})();

