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

    function cerrarSesionPorInactividad() {
        if (cerrandoSesion) return;
        cerrandoSesion = true;
        destruir();

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
        window.location.href = "/c/portal/logout?referer=/web/normateca/login";
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
