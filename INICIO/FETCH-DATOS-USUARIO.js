(async () => {
    /*************************************/
    /* ESPERAR FUNCIÓN GLOBAL */
    /*************************************/
    async function esperarFuncion(nombre, intentos = 50) {
        for (let i = 0; i < intentos; i++) {
            if (typeof window[nombre] === "function") {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        throw new Error(`No se encontró window.${nombre}`);
    }

    /*************************************/
    /* OBTENER GRUPOS DEL USUARIO */
    /*************************************/
    async function grupoUsuario() {
        try {
            const response = await fetch(
                "/o/headless-admin-user/v1.0/my-user-account",
                {
                    headers: {
                        Accept: "application/json",
                        "x-csrf-token": Liferay.authToken,
                    },
                    credentials: "include",
                }
            );

            if (!response.ok) {
                throw new Error(`Error obteniendo grupos: ${response.status}`);
            }

            const data = await response.json();
            const roles = data.roleBriefs?.map((rol) => rol.name) || [];

            const grupos =
                data.userGroupBriefs?.map((grupo) => ({
                    id: grupo.id,
                    nombre: grupo.name,
                    codigo: grupo.externalReferenceCode,
                })) || [];

            sessionStorage.setItem("userRoles", JSON.stringify(roles));
            sessionStorage.setItem("userGroups", JSON.stringify(grupos));

            return data;
        } catch (error) {
            console.error("Error obteniendo grupos:", error);
            throw error;
        }
    }

    /*************************************/
    /* OBTENER TOKEN OAUTH2 */
    /*************************************/
    async function tokenOAUTH2() {
        try {
            await esperarFuncion("obtenerTokenOAuth2");

            const token = await window.obtenerTokenOAuth2();

            if (!token) {
                throw new Error("obtenerTokenOAuth2 no devolvió ningún token");
            }

            const accessToken =
                typeof token === "string"
                    ? token
                    : token.access_token || token.accessToken || token.token || "";

            if (!accessToken) {
                throw new Error(
                    `No se encontró el access token en la respuesta: ${JSON.stringify(
                        token
                    )}`
                );
            }

            sessionStorage.setItem("Authorization", `Bearer ${accessToken}`);

            return accessToken;
        } catch (error) {
            console.error("Error obteniendo token OAuth2:", error);
            throw error;
        }
    }

    /*************************************/
    /* INFORMACIÓN LDAP */
    /*************************************/
    async function obtenerInformacionUsuario() {
        try {
            const url = new URL(window.location.href);

            url.searchParams.set(
                "p_p_id",
                "com_liferay_login_web_portlet_LoginPortlet"
            );

            url.searchParams.set("p_p_lifecycle", "2");
            url.searchParams.set("p_p_resource_id", "/banobras/token");

            const authResponse = await fetch(url.toString(), {
                credentials: "include",
            });

            if (!authResponse.ok) {
                throw new Error(
                    `Error obteniendo token Encode: ${authResponse.status}`
                );
            }

            const authData = await authResponse.json();

            sessionStorage.setItem("encode", authData?.credentials || "");
            sessionStorage.setItem("credentials", authData?.credentials || "");
            sessionStorage.setItem("token", authData?.token || "");

            await esperarFuncion("tokenizerTransactionId");
            await esperarFuncion("getGlobalHeaders");
            await window.tokenizerTransactionId();

            const headers = await window.getGlobalHeaders();

            const response = await fetch(
                "https://banobras-security-auth-common-apps-develop.banobras.gob.mx/security-auth/v1/all-data-user-ldap",
                {
                    method: "GET",
                    headers,
                }
            );

            if (!response.ok) {
                throw new Error(`LDAP ERROR ${response.status}`);
            }

            const ldapData = await response.json();
            const usuario = ldapData?.ldapDTO?.usuario || "Sin dato";
            const expediente = ldapData?.ldapDTO?.expediente || "Sin dato";
            const nombreCompleto = ldapData?.ldapDTO?.nombreCompleto || "Sin dato";
            const rfc = ldapData?.ldapDTO?.rfc || "Sin dato";

            const area = ldapData?.ldapDTO?.area?.trim()
                ? ldapData.ldapDTO.area
                : "Sin dato";

            const puesto = ldapData?.ldapDTO?.puesto?.trim()
                ? ldapData.ldapDTO.puesto
                : "Sin dato";

            sessionStorage.setItem("usuario", usuario);
            sessionStorage.setItem("expediente", expediente);
            sessionStorage.setItem("nombreCompleto", nombreCompleto);
            sessionStorage.setItem("rfc", rfc);
            sessionStorage.setItem("area", area);
            sessionStorage.setItem("puesto", puesto);

            return ldapData;
        } catch (error) {
            console.error("Error obteniendo información LDAP:", error);
            throw error;
        }
    }

    /*************************************/
    /* OBTENER PERMISOS DEL USUARIO */
    /*************************************/
    async function obtenerPermisosUsuario() {
        try {
            await esperarFuncion("apiFetch");

            const response = await window.apiFetch(
                "normativas",
                "/api/v1/administracion/usuarios/me"
            );

            /*
             * Soporta ambas estructuras:
             * response.data o response directo.
             */
            const data = response?.data ?? response;

            const statusCode = data?.statusCode ?? response?.status ?? 500;

            const respuestaExitosa =
                response?.ok === true || (statusCode >= 200 && statusCode < 300);
            if (!respuestaExitosa) {
                const mensajeError =
                    data?.errorMessageDTO?.message ||
                    data?.message ||
                    `Error obteniendo permisos: ${statusCode}`;

                const error = new Error(mensajeError);
                error.esUsuarioNoEncontradoEnSIAL =
                    Number(statusCode) === 404 &&
                    data?.errorMessageDTO?.message ===
                    "No se encontró el usuario autenticado en SIAL";

                throw error;
            }

            const permisos = data?.dataResponse?.permisos || [];

            sessionStorage.setItem("permisos", JSON.stringify(permisos));

            return data;
        } catch (error) {
            console.error("Error obteniendo permisos del usuario:", error);
            throw error;
        }
    }

    /*************************************/
    /* CERRAR SESIÓN POR ERROR */
    /*************************************/
    let cierreSesionEnProceso = false;

    function cerrarSesionPorErrorInicializacion() {
        if (cierreSesionEnProceso) {
            return;
        }

        cierreSesionEnProceso = true;
        window.errorInicializacionPendiente = false;

        try {
            localStorage.clear();
            sessionStorage.clear();

            window.location.href = "/c/portal/logout?referer=/web/normateca/login";
        } catch (errorCierreSesion) {
            cierreSesionEnProceso = false;

            console.error(
                "[INICIALIZACIÓN] Error al cerrar la sesión:",
                errorCierreSesion
            );
        }
    }

    if (typeof window.eventoCerrarSesionErrorInicializacion === "function") {
        document.removeEventListener(
            "click",
            window.eventoCerrarSesionErrorInicializacion
        );
    }

    window.eventoCerrarSesionErrorInicializacion = function (event) {
        if (!window.errorInicializacionPendiente) {
            return;
        }

        const botonCerrar = event.target?.closest?.("#btn-aceptar");

        if (!botonCerrar) {
            return;
        }

        cerrarSesionPorErrorInicializacion();
    };

    document.addEventListener(
        "click",
        window.eventoCerrarSesionErrorInicializacion
    );

    /*************************************/
    /* MOSTRAR ERROR DE INICIALIZACIÓN */
    /*************************************/
    function mostrarErrorInicializacion(error) {
        const mensaje =
            error?.message || "No fue posible obtener la información del usuario.";

        setTimeout(() => {
            if (typeof window.abrirModal !== "function") {
                window.errorInicializacionPendiente = false;

                console.error(
                    "[INICIALIZACIÓN] No se encuentra disponible abrirModal."
                );
                return;
            }

            window.errorInicializacionPendiente = true;

            // window.abrirModal({
            //   paso: 2,
            //   tipo: "Error",
            //   titulo: "Error",
            //   contenido: mensaje,
            //   btnAceptar: "Cerrar",
            //   onAceptar: () => {
            //     cerrarSesionPorErrorInicializacion();
            //   },
            // });
        }, 500);
    }

    /*************************************/
    /* INICIALIZACIÓN */
    /*************************************/
    async function inicializarDatosUsuario() {
        try {
            await esperarFuncion("mostrarLoaderPeticion");
            await esperarFuncion("ocultarLoaderPeticion");

            window.mostrarLoaderPeticion();

            try {
                await grupoUsuario();
            } catch (error) {
                console.warn(
                    "No fue posible obtener los grupos del usuario. Se continuará con la inicialización.",
                    error
                );
            }

            try {
                await tokenOAUTH2();
            } catch (error) {
                console.warn(
                    "No fue posible obtener el token OAuth2. Se continuará con la inicialización.",
                    error
                );
            }

            try {
                await obtenerInformacionUsuario();
            } catch (error) {
                console.warn(
                    "No fue posible obtener la información LDAP. Se continuará con la inicialización.",
                    error
                );
            }


            try {
                await obtenerPermisosUsuario();
            } catch (error) {
                if (error.esUsuarioNoEncontradoEnSIAL) {
                    mostrarErrorInicializacion(error);
                } else {
                    console.error("Error al consultar los permisos:", error);
                }
            }
        } catch (error) {
            console.error(
                "Error previo a la consulta de permisos del usuario:",
                error
            );
        } finally {
            if (typeof window.ocultarLoaderPeticion === "function") {
                window.ocultarLoaderPeticion();
            }
        }
    }

    await inicializarDatosUsuario();

    /*************************************/
    /* NAVEGACIÓN SPA DE LIFERAY */
    /*************************************/
    if (window.Liferay) {
        if (window.ayudaEventoNavigate) {
            Liferay.detach("endNavigate", window.ayudaEventoNavigate);
        }

        window.ayudaEventoNavigate = async () => {
            await inicializarDatosUsuario();
        };

        Liferay.on("endNavigate", window.ayudaEventoNavigate);
    }
})();
