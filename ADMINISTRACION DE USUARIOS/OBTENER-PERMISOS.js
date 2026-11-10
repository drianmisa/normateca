(async () => {
    const CONFIGURACION_PERMISOS_NORMAS = {
        functionalId: "Consultar permisos de normas por usuario",
        nombreOperacion: "Obtener permisos de normas por usuario",
    };

    /*
      |--------------------------------------------------------------------------
      | OBTENER DATOS DE LA URL
      |--------------------------------------------------------------------------
      */

    function obtenerParametrosUsuario() {
        const params = new URLSearchParams(window.location.search);

        return {
            idUsuario: params.get("idUsuario") || "",
            criterioBusqueda: params.get("criterioBusqueda") || "",
            nombre: params.get("nombre") || "",
            usuario: params.get("usuario") || "",
            area: params.get("area") || "",
            expediente: params.get("expediente") || "",
            rol: params.get("rol") || "",
            puesto: params.get("puesto") || "",
            correo: params.get("correo") || "",
            idUserGroup: params.get("idUserGroup") || "",
        };
    }

    /*
      |--------------------------------------------------------------------------
      | UTILIDADES DE LA CONSULTA
      |--------------------------------------------------------------------------
      */

    function obtenerDetalleError(error) {
        const resultado = {
            statusCode: 500,
            message: error?.message || "Error desconocido al consultar los permisos",
        };

        const mensajeError = String(error?.message ?? "");
        const indiceJson = mensajeError.indexOf("{");

        if (indiceJson === -1) {
            return resultado;
        }

        try {
            const errorObj = JSON.parse(mensajeError.substring(indiceJson));

            resultado.statusCode =
                Number(
                    errorObj?.errorMessageDTO?.statusCode ?? errorObj?.statusCode ?? 500
                ) || 500;

            resultado.message =
                errorObj?.errorMessageDTO?.message ||
                errorObj?.message ||
                resultado.message;
        } catch (errorParseo) {
            console.error(
                "[GESTIÓN PERMISOS] No fue posible interpretar el error:",
                errorParseo
            );
        }

        return resultado;
    }

    function obtenerDataResponse(response) {
        const dataResponse =
            response?.data?.dataResponse ?? response?.dataResponse ?? [];

        if (Array.isArray(dataResponse)) {
            return dataResponse;
        }

        if (Array.isArray(dataResponse?.normas)) {
            return dataResponse.normas;
        }

        return [];
    }

    function convertirBooleano(valor) {
        if (valor === true || valor === 1) {
            return true;
        }

        const texto = String(valor ?? "")
            .trim()
            .toLowerCase();

        return (
            texto === "true" || texto === "si" || texto === "sí" || texto === "1"
        );
    }

    function normalizarNormaPermiso(norma) {
        const registro = norma && typeof norma === "object" ? norma : {};

        const verPdf =
            registro.verPdf ??
            registro.ver ??
            registro.visualizar ??
            registro.permisoVer ??
            registro.permisoVisualizacion ??
            false;

        const verPdfActivo = convertirBooleano(verPdf);

        const descargarActivo = false;

        return {
            ...registro,
            id:
                registro.id ??
                registro.normaId ??
                registro.idNorma ??
                registro.contenidoId ??
                "",
            codigo: registro.codigo ?? "",
            nombre: registro.nombre ?? registro.titulo ?? "",
            clasificacion: registro.clasificacion ?? "",
            verPdf: verPdfActivo,
            descargar: descargarActivo,
            permisoActivo:
                convertirBooleano(
                    registro.permisoActivo ?? registro.activo ?? registro.asignado
                ) ||
                verPdfActivo ||
                descargarActivo,
        };
    }

    async function registrarBitacoraConsultaPermisos(
        usuarioId,
        statusCode,
        mensaje
    ) {
        if (!window.bitacoraService?.operationLog) {
            console.warn("[GESTIÓN PERMISOS] bitacoraService no está disponible");
            return;
        }

        await window.bitacoraService.operationLog(
            "GET",
            "Consultar",
            CONFIGURACION_PERMISOS_NORMAS.nombreOperacion,
            `Se consultan los permisos de normas del usuario ${usuarioId}`,
            Number(statusCode) || 500,
            JSON.stringify(mensaje || "Consulta exitosa")
        );
    }

    /*
      |--------------------------------------------------------------------------
      | ESTADO LOCAL
      |--------------------------------------------------------------------------
      */

    let normasGestion = [];

    function establecerNormasGestion(normas) {
        normasGestion = normas.map((norma) => ({
            ...norma,
            verPdfOriginal: norma.verPdf,
            descargarOriginal: norma.descargar,
        }));
    }

    /*
      |--------------------------------------------------------------------------
      | OBTENER COLOR DE CLASIFICACIÓN
      |--------------------------------------------------------------------------
      */

    function obtenerEstiloClasificacion(clasificacion) {
        const tipo = String(clasificacion || "").toUpperCase();

        if (tipo === "CONFIDENCIAL") {
            return `
          background: #f8d7da;
          color: #a61b35;
        `;
        }

        if (tipo === "RESTRINGIDA") {
            return `
          background: #ffe8a1;
          color: #8a6d1d;
        `;
        }

        return `
        background: #d1e7dd;
        color: #146c43;
      `;
    }

    /*
      |--------------------------------------------------------------------------
      | CONTAR CAMBIOS
      |--------------------------------------------------------------------------
      */

    function obtenerCantidadCambios() {
        return normasGestion.filter((norma) => {
            return (
                norma.verPdf !== norma.verPdfOriginal ||
                norma.descargar !== norma.descargarOriginal
            );
        }).length;
    }

    /*
      |--------------------------------------------------------------------------
      | RENDERIZAR RESUMEN
      |--------------------------------------------------------------------------
      */

    function actualizarResumenPermisos() {
        const resumen = document.querySelector("#resumen-permisos-cantidad");

        if (!resumen) {
            return;
        }

        const cantidad = obtenerCantidadCambios();

        resumen.textContent =
            cantidad === 1
                ? "1 norma modificada pendiente"
                : `${cantidad} normas modificadas pendientes`;
    }

    /*
      |--------------------------------------------------------------------------
      | CREAR TARJETA DE NORMA
      |--------------------------------------------------------------------------
      */

    function crearTarjetaNorma(norma) {
        const bordeEstado = norma.permisoActivo
            ? "border-left: 4px solid #21c521;"
            : "border-left: 4px solid transparent;";

        return `
        <div
          class="tarjeta-permiso-norma"
          data-id="${norma.id}"
          data-codigo="${norma.codigo}"
          data-nombre="${norma.nombre}"
          style="
            ${bordeEstado}
            border-top: 1px solid #d8dce3;
            border-right: 1px solid #d8dce3;
            border-bottom: 1px solid #d8dce3;
            padding: 12px 14px;
            background: #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,.08);
          "
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              gap: 20px;
              align-items: center;
            "
          >
            <div style="flex: 1; min-width: 0;">
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  margin-bottom: 5px;
                  flex-wrap: wrap;
                "
              >
                <span style="font-size: 13px;">
                  ${norma.codigo}
                </span>
  
                <span
                  style="
                    ${obtenerEstiloClasificacion(norma.clasificacion)}
                    display: inline-block;
                    padding: 2px 12px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 700;
                  "
                >
                  ${norma.clasificacion}
                </span>
              </div>
  
              <div
                style="
                  font-weight: 600;
                  font-size: 14px;
                  margin-bottom: 5px;
                "
              >
                ${norma.nombre}
              </div>
  
              ${norma.permisoActivo
                ? `
                    <div
                      style="
                        color: #19a824;
                        font-size: 13px;
                        font-weight: 600;
                      "
                    >
                      Permiso activo
                    </div>
                  `
                : ""
            }
            </div>
  
            <div
              style="
                display: flex;
                align-items: center;
                gap: 22px;
                white-space: nowrap;
              "
            >
              <label
                style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  margin: 0;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 600;
                "
              >
                <input
                  type="checkbox"
                  class="check-permiso-ver"
                  data-id="${norma.id}"
                  ${norma.verPdf ? "checked" : ""}
                >
  
                Ver PDF
              </label>
  
              <label
                style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  margin: 0;
                  cursor: not-allowed;
                  font-size: 13px;
                  font-weight: 600;
                "
              >
                <input
                  type="checkbox"
                  class="check-permiso-descargar"
                  data-id="${norma.id}"
                  disabled
                >
  
                Descargar
              </label>
            </div>
          </div>
        </div>
      `;
    }

    /*
      |--------------------------------------------------------------------------
      | RENDERIZAR NORMAS
      |--------------------------------------------------------------------------
      */

    function renderizarNormas(filtro = "") {
        const contenedor = document.querySelector("#lista-normas-permisos");

        if (!contenedor) {
            return;
        }

        const busqueda = String(filtro || "")
            .trim()
            .toLowerCase();

        const normasFiltradas = normasGestion.filter((norma) => {
            if (!busqueda) {
                return true;
            }

            return (
                norma.codigo.toLowerCase().includes(busqueda) ||
                norma.nombre.toLowerCase().includes(busqueda) ||
                norma.clasificacion.toLowerCase().includes(busqueda)
            );
        });

        if (!normasFiltradas.length) {
            contenedor.innerHTML = `
          <div
            style="
              padding: 25px;
              text-align: center;
              border: 1px solid #ddd;
              color: #666;
            "
          >
            No se encontraron normas.
          </div>
        `;

            return;
        }

        contenedor.innerHTML = normasFiltradas.map(crearTarjetaNorma).join("");
    }

    /*
      |--------------------------------------------------------------------------
      | CREAR PANTALLA
      |--------------------------------------------------------------------------
      */

    function crearGestionPermisos() {
        const contenedor = document.querySelector("#tabla-dinamica");

        if (!contenedor) {
            console.error("[GESTIÓN PERMISOS] No existe #tabla-dinamica");
            return;
        }

        const datosUsuario = obtenerParametrosUsuario();

        contenedor.innerHTML = `
        <div
          class="gestion-permisos"
          style="
            width: 100%;
            background: #fff;
          "
        >
          <!-- ENCABEZADO -->
  
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
            "
          >
            <h1 class="tabla-h1">
              Gestión de Permisos por Norma / Clasificación
            </h1>
  
            <a
              href="/web/normateca/administracion"
              class="btn btn-primary"
            >
              <i class="bi bi-arrow-left"></i>
              Regresar
            </a>
          </div>
  
          <hr class="red">
  
          <!-- INFORMACIÓN DEL USUARIO -->
  
          <div
            style="
              background: #f5f5f5;
              padding: 14px 16px;
              margin-bottom: 18px;
            "
          >
            <div
              style="
                font-weight: 700;
                margin-bottom: 8px;
              "
            >
              ${datosUsuario.usuario || "Usuario"}
            </div>
  
            <div
              style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px 30px;
                font-size: 13px;
              "
            >
              <div>
                <strong>Área:</strong>
                ${datosUsuario.area || "-"}
              </div>
  
              <div>
                <strong>Expediente:</strong>
                ${datosUsuario.expediente || "-"}
              </div>
  
              <div>
                <strong>Puesto:</strong>
                ${datosUsuario.puesto || "-"}
              </div>
  
              <div>
                <strong>Rol:</strong>
                ${datosUsuario.rol || "-"}
              </div>
            </div>
          </div>
  
          <!-- CUERPO -->
  
          <div
            style="
              display: grid;
              grid-template-columns: minmax(0, 1fr) 230px;
              gap: 15px;
              align-items: start;
            "
          >
            <!-- LISTADO -->
  
            <div>
              <div
                style="
                  font-weight: 600;
                  margin-bottom: 8px;
                "
              >
                Panel de Asignación - Normas Sensibles
              </div>
  
              <div
                style="
                  position: relative;
                  margin-bottom: 10px;
                "
              >
                <i
                  class="bi bi-search"
                  style="
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #888;
                  "
                ></i>
  
                <input
                  type="text"
                  id="buscador-normas-permisos"
                  class="form-control"
                  placeholder="Buscar por código o nombre de norma"
                  style="padding-left: 35px;"
                >
              </div>
  
              <div id="lista-normas-permisos"></div>
            </div>
  
            <!-- RESUMEN -->
  
            <div>
              <div
                style="
                  font-weight: 600;
                  margin-bottom: 8px;
                "
              >
                Resumen de permisos:
              </div>
  
              <div
                style="
                  border: 1px solid #d9dce4;
                  min-height: 95px;
                  padding: 15px;
                  box-shadow: 0 1px 5px rgba(0,0,0,.08);
                  font-size: 13px;
                "
              >
                <span id="resumen-permisos-cantidad">
                  0 normas modificadas pendientes
                </span>
              </div>
            </div>
          </div>
  
          <!-- BOTONES -->
  
          <div
            style="
              display: flex;
              justify-content: flex-end;
              gap: 15px;
              margin-top: 30px;
            "
          >
            <button
              type="button"
              class="btn btn-outline-secondary"
              id="btn-cancelar-permisos"
            >
              Cancelar
            </button>
  
            <button
              type="button"
              class="btn btn-primary"
              id="btn-guardar-permisos"
            >
              Guardar permisos
            </button>
          </div>
        </div>
      `;

        renderizarNormas();
        actualizarResumenPermisos();
    }

    /*
      |--------------------------------------------------------------------------
      | CAMBIAR PERMISO
      |--------------------------------------------------------------------------
      */

    function actualizarPermiso(idNorma, campo, valor) {
        const norma = normasGestion.find(
            (item) => String(item.id) === String(idNorma)
        );

        if (!norma) {
            return;
        }

        norma[campo] = valor;

        actualizarResumenPermisos();
    }

    /*
      |--------------------------------------------------------------------------
      | EVENTOS
      |--------------------------------------------------------------------------
      */

    function configurarEventosGestionPermisos() {
        const contenedor = document.querySelector("#tabla-dinamica");

        if (!contenedor) {
            return;
        }

        /*
          |--------------------------------------------------------------------------
          | CHANGE
          |--------------------------------------------------------------------------
          */

        contenedor.onchange = function (event) {
            const checkVer = event.target.closest(".check-permiso-ver");

            if (checkVer) {
                actualizarPermiso(checkVer.dataset.id, "verPdf", checkVer.checked);

                return;
            }
        };

        /*
          |--------------------------------------------------------------------------
          | INPUT BUSCADOR
          |--------------------------------------------------------------------------
          */

        contenedor.oninput = function (event) {
            if (event.target.id !== "buscador-normas-permisos") {
                return;
            }

            renderizarNormas(event.target.value);
        };

        /*
          |--------------------------------------------------------------------------
          | CLICK
          |--------------------------------------------------------------------------
          */

        contenedor.onclick = function (event) {
            /*
              |--------------------------------------------------------------------------
              | CANCELAR
              |--------------------------------------------------------------------------
              */

            if (event.target.closest("#btn-cancelar-permisos")) {
                window.location.href = "/web/normateca/administracion";

                return;
            }

            /*
              |--------------------------------------------------------------------------
              | GUARDAR
              |--------------------------------------------------------------------------
              */

            const botonGuardar = event.target.closest("#btn-guardar-permisos");

            if (botonGuardar) {
                event.preventDefault();
                event.stopPropagation();

                guardarPermisos(botonGuardar);
            }
        };
    }

    /*
      |--------------------------------------------------------------------------
      | GUARDAR PERMISOS
      |--------------------------------------------------------------------------
      */

    function obtenerDatoUsuariosLog(valor) {
        const dato = String(valor ?? "").trim();

        return dato || "Sin dato";
    }

    async function registrarBitacoraGuardarPermisos(
        statusCode,
        respuestaOperacion,
        detalleOperacion,
        datosUsuario
    ) {
        if (!window.bitacoraService?.usuariosLog) {
            console.warn("[GESTIÓN PERMISOS] usuariosLog no está disponible");
            return;
        }

        await window.bitacoraService.usuariosLog(
            "PUT",
            "Actualizar permisos de normas",
            detalleOperacion,
            Number(statusCode) || 500,
            respuestaOperacion,
            {
                nombreUsuario: obtenerDatoUsuariosLog(
                    datosUsuario.nombre || datosUsuario.usuario
                ),
                expedienteUsuario: obtenerDatoUsuariosLog(datosUsuario.expediente),
                rfcUsuario: "Sin dato",
                areaUsuario: obtenerDatoUsuariosLog(datosUsuario.area),
                puestoUsuario: obtenerDatoUsuariosLog(datosUsuario.puesto),
                usuario: obtenerDatoUsuariosLog(datosUsuario.criterioBusqueda),
            },
            "Usuarios"
        );
    }

    function confirmarPermisosGuardados() {
        normasGestion.forEach(function (norma) {
            norma.verPdfOriginal = norma.verPdf;
            norma.descargarOriginal = norma.descargar;
            norma.permisoActivo = norma.verPdf || norma.descargar;
        });

        const buscador = document.querySelector("#buscador-normas-permisos");

        renderizarNormas(buscador?.value || "");
        actualizarResumenPermisos();
    }

    async function guardarPermisos(botonGuardar) {
        const datosUsuario = obtenerParametrosUsuario();

        const usuarioId = String(datosUsuario.idUsuario || "").trim();

        if (!usuarioId) {
            abrirModal({
                paso: 2,
                tipo: "Error",
                titulo: "Error",
                contenido: "No se encontró el identificador del usuario.",
                btnAceptar: "Cerrar",
            });
            return;
        }

        const permisosModificados = normasGestion
            .filter((norma) => {
                return (
                    norma.verPdf !== norma.verPdfOriginal ||
                    norma.descargar !== norma.descargarOriginal
                );
            })
            .map((norma) => {
                return {
                    contenidoId: norma.id,
                    verPdf: norma.verPdf,
                    descargarPdf: norma.descargar,
                };
            });

        if (!permisosModificados.length) {
            abrirModal({
                paso: 2,
                tipo: "Aceptar",
                titulo: "Sin cambios",
                contenido: "No hay permisos modificados para guardar.",
                btnAceptar: "Cerrar",
            });
            return;
        }

        setTimeout(() => {
            abrirModal({
                paso: 1,
                titulo: "Guardar permisos",
                contenido: `¿Deseas guardar los permisos de ${obtenerDatoUsuariosLog(
                    datosUsuario.nombre || datosUsuario.usuario
                )}?`,
                contenido1: `Se actualizarán ${permisosModificados.length} norma(s).`,
                btnAceptar: "Aceptar",
                btnCerrar: "Cancelar",
                onAceptar: async (ok) => {
                    if (!ok) {
                        return;
                    }

                    botonGuardar.disabled = true;
                    window.mostrarLoaderPeticion();

                    const detalleOperacion =
                        `Actualización de permisos de normas del usuario ${obtenerDatoUsuariosLog(
                            datosUsuario.nombre || datosUsuario.usuario
                        )}, usuarioId: ${usuarioId}, ` +
                        `normas modificadas: ${permisosModificados.length}`;

                    try {
                        sessionStorage.setItem(
                            "functional-id",
                            "ACTUALIZAR PERMISOS DE NORMAS"
                        );

                        await window.tokenizerTransactionId();

                        const response = await window.apiPut(
                            "normativas",
                            `/api/v1/administracion/usuarios/${encodeURIComponent(
                                usuarioId
                            )}/permisos/normas`,
                            {
                                permisos: permisosModificados,
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
                            response?.data?.message || "Permisos actualizados correctamente";

                        await registrarBitacoraGuardarPermisos(
                            statusCode,
                            JSON.stringify(mensajeRespuesta),
                            detalleOperacion,
                            datosUsuario
                        );

                        confirmarPermisosGuardados();
                        window.ocultarLoaderPeticion();

                        setTimeout(() => {
                            abrirModal({
                                paso: 2,
                                tipo: "Aceptar",
                                titulo: "Completado",
                                contenido: "Permisos actualizados correctamente",
                                btnAceptar: "Cerrar",
                            });
                        }, 500);
                    } catch (error) {
                        const detalleError = obtenerDetalleError(error);

                        try {
                            await registrarBitacoraGuardarPermisos(
                                detalleError.statusCode,
                                detalleError.message,
                                detalleOperacion,
                                datosUsuario
                            );
                        } catch (errorBitacora) {
                            console.error(
                                "[GESTIÓN PERMISOS] No fue posible registrar el error al guardar permisos:",
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
                                    detalleError.message || "No fue posible guardar los permisos",
                                btnAceptar: "Cerrar",
                            });
                        }, 500);
                    } finally {
                        botonGuardar.disabled = false;
                    }
                },
            });
        }, 500);
    }

    /*
      |--------------------------------------------------------------------------
      | CONSULTAR PERMISOS DE NORMAS
      |--------------------------------------------------------------------------
      */

    async function obtenerPermisosNormasUsuario() {
        const datosUsuario = obtenerParametrosUsuario();

        const usuarioId = String(datosUsuario.idUsuario || "").trim();

        if (typeof window.mostrarLoaderPeticion === "function") {
            window.mostrarLoaderPeticion();
        }

        try {
            if (!usuarioId) {
                throw new Error("No se encontró el identificador del usuario.");
            }

            sessionStorage.setItem(
                "functional-id",
                CONFIGURACION_PERMISOS_NORMAS.functionalId
            );

            if (typeof window.tokenizerTransactionId !== "function") {
                throw new Error("tokenizerTransactionId no está disponible");
            }

            if (typeof window.apiFetch !== "function") {
                throw new Error("apiFetch no está disponible");
            }

            await window.tokenizerTransactionId();

            const endpoint = `/api/v1/administracion/usuarios/${encodeURIComponent(
                usuarioId
            )}/permisos/normas`;

            console.log("[GESTIÓN PERMISOS] Ejecutando GET", endpoint);

            const response = await window.apiFetch("normativas", endpoint);

            if (response?.ok === false) {
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

            const normas = obtenerDataResponse(response).map(normalizarNormaPermiso);

            establecerNormasGestion(normas);
            crearGestionPermisos();
            configurarEventosGestionPermisos();

            await registrarBitacoraConsultaPermisos(
                usuarioId,
                response?.data?.statusCode ??
                response?.statusCode ??
                response?.status ??
                200,
                response?.data?.message || response?.message || "Consulta exitosa"
            );

            return normas;
        } catch (error) {
            const detalleError = obtenerDetalleError(error);

            establecerNormasGestion([]);
            crearGestionPermisos();
            configurarEventosGestionPermisos();

            try {
                await registrarBitacoraConsultaPermisos(
                    usuarioId || "Sin dato",
                    detalleError.statusCode,
                    detalleError.message
                );
            } catch (errorBitacora) {
                console.error(
                    "[GESTIÓN PERMISOS] No fue posible registrar el error en bitácora:",
                    errorBitacora
                );
            }

            console.error(
                "[GESTIÓN PERMISOS] Error al consultar los permisos:",
                error
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

    async function inicializarGestionPermisos() {
        await obtenerPermisosNormasUsuario();
    }

    /*
      |--------------------------------------------------------------------------
      | EJECUCIÓN INMEDIATA
      |--------------------------------------------------------------------------
      */

    await inicializarGestionPermisos();

    /*
      |--------------------------------------------------------------------------
      | NAVEGACIÓN SPA DE LIFERAY
      |--------------------------------------------------------------------------
      */

    if (!window.Liferay) {
        return;
    }

    if (window.gestionPermisosEventoNavigate) {
        Liferay.detach("endNavigate", window.gestionPermisosEventoNavigate);
    }

    window.gestionPermisosEventoNavigate = async function () {
        await inicializarGestionPermisos();
    };

    Liferay.on("endNavigate", window.gestionPermisosEventoNavigate);
})();
