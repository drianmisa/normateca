(function () {
    const TIEMPO_INACTIVIDAD = 10 * 60 * 1000;
    const eventosActividad = ["mousemove", "pointerdown", "keydown", "click", "scroll", "touchstart", "wheel"];
    const opcionesEvento = { capture: true, passive: true };

    // Liferay puede ejecutar el fragmento nuevamente al navegar entre secciones.
    if (typeof window.sesionExpiradaNormateca?.destruir === "function") {
        window.sesionExpiradaNormateca.destruir();
    }

    let ultimaActividad = Date.now();
    let temporizador = null;
    let cerrandoSesion = false;

    async function cerrarSesionPorInactividad() {
        if (cerrandoSesion) return;
        cerrandoSesion = true;
        destruir();

        try {
            if (typeof window.bitacoraService?.accesosLog !== "function") {
                throw new Error("No está disponible bitacoraService.accesosLog. Verifica que FETCH-GLOBALES.js esté cargado y actualizado en esta página.");
            }
            sessionStorage.setItem("functional-id", "Cierre de sesión por inactividad");
            // Después del periodo inactivo, preparar los tokens como en las demás peticiones.
            // Si la renovación falla, intentar igualmente la bitácora con la sesión disponible.
            if (typeof window.tokenizerTransactionId === "function") {
                try {
                    await window.tokenizerTransactionId();
                } catch (errorToken) {
                    console.warn("[Sesión expirada] No fue posible renovar los tokens antes de registrar el cierre:", errorToken);
                }
            }
            const usuario = typeof window.obtenerUsuario === "function"
                ? window.obtenerUsuario()
                : sessionStorage.getItem("usuario") || "Sin dato";
            const response = await window.bitacoraService.accesosLog(
                "Logout",
                "Cierre de sesión por inactividad",
                200,
                `El usuario ${usuario} cerró sesión por inactividad.`
            );
            const resultado = response?.data;
            const status = Number(resultado?.errorMessageDTO?.statusCode || resultado?.statusCode || response?.status || 500);
            if (response?.ok !== true || status >= 400) {
                throw new Error(
                    resultado?.errorMessageDTO?.message || resultado?.message || response?.message ||
                    `El servicio de bitácora no confirmó el registro del cierre (HTTP ${status}).`
                );
            }
        } catch (error) {
            console.error("[Sesión expirada] No fue posible registrar el cierre en bitácora:", error);
        }

        // La redirección también se ejecuta si el navegador impide limpiar el almacenamiento.
        try {
            localStorage.clear();
        } catch (error) {
            console.error("[SESIÓN EXPIRADA] No fue posible limpiar localStorage:", error);
        }
        try {
            sessionStorage.clear();
        } catch (error) {
            console.error("[SESIÓN EXPIRADA] No fue posible limpiar sessionStorage:", error);
        }
        const regresoLogin = "/web/normateca/login?motivo=inactividad";
        window.location.href = `/c/portal/logout?referer=${encodeURIComponent(regresoLogin)}`;
    }

    function comprobarInactividad() {
        if (cerrandoSesion) return;
        clearTimeout(temporizador);
        const tiempoRestante = TIEMPO_INACTIVIDAD - (Date.now() - ultimaActividad);
        if (tiempoRestante <= 0) {
            cerrarSesionPorInactividad();
            return;
        }
        temporizador = setTimeout(comprobarInactividad, tiempoRestante);
    }

    function registrarActividad(evento) {
        // Los eventos generados por otros scripts no cuentan como uso del usuario.
        if (cerrandoSesion || !evento.isTrusted) return;
        // Si el equipo estuvo suspendido, no reiniciar una sesión que ya venció.
        if (Date.now() - ultimaActividad >= TIEMPO_INACTIVIDAD) {
            cerrarSesionPorInactividad();
            return;
        }
        ultimaActividad = Date.now();
    }

    function destruir() {
        clearTimeout(temporizador);
        eventosActividad.forEach(function (evento) {
            document.removeEventListener(evento, registrarActividad, opcionesEvento);
        });
        document.removeEventListener("visibilitychange", comprobarInactividad);
        window.removeEventListener("pageshow", comprobarInactividad);
    }

    eventosActividad.forEach(function (evento) {
        document.addEventListener(evento, registrarActividad, opcionesEvento);
    });
    // Revalidar al volver a la pestaña o recuperar una página del historial.
    document.addEventListener("visibilitychange", comprobarInactividad);
    window.addEventListener("pageshow", comprobarInactividad);

    window.sesionExpiradaNormateca = { destruir };
    comprobarInactividad();
})();
