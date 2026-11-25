(function () {
    const MENSAJE = "La sesión ha expirado por inactividad o fue invalidada";
    let observador = null;
    let cerrado = false;

    window.mensajeSesionExpiradaNormateca?.destruir();

    function mostrarAvisoSesionExpirada() {
        if (new URLSearchParams(window.location.search).get("motivo") !== "inactividad") {
            observador?.disconnect();
            document.querySelector('[data-aviso-sesion-expirada="true"]')?.remove();
            cerrado = false;
            return;
        }
        if (cerrado) return;
        const formulario = document.querySelector(".sign-in-form, .login-form, .portlet-login");
        if (!formulario) {
            if (!observador) {
                observador = new MutationObserver(mostrarAvisoSesionExpirada);
            }
            observador.observe(document.body, { childList: true, subtree: true });
            return;
        }
        observador?.disconnect();

        let alerta = formulario.querySelector('[data-aviso-sesion-expirada="true"]');
        if (alerta) return;
        alerta = formulario.querySelector('.alert-danger[role="alert"]');
        if (!alerta) {
            alerta = document.createElement("div");
            formulario.prepend(alerta);
        }
        alerta.className = "alert alert-dismissible alert-danger";
        alerta.dataset.avisoSesionExpirada = "true";
        alerta.setAttribute("role", "alert");
        alerta.hidden = false;
        alerta.style.setProperty("visibility", "visible", "important");
        alerta.style.setProperty("display", "block", "important");
        alerta.innerHTML = `
            <button aria-label="Cerrar" class="close" type="button">
                <span class="c-inner" tabindex="-1">
                    <svg aria-hidden="true" class="lexicon-icon lexicon-icon-times" focusable="false">
                        <use href="/o/classic-theme/images/clay/icons.svg#times"></use>
                    </svg>
                </span>
                <span class="sr-only">Cerrar</span>
            </button>
            <span class="alert-indicator">
                <svg aria-hidden="true" class="lexicon-icon lexicon-icon-exclamation-full" focusable="false">
                    <use href="/o/classic-theme/images/clay/icons.svg#exclamation-full"></use>
                </svg>
            </span>
            <strong class="lead">Error:</strong> `;
        alerta.appendChild(document.createTextNode(MENSAJE));
        alerta.querySelector("button.close").addEventListener("click", function (event) {
            event.preventDefault();
            cerrado = true;
            alerta.remove();
        });
    }

    function destruir() {
        observador?.disconnect();
        document.removeEventListener("DOMContentLoaded", mostrarAvisoSesionExpirada);
        window.Liferay?.detach("endNavigate", mostrarAvisoSesionExpirada);
    }

    window.mensajeSesionExpiradaNormateca = { destruir };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mostrarAvisoSesionExpirada, { once: true });
    } else {
        mostrarAvisoSesionExpirada();
    }
    window.Liferay?.on("endNavigate", mostrarAvisoSesionExpirada);
})();
