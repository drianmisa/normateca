(async () => {
    const rolNORMATECA = window.obtenerRolNORMATECA?.() || null;

    const rolUsuario = rolNORMATECA?.nombre || "";
    const nivelPermiso = Number(rolNORMATECA?.permisos ?? -1);

    const esAdministradorNORMATECA = nivelPermiso === 2;
    const esLectorNORMATECA = nivelPermiso === 1;
    async function obtenerPermisoAdminNormateca() {
        try {
            if (typeof window.usuarioEsAdminNormateca === "function") {
                return await window.usuarioEsAdminNormateca();
            }

            const userGroupsStorage = sessionStorage.getItem("userGroups");
            if (!userGroupsStorage) return false;

            const userGroups = JSON.parse(userGroupsStorage);
            if (!Array.isArray(userGroups)) return false;

            return userGroups.some(function (grupo) {
                const codigo = String(grupo?.codigo || "").trim().toLowerCase();
                return codigo === "normateca-admin-principal" || codigo === "normateca-admin";
            });
        } catch (error) {
            console.error("No fue posible validar los permisos de administrador:", error);
            return false;
        }
    }
    const esAdmin = await obtenerPermisoAdminNormateca();

    /* ARCHIVO COMPLETO CON ARRAY MOCK DEMO INCLUIDO */
    /*************************************/
    /* MOCK TEMPORAL PARA PRUEBAS */
    /*************************************/
    const USAR_MOCK_HISTORICO = false;

    const registroBaseMockHistorico = {
        contenidoId: 154780,
        codigo: "N-0001",
        clasificacion: "publica",
        fechaVigencia: "2027-09-07",
        semaforo: "VERDE",
        renovacion: false,
        autorizado: true,
        descargaPermitida: true,
        tieneNormasAdjuntas: true,
        idDocumentoPrincipal: 216801,
    };

    const MOCK_DATA_RESPONSE_HISTORICO = [
        {
            anio: 2026,
            normas: [
                {
                    ...registroBaseMockHistorico,
                    versionId: 216812,
                    titulo: "Introducción 2026",
                    ultimaActualizacion:
                        "2026-09-07T21:14:01",
                    anio: 2026,
                },
                {
                    ...registroBaseMockHistorico,
                    contenidoId: 155046,
                    versionId: 216787,
                    codigo: "N-0002",
                    titulo:
                        "Manual de procedimientos 2026",
                    ultimaActualizacion:
                        "2026-08-20T20:46:05",
                    tieneNormasAdjuntas: false,
                    idDocumentoPrincipal: 155031,
                    anio: 2026,
                },
            ],
        },
        {
            anio: 2025,
            normas: [
                {
                    ...registroBaseMockHistorico,
                    contenidoId: 155100,
                    versionId: 215001,
                    codigo: "N-0003",
                    titulo:
                        "Política de seguridad 2025",
                    fechaVigencia: "2026-12-31",
                    ultimaActualizacion:
                        "2025-12-15T18:30:00",
                    idDocumentoPrincipal: 215010,
                    anio: 2025,
                },
                {
                    ...registroBaseMockHistorico,
                    contenidoId: 155200,
                    versionId: 215002,
                    codigo: "N-0004",
                    titulo:
                        "Lineamientos de contratación 2025",
                    clasificacion: "restringida",
                    fechaVigencia: "2025-10-12",
                    ultimaActualizacion:
                        "2025-06-10T10:15:00",
                    semaforo: "AMARILLO",
                    idDocumentoPrincipal: 215020,
                    anio: 2025,
                },
            ],
        },
        {
            anio: 2024,
            normas: [
                {
                    ...registroBaseMockHistorico,
                    contenidoId: 155300,
                    versionId: 214001,
                    codigo: "N-0005",
                    titulo:
                        "Normativa institucional 2024",
                    clasificacion: "usoInterno",
                    fechaVigencia: "2024-08-01",
                    ultimaActualizacion:
                        "2024-08-01T09:00:00",
                    semaforo: "ROJO",
                    idDocumentoPrincipal: 214010,
                    anio: 2024,
                },
                {
                    ...registroBaseMockHistorico,
                    contenidoId: 155400,
                    versionId: 214002,
                    codigo: "N-0006",
                    titulo:
                        "Manual administrativo 2024",
                    fechaVigencia: "2025-03-20",
                    ultimaActualizacion:
                        "2024-03-20T12:00:00",
                    tieneNormasAdjuntas: false,
                    idDocumentoPrincipal: 214020,
                    anio: 2024,
                },
            ],
        },
    ];

    /*
    |--------------------------------------------------------------------------
    | HISTÓRICO DE NORMAS
    |--------------------------------------------------------------------------
    | Modos soportados:
    |
    | 1. Sin parámetros:
    |    /web/normateca/historico
    |    GET /api/v1/historico/normas
    |
    | 2. Documento principal:
    |    /web/normateca/historico?documento-prin={contenidoId}
    |    GET /api/v1/historico/normas/{contenidoId}/versiones
    |
    | 3. Formato adjunto:
    |    /web/normateca/historico?idContenido={contenidoId}&idArchivo={versionId}
    |    GET /api/v1/historico/normas/{contenidoId}/versiones/{versionId}
    |--------------------------------------------------------------------------
    */

    /*************************************/
    /* UTILIDADES GENERALES */
    /*************************************/
    function obtenerEnteroPositivo(valor) {
        const numero = Number.parseInt(String(valor ?? ""), 10);

        return Number.isInteger(numero) && numero > 0
            ? numero
            : null;
    }

    function escaparHtml(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatearFechaHistorico(fecha) {
        if (!fecha) {
            return "";
        }

        const fechaTexto = String(fecha).trim();
        const coincidencia = fechaTexto.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (coincidencia) {
            return `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`;
        }

        const fechaObjeto = new Date(fechaTexto);

        if (Number.isNaN(fechaObjeto.getTime())) {
            return fechaTexto;
        }

        return new Intl.DateTimeFormat("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
            .format(fechaObjeto)
            .replaceAll("/", "-");
    }

    function vigenciaConSemaforo(fechaVigencia, semaforo) {
        const coloresSemaforo = {
            ROJO: "#dc3545",
            VERDE: "#28a745",
            AMARILLO: "#ffc107",
        };

        const semaforoNormalizado = String(
            semaforo ?? ""
        )
            .trim()
            .toUpperCase();

        const colorBullet =
            coloresSemaforo[semaforoNormalizado] ||
            "#6c757d";

        return `
        <span class="d-inline-flex align-items-center" style="gap:18px;">
          <span
            aria-hidden="true"
            style="
              display:inline-block;
              width:10px;
              height:10px;
              flex:0 0 10px;
              border:1px solid rgba(0, 0, 0, 0.2);
              border-radius:50%;
              background-color:${colorBullet};
            "
          ></span>
          <span>
            ${escaparHtml(
            formatearFechaHistorico(fechaVigencia)
        )}
          </span>
        </span>
      `;
    }

    /*************************************/
    /* CONTEXTO DE LA RUTA */
    /*************************************/
    function obtenerContextoHistoricoRuta() {
        const parametros = new URLSearchParams(
            window.location.search
        );

        const documentoPrincipalId = obtenerEnteroPositivo(
            parametros.get("documento-prin")
        );

        const contenidoId = obtenerEnteroPositivo(
            parametros.get("idContenido")
        );

        const versionId = obtenerEnteroPositivo(
            parametros.get("idArchivo")
        );

        /*
         * Se da prioridad al histórico de formatos adjuntos cuando
         * vienen juntos idContenido e idArchivo.
         */
        if (contenidoId && versionId) {
            return {
                tipo: "FORMATO_ADJUNTO",
                contenidoId,
                versionId,
            };
        }

        if (documentoPrincipalId) {
            return {
                tipo: "DOCUMENTO_PRINCIPAL",
                contenidoId: documentoPrincipalId,
                versionId: null,
            };
        }

        return {
            tipo: "ANIO",
            contenidoId: null,
            versionId: null,
        };
    }

    function obtenerConfiguracionConsulta(
        contexto,
        anioConsulta
    ) {
        if (contexto.tipo === "FORMATO_ADJUNTO") {
            return {
                endpoint:
                    `/api/v1/historico/normas/${encodeURIComponent(
                        contexto.contenidoId
                    )}/versiones/${encodeURIComponent(
                        contexto.versionId
                    )}`,
                functionalId:
                    "CONSULTA HISTORICO DE FORMATOS ADJUNTOS",
                nombreOperacion:
                    "OBTENER HISTORICO DE FORMATOS ADJUNTOS",
                descripcionOperacion:
                    `SE CONSULTA EL HISTORICO DE FORMATOS ADJUNTOS DEL CONTENIDO ${contexto.contenidoId} Y ARCHIVO ${contexto.versionId}`,
                tituloTabla: "Histórico de formatos adjuntos",
                mostrarFiltroAnio: false,
            };
        }

        if (contexto.tipo === "DOCUMENTO_PRINCIPAL") {
            return {
                endpoint:
                    `/api/v1/historico/normas/${encodeURIComponent(
                        contexto.contenidoId
                    )}/versiones`,
                functionalId:
                    "CONSULTA HISTORICO DE NORMA",
                nombreOperacion:
                    "OBTENER HISTORICO DE NORMA",
                descripcionOperacion:
                    `SE CONSULTA EL HISTORICO DE LA NORMA ${contexto.contenidoId}`,
                tituloTabla: "Histórico de norma",
                mostrarFiltroAnio: false,
            };
        }

        return {
            endpoint: "/api/v1/historico/normas",
            functionalId:
                "CONSULTA HISTORICO DE NORMAS",
            nombreOperacion:
                "OBTENER HISTORICO DE NORMAS",
            descripcionOperacion:
                "SE CONSULTA EL HISTORICO DE NORMAS",
            tituloTabla: "Histórico de normas",
            mostrarFiltroAnio: false,
        };
    }

    /*************************************/
    /* SELECTOR DE AÑO */
    /*************************************/
    function obtenerSelectorAnioHistorico() {
        const containerAnio =
            document.getElementById("container-anio");

        if (!containerAnio) {
            return null;
        }

        return (
            containerAnio.querySelector("select") ||
            containerAnio.querySelector(
                'input[type="number"]'
            ) ||
            containerAnio.querySelector(
                "[data-selector-anio]"
            )
        );
    }

    function normalizarAnioHistorico(anio) {
        const anioActual = new Date().getFullYear();
        const valor = Number.parseInt(
            String(anio ?? ""),
            10
        );

        if (
            !Number.isInteger(valor) ||
            valor < 1900 ||
            valor > 9999
        ) {
            return anioActual;
        }

        return valor;
    }

    function configurarSelectorAnioHistorico(anio) {
        const selectorAnio =
            obtenerSelectorAnioHistorico();

        if (!selectorAnio) {
            return;
        }

        const anioNormalizado =
            normalizarAnioHistorico(anio);

        if (selectorAnio.tagName === "SELECT") {
            const existeOpcion = Array.from(
                selectorAnio.options || []
            ).some(function (option) {
                return (
                    Number(option.value) ===
                    anioNormalizado
                );
            });

            if (!existeOpcion) {
                const option =
                    document.createElement("option");

                option.value = String(anioNormalizado);
                option.textContent =
                    String(anioNormalizado);

                selectorAnio.appendChild(option);
            }
        }

        selectorAnio.value =
            String(anioNormalizado);
    }

    function registrarEventoAnioHistorico() {
        /*
         * La tabla dinámica reemplaza el selector al volver a
         * renderizar. El evento delegado permanece activo.
         */
        if (
            window.eventoCambioAnioHistoricoNormas
        ) {
            document.removeEventListener(
                "change",
                window.eventoCambioAnioHistoricoNormas,
                true
            );
        }

        window.eventoCambioAnioHistoricoNormas =
            async function (event) {
                /*
                 * En los históricos por documento o formato adjunto
                 * no se permite disparar la consulta anual.
                 */
                const contextoActual =
                    obtenerContextoHistoricoRuta();

                if (contextoActual.tipo !== "ANIO") {
                    return;
                }

                const containerAnio =
                    document.getElementById(
                        "container-anio"
                    );

                if (!containerAnio) {
                    return;
                }

                const selectorActual =
                    event.target.closest(
                        "select, input[type='number'], [data-selector-anio]"
                    );

                if (
                    !selectorActual ||
                    !containerAnio.contains(
                        selectorActual
                    )
                ) {
                    return;
                }

                const nuevoAnio =
                    normalizarAnioHistorico(
                        selectorActual.value
                    );

                await obtenerInformacionTabla(
                    nuevoAnio,
                    contextoActual
                );
            };

        document.addEventListener(
            "change",
            window.eventoCambioAnioHistoricoNormas,
            true
        );
    }

    /*************************************/
    /* NORMALIZAR RESPONSE */
    /*************************************/
    function obtenerNormasPorAnio(
        dataResponse
    ) {
        const grupos = Array.isArray(dataResponse)
            ? dataResponse
            : [];

        return grupos.flatMap(function (grupo) {
            return Array.isArray(grupo?.normas)
                ? grupo.normas
                : [];
        });
    }

    function obtenerRegistrosVersiones(
        dataResponse
    ) {
        if (Array.isArray(dataResponse)) {
            return dataResponse.flatMap(
                function (elemento) {
                    if (Array.isArray(elemento?.versiones)) {
                        return elemento.versiones;
                    }

                    if (Array.isArray(elemento?.normas)) {
                        return elemento.normas;
                    }

                    if (Array.isArray(elemento?.formatos)) {
                        return elemento.formatos;
                    }

                    if (
                        Array.isArray(
                            elemento?.documentos
                        )
                    ) {
                        return elemento.documentos;
                    }

                    return [elemento];
                }
            );
        }

        if (
            dataResponse &&
            typeof dataResponse === "object"
        ) {
            const posiblesArreglos = [
                dataResponse.versiones,
                dataResponse.normas,
                dataResponse.formatos,
                dataResponse.documentos,
                dataResponse.data,
            ];

            const arregloEncontrado =
                posiblesArreglos.find(
                    Array.isArray
                );

            if (arregloEncontrado) {
                return arregloEncontrado;
            }

            return [dataResponse];
        }

        return [];
    }

    function normalizarRegistroHistorico(
        item,
        contexto
    ) {
        const registro =
            item && typeof item === "object"
                ? item
                : {};

        const documentoPrincipal =
            registro.documentoPrincipal &&
                typeof registro.documentoPrincipal ===
                "object"
                ? registro.documentoPrincipal
                : {};

        return {
            ...registro,

            contenidoId:
                registro.contenidoId ??
                registro.idContenido ??
                registro.id ??
                contexto.contenidoId ??
                "",

            versionId:
                registro.versionId ??
                registro.idVersion ??
                registro.version ??
                contexto.versionId ??
                "",

            codigo:
                registro.codigo ??
                registro.codigoNorma ??
                "",

            titulo:
                registro.titulo ??
                registro.nombre ??
                registro.nombreDocumento ??
                registro.nombreArchivo ??
                "",

            clasificacion:
                registro.clasificacion ??
                registro.tipoClasificacion ??
                "",

            fechaVigencia:
                registro.fechaVigencia ??
                registro.vigencia ??
                registro.fechaDesde ??
                "",

            semaforo:
                registro.semaforo ?? "",

            ultimaActualizacion:
                registro.ultimaActualizacion ??
                registro.fechaActualizacion ??
                registro.fechaModificacion ??
                registro.fechaCreacion ??
                "",

            idDocumentoPrincipal:
                registro.idDocumentoPrincipal ??
                registro.documentoId ??
                registro.idArchivo ??
                registro.archivoId ??
                documentoPrincipal.id ??
                "",

            tieneNormasAdjuntas:
                registro.tieneNormasAdjuntas ===
                true ||
                registro.datosAdjuntos === true,

            descargaPermitida:
                registro.descargaPermitida !== false,
        };
    }

    function obtenerRegistrosHistorico(
        dataResponse,
        contexto,
        anioConsulta
    ) {
        const registros =
            contexto.tipo === "ANIO"
                ? obtenerNormasPorAnio(
                    dataResponse
                )
                : obtenerRegistrosVersiones(
                    dataResponse
                );

        return registros.map(function (item) {
            return normalizarRegistroHistorico(
                item,
                contexto
            );
        });
    }

    /*************************************/
    /* DOCUMENTOS */
    /*************************************/
    function documentosUso(norma) {
        const contenidoId =
            norma.contenidoId ?? "";

        const tieneNormasAdjuntas =
            norma.tieneNormasAdjuntas === true;

        if (tieneNormasAdjuntas) {
            return `
          <a
            title="Ver documentos adjuntos"
            aria-label="Ver documentos adjuntos"
            href="/web/normateca/detalle-inventario?id=${encodeURIComponent(
                contenidoId
            )}&historico=true"
            class="d-inline-flex align-items-center justify-content-center"
          >
            <i
              class="bi bi-folder-fill"
              aria-hidden="true"
            ></i>
          </a>
        `;
        }

        return "";
    }

    function tituloConVistaPrevia(norma) {
        const contenidoId =
            norma.contenidoId ?? "";

        const versionId =
            norma.versionId ?? "";

        const idDocumentoPrincipal =
            norma.idDocumentoPrincipal ?? "";

        const tieneDocumentoPrincipal =
            idDocumentoPrincipal !== "" &&
            idDocumentoPrincipal !== null &&
            Number(idDocumentoPrincipal) > 0;

        if (!tieneDocumentoPrincipal) {
            return escaparHtml(norma.titulo);
        }

        return `
        <a
          href="#"
          class="btn btn-link p-0 btn-vista-previa-inventario llamar-visor"
          data-id="${escaparHtml(contenidoId)}"
          data-id-archivo="${escaparHtml(idDocumentoPrincipal)}"
          data-codigo="${escaparHtml(norma.codigo)}"
          data-titulo="${escaparHtml(norma.titulo)}"
          data-clasificacion="${escaparHtml(norma.clasificacion)}"
          data-vigencia="${escaparHtml(norma.fechaVigencia)}"
          data-semaforo="${escaparHtml(norma.semaforo ?? "")}"
          data-tipo="NORMA"
          data-tipo-registro="NORMA"
          data-contenido-id="${escaparHtml(contenidoId)}"
          data-id-contenido="${escaparHtml(contenidoId)}"
          data-version-id="${escaparHtml(versionId)}"
          data-id-registro="${escaparHtml(norma.idRegistro ?? contenidoId)}"
          data-titulo-norma="${escaparHtml(norma.tituloNorma ?? norma.titulo)}"
          data-fecha-modificacion="${escaparHtml(norma.fechaModificacion ?? norma.ultimaActualizacion ?? "")}"
          data-renovacion="${norma.renovacion === true}"
          data-documento-id="${escaparHtml(idDocumentoPrincipal)}"
          data-archivo-id="${escaparHtml(idDocumentoPrincipal)}"
          data-descarga-permitida="${norma.descargaPermitida === true}"
          data-tiene-documento-principal="${tieneDocumentoPrincipal}"
          data-fecha-desde="${escaparHtml(norma.fechaDesde ?? "")}"
          data-fecha-hasta="${escaparHtml(norma.fechaHasta ?? norma.fechaVigencia)}"
          data-is-update="${norma.isUpdate === true}"
          data-vigencia-manual="${norma.vigenciaManual === true}"
          data-nombre="${escaparHtml(norma.nombre ?? norma.nombreArchivo ?? "")}"
          data-nombre-archivo="${escaparHtml(norma.nombreArchivo ?? norma.nombre ?? "")}"
          data-datos-adjuntos="${norma.tieneNormasAdjuntas === true}"
          data-tiene-formatos-adjuntos="${norma.tieneFormatosAdjuntos === true}"
          title="Vista previa"
          aria-label="Ver ${escaparHtml(norma.titulo)}"
        >
          ${escaparHtml(norma.titulo)}
        </a>
      `;
    }

    /*************************************/
    /* TABLA */
    /*************************************/
    async function obtenerPermisoNormaHistorico(
        contenidoId,
        intentos = 50
    ) {
        const idBuscado = String(contenidoId ?? "").trim();

        if (!idBuscado) {
            return null;
        }

        for (let i = 0; i < intentos; i++) {
            const permisosStorage = sessionStorage.getItem("permisos");

            if (permisosStorage !== null) {
                try {
                    const permisos = JSON.parse(permisosStorage);

                    if (!Array.isArray(permisos)) {
                        return null;
                    }

                    return (
                        permisos.find(function (permiso) {
                            return (
                                permiso && String(permiso.contenidoId ?? "").trim() === idBuscado
                            );
                        }) || null
                    );
                } catch (error) {
                    console.error(
                        "[PERMISOS] No fue posible interpretar los permisos:",
                        error
                    );

                    return null;
                }
            }

            await new Promise(function (resolve) {
                setTimeout(resolve, 200);
            });
        }

        return null;
    }


    const estilosPermisoHistorico = new WeakMap();

    async function prepararColoresPermisosHistorico(registros) {
        await Promise.all(registros.map(async function (item) {
            if (esAdmin) {
                estilosPermisoHistorico.set(item, "");
                return;
            }
            const clasificacion = String(item.clasificacion ?? "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .trim().toLowerCase();
            const protegida = clasificacion === "restringida" ||
                clasificacion === "confidencial";
            const permiso = protegida
                ? await obtenerPermisoNormaHistorico(item.contenidoId)
                : null;
            const puedeVer = !protegida ||
                [true, "true", 1, "1"].includes(permiso?.verPdf);
            estilosPermisoHistorico.set(item,
                `background-color: ${puedeVer ? "#FFFFFF" : "#E9ECEF"} !important;`);
        }));
    }

    function crearFilasHistorico(registros) {
        return registros.map(function (item) {
            const estiloFila = estilosPermisoHistorico.get(item) || "";
            return `
          ${esAdmin ? `<td style="${estiloFila}">
            ${escaparHtml(item.codigo)}
          </td>` : ""}
  
          <td style="${estiloFila}">
            ${tituloConVistaPrevia(item)}
          </td>
  
          <td style="${estiloFila}">
            ${escaparHtml(item.clasificacion)}
          </td>
  
          <td style="${estiloFila}">
            ${vigenciaConSemaforo(
                item.fechaVigencia,
                item.semaforo
            )}
          </td>
  
          <td style="${estiloFila}">
            ${escaparHtml(
                formatearFechaHistorico(
                    item.fhasta
                )
            )}
          </td>
  
          <td class="text-center" style="${estiloFila}">
            ${documentosUso(item)}
          </td>
        `;
        });
    }

    function obtenerColumnasHistorico() {
        return [
            ...(esAdmin ? [{
                titulo: "Código",
                ordenar: true,
            }] : []),
            {
                titulo: "Título",
                ordenar: true,
            },
            {
                titulo: "Clasificación",
                ordenar: true,
            },
            {
                titulo: "Fecha de vigencia",
                ordenar: true,
            },
            {
                titulo: "Fecha hasta",
                ordenar: true,
            },
            {
                titulo: "Documentos",
                ordenar: false,
            },
        ];
    }

    function obtenerAnioVigencia(
        fechaVigencia
    ) {
        const fechaTexto = String(
            fechaVigencia ?? ""
        ).trim();

        const coincidencia = fechaTexto.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (coincidencia) {
            return coincidencia[1];
        }

        const fechaObjeto = new Date(fechaTexto);

        if (!Number.isNaN(fechaObjeto.getTime())) {
            return String(fechaObjeto.getFullYear());
        }

        return "SIN_FECHA";
    }

    function obtenerTiempoUltimaActualizacion(
        fechaUltimaActualizacion
    ) {
        const fechaTexto = String(
            fechaUltimaActualizacion ?? ""
        ).trim();

        if (!fechaTexto) {
            return null;
        }

        const coincidenciaFecha = fechaTexto.match(
            /^(\d{2})[-\/]([0-1]\d)[-\/](\d{4})(.*)$/
        );

        const fechaNormalizada = coincidenciaFecha
            ? `${coincidenciaFecha[3]}-${coincidenciaFecha[2]}-${coincidenciaFecha[1]}${coincidenciaFecha[4]}`
            : fechaTexto;

        const tiempo = new Date(
            fechaNormalizada
        ).getTime();

        return Number.isNaN(tiempo)
            ? null
            : tiempo;
    }

    function ordenarPorUltimaActualizacion(
        registros
    ) {
        return registros
            .map(function (registro, indice) {
                return {
                    registro,
                    indice,
                    tiempo:
                        obtenerTiempoUltimaActualizacion(
                            registro.ultimaActualizacion
                        ),
                };
            })
            .sort(function (registroA, registroB) {
                if (
                    registroA.tiempo === null &&
                    registroB.tiempo === null
                ) {
                    return registroA.indice - registroB.indice;
                }

                if (registroA.tiempo === null) {
                    return 1;
                }

                if (registroB.tiempo === null) {
                    return -1;
                }

                return (
                    registroB.tiempo - registroA.tiempo ||
                    registroA.indice - registroB.indice
                );
            })
            .map(function (elemento) {
                return elemento.registro;
            });
    }

    function agruparRegistrosPorAnio(
        registros
    ) {
        const grupos = new Map();

        registros.forEach(function (registro) {
            const anio = obtenerAnioVigencia(
                registro.fechaVigencia
            );

            if (!grupos.has(anio)) {
                grupos.set(anio, []);
            }

            grupos.get(anio).push(registro);
        });

        return Array.from(grupos.entries())
            .sort(function ([anioA], [anioB]) {
                if (anioA === "SIN_FECHA") {
                    return 1;
                }

                if (anioB === "SIN_FECHA") {
                    return -1;
                }

                return Number(anioB) - Number(anioA);
            })
            .map(function ([anio, registrosAnio]) {
                return {
                    anio,
                    registros:
                        ordenarPorUltimaActualizacion(
                            registrosAnio
                        ),
                };
            });
    }

    function pintarTablasHistoricoPorAnio(
        registros
    ) {
        const contenedorPrincipal =
            document.querySelector(
                "#tabla-dinamica"
            );

        if (!contenedorPrincipal) {
            throw new Error(
                "No existe el contenedor #tabla-dinamica"
            );
        }

        const gruposPorAnio =
            agruparRegistrosPorAnio(registros);

        const tieneEstructuraBase =
            Array.from(
                contenedorPrincipal.children
            ).some(function (elemento) {
                return elemento.classList.contains(
                    "tabla-h1"
                );
            });

        if (tieneEstructuraBase) {
            window.plantillaTablaHistoricoNormas =
                contenedorPrincipal.innerHTML;
        }

        const plantillaTabla =
            window.plantillaTablaHistoricoNormas;

        if (!plantillaTabla) {
            throw new Error(
                "No fue posible obtener la estructura de la tabla dinámica"
            );
        }

        if (gruposPorAnio.length === 0) {
            contenedorPrincipal.innerHTML =
                plantillaTabla;

            window.crearTablaDinamica({
                contenedor: "#tabla-dinamica",
                titulo: "Histórico de normas",
                mostrarFiltroAnio: false,
                columnas:
                    obtenerColumnasHistorico(),
                filas: [],
            });

            return;
        }

        contenedorPrincipal.innerHTML = "";

        const bloquesAnuales = [];

        gruposPorAnio.forEach(function (
            grupo,
            indice
        ) {
            const idContenedor =
                `tabla-historico-anio-${indice}`;
            const contenedorAnio =
                document.createElement("div");

            contenedorAnio.id = idContenedor;
            contenedorAnio.className =
                "tabla-historico-por-anio mb-4";

            contenedorAnio.innerHTML =
                plantillaTabla;

            contenedorPrincipal.appendChild(
                contenedorAnio
            );

            window.crearTablaDinamica({
                contenedor: `#${idContenedor}`,
                titulo:
                    grupo.anio === "SIN_FECHA"
                        ? "Sin fecha de vigencia"
                        : `Año ${grupo.anio}`,
                mostrarFiltroAnio: false,
                columnas:
                    obtenerColumnasHistorico(),
                filas: crearFilasHistorico(
                    grupo.registros
                ),
            });

            const filtrosInternos =
                contenedorAnio.querySelector(
                    "#container-anio"
                );

            if (filtrosInternos) {
                const filaFiltros =
                    filtrosInternos.parentElement;

                filtrosInternos.remove();

                if (filaFiltros) {
                    filaFiltros.classList.remove(
                        "justify-content-between"
                    );
                    filaFiltros.classList.add(
                        "justify-content-end"
                    );
                }
            }

            bloquesAnuales.push(
                contenedorAnio
            );
        });

        if (
            window.eventoBusquedaHistoricoNormas
        ) {
            document.removeEventListener(
                "input",
                window.eventoBusquedaHistoricoNormas
            );
        }

        window.eventoBusquedaHistoricoNormas =
            function (event) {
                const inputBusqueda =
                    event.target;

                if (
                    !inputBusqueda?.classList
                        ?.contains(
                            "buscador-normateca"
                        )
                ) {
                    return;
                }

                const textoBusqueda =
                    String(inputBusqueda.value ?? "")
                        .slice(0, 40)
                        .toLowerCase()
                        .trim();

                bloquesAnuales.forEach(function (
                    bloqueAnual
                ) {
                    const totalCoincidencias =
                        bloqueAnual.tablaAdmin
                            ?.aplicarFiltroExterno(
                                textoBusqueda
                            ) ?? 0;

                    const tieneCoincidencias =
                        totalCoincidencias > 0;

                    bloqueAnual.style.display =
                        tieneCoincidencias
                            ? ""
                            : "none";
                });
            };

        document.addEventListener(
            "input",
            window.eventoBusquedaHistoricoNormas
        );
    }

    /*************************************/
    /* BITÁCORA */
    /*************************************/
    async function registrarBitacoraHistorico(
        configuracion,
        statusCode,
        mensaje
    ) {
        if (
            !window.bitacoraService?.operationLog
        ) {
            console.warn(
                "bitacoraService no disponible"
            );

            return;
        }

        await window.bitacoraService.operationLog(
            "GET",
            "CONSULTAR",
            configuracion.nombreOperacion,
            configuracion.descripcionOperacion,
            statusCode,
            JSON.stringify(
                mensaje || "Consulta exitosa"
            )
        );
    }

    function obtenerDetalleError(error) {
        const resultado = {
            statusCode: 500,
            message:
                error?.message ||
                "Error desconocido",
        };

        const mensajeError =
            String(error?.message ?? "");

        const indiceJson =
            mensajeError.indexOf("{");

        if (indiceJson === -1) {
            return resultado;
        }

        try {
            const errorObj = JSON.parse(
                mensajeError.substring(indiceJson)
            );

            resultado.statusCode =
                errorObj?.errorMessageDTO
                    ?.statusCode ||
                errorObj?.statusCode ||
                500;

            resultado.message =
                errorObj?.errorMessageDTO?.message ||
                errorObj?.message ||
                resultado.message;
        } catch (errorParseo) {
            console.error(
                "No fue posible interpretar el error:",
                errorParseo
            );
        }

        return resultado;
    }

    /*************************************/
    /* CONSULTAR INFORMACIÓN */
    /*************************************/
    async function obtenerInformacionTabla(
        anio = new Date().getFullYear(),
        contextoForzado = null
    ) {
        const contexto =
            contextoForzado ||
            obtenerContextoHistoricoRuta();

        const anioConsulta =
            normalizarAnioHistorico(anio);

        const configuracion =
            obtenerConfiguracionConsulta(
                contexto,
                anioConsulta
            );

        window.mostrarLoaderPeticion();

        try {
            sessionStorage.setItem(
                "functional-id",
                configuracion.functionalId
            );

            if (
                typeof window
                    .tokenizerTransactionId !==
                "function"
            ) {
                throw new Error(
                    "tokenizerTransactionId no está disponible"
                );
            }

            await window.tokenizerTransactionId();

            console.log(
                "[HISTÓRICO] Ejecutando GET",
                configuracion.endpoint
            );

            const response =
                await window.apiFetch(
                    "normativas",
                    configuracion.endpoint
                );

            const dataResponseReal =
                response?.data?.dataResponse || [];

            /*
             * PRUEBA TEMPORAL:
             * La petición se conserva, pero mientras
             * USAR_MOCK_HISTORICO sea true se ignora
             * el dataResponse real y se usa el mock.
             */
            const dataResponse =
                USAR_MOCK_HISTORICO
                    ? MOCK_DATA_RESPONSE_HISTORICO
                    : dataResponseReal;

            const registros =
                obtenerRegistrosHistorico(
                    dataResponse,
                    contexto,
                    anioConsulta
                );

            if (
                typeof window
                    .crearTablaDinamica !==
                "function"
            ) {
                throw new Error(
                    "crearTablaDinamica no existe"
                );
            }

            await prepararColoresPermisosHistorico(registros);

            pintarTablasHistoricoPorAnio(
                registros
            );

            await registrarBitacoraHistorico(
                configuracion,
                response?.data?.statusCode ?? 200,
                response?.data?.message ||
                "Consulta exitosa"
            );

            return response?.data;
        } catch (error) {
            const detalleError =
                obtenerDetalleError(error);

            try {
                await registrarBitacoraHistorico(
                    configuracion,
                    detalleError.statusCode,
                    detalleError.message
                );
            } catch (errorBitacora) {
                console.error(
                    "Error al registrar la bitácora:",
                    errorBitacora
                );
            }

            console.error(
                "Error al consultar el histórico:",
                error
            );

            return null;
        } finally {
            window.ocultarLoaderPeticion();
        }
    }

    async function cargarHistoricoSegunRuta() {
        const contexto =
            obtenerContextoHistoricoRuta();

        /*
         * Cuando existen parámetros válidos no se realiza
         * primero la consulta del año.
         */
        if (contexto.tipo !== "ANIO") {
            return obtenerInformacionTabla(
                new Date().getFullYear(),
                contexto
            );
        }

        return obtenerInformacionTabla(
            new Date().getFullYear(),
            contexto
        );
    }

    window.obtenerInformacionTabla =
        obtenerInformacionTabla;

    window.cargarHistoricoSegunRuta =
        cargarHistoricoSegunRuta;

    /*************************************/
    /* LIFERAY */
    /*************************************/
    if (!window.Liferay) {
        console.error(
            "Liferay no está disponible"
        );

        return;
    }

    /*************************************/
    /* EJECUCIÓN INMEDIATA */
    /*************************************/
    await cargarHistoricoSegunRuta();

    /*************************************/
    /* LIMPIAR EVENTOS ANTERIORES */
    /*************************************/
    if (
        window.informacionEventoNavigate
    ) {
        Liferay.detach(
            "endNavigate",
            window.informacionEventoNavigate
        );
    }

    /*************************************/
    /* NAVEGACIÓN SPA */
    /*************************************/
    window.informacionEventoNavigate =
        async function () {
            /*
             * Se vuelve a leer window.location.search para detectar
             * correctamente los parámetros de la nueva navegación.
             */
            await cargarHistoricoSegunRuta();
        };

    Liferay.on(
        "endNavigate",
        window.informacionEventoNavigate
    );
})();

const btnRegresarHistorico = document.getElementById("btn-regresar-historico");

if (btnRegresarHistorico) {
    btnRegresarHistorico.addEventListener("click", () => {
        window.history.back();
    });
}
