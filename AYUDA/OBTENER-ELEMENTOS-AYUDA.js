function formatearFechaCarga(fechaCarga) {
    if (!fechaCarga) return "";

    const fecha = String(fechaCarga).split("T")[0];
    const partes = fecha.split("-");

    if (partes.length !== 3) return "";

    const [anio, mes, dia] = partes;

    return `${dia}/${mes}/${anio}`;
}

(async () => {
    /*
    |--------------------------------------------------------------------------
    | FUNCIÓN PRINCIPAL
    |--------------------------------------------------------------------------
    */

    async function obtenerPermisoAdminNormateca() {
        try {
            if (typeof window.usuarioEsAdminNormateca === "function") {
                return await window.usuarioEsAdminNormateca();
            }

            const userGroupsStorage =
                sessionStorage.getItem("userGroups");

            if (!userGroupsStorage) {
                return false;
            }

            const userGroups = JSON.parse(userGroupsStorage);

            if (!Array.isArray(userGroups)) {
                return false;
            }

            return userGroups.some(function (grupo) {
                const codigo = String(grupo?.codigo || "")
                    .trim()
                    .toLowerCase();

                return (
                    codigo === "normateca-admin-principal" ||
                    codigo === "normateca-admin"
                );
            });
        } catch (error) {
            console.error(
                "[AYUDA] No fue posible validar los permisos:",
                error
            );

            return false;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | FORMATEAR FECHA DD/MM/YYYY
    |--------------------------------------------------------------------------
    */

    function formatearFechaCarga(fechaCarga) {
        if (!fechaCarga) return "";

        const fecha = String(fechaCarga).split("T")[0];
        const partes = fecha.split("-");

        if (partes.length !== 3) return "";

        const [anio, mes, dia] = partes;

        return `${dia}/${mes}/${anio}`;
    }

    async function obtenerInformacionAyuda() {
        window.mostrarLoaderPeticion();

        try {
            sessionStorage.setItem(
                "functional-id",
                "CONSULTA RECUERSO AYUDA"
            );

            if (typeof window.tokenizerTransactionId !== "function") {
                window.ocultarLoaderPeticion();
                return;
            }

            await window.tokenizerTransactionId();

            const response = await window.apiFetch(
                "normativas",
                "/api/v1/recursos-ayuda/"
            );

            const esAdmin =
                await obtenerPermisoAdminNormateca();

            const recursos = response?.data?.dataResponse || [];

            if (typeof window.crearTablaDinamica !== "function") {
                console.error("[AYUDA] crearTablaDinamica no existe");
                window.ocultarLoaderPeticion();
                return;
            }

            const filas = recursos.map((item) => {
                const fecha = formatearFechaCarga(item.fechaCarga);

                const accionesAdmin = esAdmin
                    ? `
              <i
                title="Editar recurso"
                id="editar-recurso"
                class="bi bi-pencil-square"
                data-id="${item.id}"
                data-titulo="${item.titulo}"
                data-descripcion="${item.descripcion}"
                style="cursor:pointer; font-size:18px; margin-right:15px;">
              </i>
            `
                    : "";

                const accionEliminar = esAdmin
                    ? `
              <i
                title="Eliminar recurso"
                id="delete"
                class="bi bi-trash"
                data-id="${item.id}"
                data-titulo="${item.titulo}"
                style="cursor:pointer; font-size:18px;">
              </i>
            `
                    : "";

                return `
            <td>${item.titulo ?? ""}</td>
            <td>${item.descripcion ?? ""}</td>
            <td>${item.tipoArchivo ?? ""}</td>
            <td>${fecha}</td>
            <td>${item.autor ?? ""}</td>
            <td>
              ${accionesAdmin}
  
              <i
                title="Descargar recurso"
                id="download"
                class="bi bi-download"
                data-id="${item.id}"
                data-titulo="${item.titulo}"
                style="cursor:pointer; font-size:18px; margin-right:15px;">
              </i>
  
              ${accionEliminar}
            </td>
          `;
            });

            const configuracionTabla = {
                contenedor: "#tabla-dinamica",
                titulo: "Recursos de Ayuda",

                botonAccion: {
                    mostrar: esAdmin,
                    titulo: "Nuevo recurso",
                    icono: "bi bi-plus-circle",
                },

                columnas: [
                    { titulo: "Título", ordenar: true },
                    { titulo: "Descripción", ordenar: true },
                    { titulo: "Tipo Archivo", ordenar: true },
                    { titulo: "Fecha Carga", ordenar: true },
                    { titulo: "Autor", ordenar: true },
                    { titulo: "Acciones", ordenar: false },
                ],

                filas,
            };

            window.crearTablaDinamica(configuracionTabla);

            if (window.bitacoraService?.operationLog) {
                await window.bitacoraService.operationLog(
                    "GET",
                    "CONSULTAR",
                    "OBTENER RECURSOS DE AYUDA",
                    "SE CONSULTAN LOS RECURSOS DE MATERIAL DE AYUDA",
                    response?.data?.statusCode ?? 200,
                    JSON.stringify(
                        response?.data?.message || "Consulta exitosa"
                    )
                );
            } else {
                console.warn("[AYUDA] bitacoraService no disponible");
            }

            window.ocultarLoaderPeticion();

            return response?.data;
        } catch (e) {
            const idx = e.message?.indexOf("{");

            if (idx !== -1) {
                const errorObj = JSON.parse(e.message.substring(idx));

                await window.bitacoraService.operationLog(
                    "GET",
                    "CONSULTAR",
                    "OBTENER RECURSOS DE AYUDA",
                    "SE CONSULTAN LOS RECURSOS DE MATERIAL DE AYUDA",
                    errorObj?.errorMessageDTO?.statusCode || 500,
                    errorObj?.errorMessageDTO?.message || "Error desconocido"
                );
            }

            window.ocultarLoaderPeticion();
        }
    }

    window.obtenerInformacionAyuda = obtenerInformacionAyuda;

    /*
    |--------------------------------------------------------------------------
    | LIFERAY
    |--------------------------------------------------------------------------
    */

    if (!window.Liferay) {
        console.error("[AYUDA] Liferay no está disponible");

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | EJECUCIÓN INMEDIATA
    |--------------------------------------------------------------------------
    */

    await obtenerInformacionAyuda();

    /*
    |--------------------------------------------------------------------------
    | LIMPIAR EVENTOS ANTERIORES
    |--------------------------------------------------------------------------
    */

    if (window.ayudaEventoNavigate) {
        Liferay.detach(
            "endNavigate",
            window.ayudaEventoNavigate
        );
    }

    /*
    |--------------------------------------------------------------------------
    | NAVEGACIÓN SPA
    |--------------------------------------------------------------------------
    */

    window.ayudaEventoNavigate = async function () {
        await obtenerInformacionAyuda();
    };

    Liferay.on(
        "endNavigate",
        window.ayudaEventoNavigate
    );
})();