/******************************************************************************/
/* CONFIG GLOBAL APIs */
/******************************************************************************/
window.apiConfig = {
    tokenizer: "https://banobras-api-tokenizer-common-apps-qa.banobras.gob.mx",

    bitacora:
        "https://backend-business-centralized-logs-develop.banobras.gob.mx/bitacora",

    normativas: "https://normateca-liferay-develop.banobras.gob.mx",
};

const CLIENT_ID = "id-8b28fb90-7b98-5ca5-1d22-4e5c8ca15";
const REDIRECT_URI = "https://liferay-qa.banobras.gob.mx";
let cachedToken = null;
let tokenOAuthEnProceso = null;

/******************************************************************************/
/* INICIAR TRANSACCIÓN */
/******************************************************************************/
window.startTransaction = function (functionalId = "Consulta") {
    const transactionId = crypto.randomUUID();

    sessionStorage.setItem("transaction-id", transactionId);

    sessionStorage.setItem("functional-id", functionalId);

    return transactionId;
};

/******************************************************************************/
/* TOKENIZER */
/******************************************************************************/

window.tokenizerTransactionId = async function () {
    /*************************************/
    /* OBTENER TOKEN OAUTH2 */
    /*************************************/
    try {
        const tokenOAuth = await obtenerTokenOAuth2();

        if (tokenOAuth) {
            sessionStorage.setItem("Authorization", `Bearer ${tokenOAuth}`);
        }
    } catch (error) {
        console.error("Error obteniendo token OAuth2:", error);
    }

    /*************************************/
    /* CODIGO ORIGINAL */
    /*************************************/
    let encode = sessionStorage.getItem("encode");

    if (!encode) {
        encode = "52A54AC3F9D9B71738EDAE3984226EFB2F86";
    }

    const cleanEncode = encode.replace(/"/g, "");

    try {
        const headers = await window.getGlobalHeaders({
            credentials: cleanEncode,

            "time-refresh-token": 1,

            "session-mode": "NORMAL",
        });

        const response = await fetch(
            `${window.apiConfig.tokenizer}/tokenizer/v1/token`,
            {
                method: "POST",

                headers,

                body: JSON.stringify({}),
            }
        );

        const data = await response.json();

        if (data?.tokenDTO?.token) {
            sessionStorage.setItem("token", data.tokenDTO.refreshToken);
        }

        return data;
    } catch (error) {
        console.error("Error tokenizerTransactionId:", error);

        throw error;
    }
};

/******************************************************************************/
/* OBTENER IP PUBLICA */
/******************************************************************************/
let ip = null;
async function getLocalIPs() {
    const ips = [];
    const pc = new RTCPeerConnection({
        iceServers: [],
    });

    return new Promise((resolve, reject) => {
        pc.createDataChannel("");

        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch((error) => {
                pc.close();
                reject(error);
            });

        pc.onicecandidate = (event) => {
            // Terminó la recopilación de candidatos
            if (!event?.candidate) {
                pc.close();

                const uniqueIps = [...new Set(ips)];

                ip = uniqueIps[0] ?? null;

                resolve(ip);
                return;
            }

            const candidate = event.candidate.candidate;

            const ipRegex = /(\d{1,3}(?:\.\d{1,3}){3})/;
            const match = ipRegex.exec(candidate);

            if (match) {
                ips.push(match[1]);
            }
        };
    });
}
window.obtenerIP = async function () {
    try {
        const ipInterna = await getLocalIPs();
        console.log("IP:", ipInterna);
        return ipInterna ?? "SIN_DIRECTIVA";
    } catch (e) {
        return "0.0.0.0";
    }
};

/******************************************************************************/
/* UUID TRANSACCION */
/******************************************************************************/
window.obtenerTransactionId = function () {
    let id = sessionStorage.getItem("transaction-id");

    if (!id) {
        id = crypto.randomUUID();

        sessionStorage.setItem("transaction-id", id);
    }

    return id;
};

/******************************************************************************/
/* SET FUNCTIONAL ID */
/******************************************************************************/
window.setFunctionalId = function (functionalId) {
    sessionStorage.setItem("functional-id", functionalId);
};

/******************************************************************************/
/* NOMBRE APP */
/******************************************************************************/
window.obtenerAppName = function () {
    return sessionStorage.getItem("app-name") || "NORMATECA";
};

/******************************************************************************/
/* TOKEN LIFERAY */
/******************************************************************************/
window.obtenerTokenLiferay = function () {
    return sessionStorage.getItem("Authorization") || "BARER LIFERAY";
};

/******************************************************************************/
/* CONSUMIDOR */
/******************************************************************************/
window.obtenerConsumerId = function () {
    return sessionStorage.getItem("consumer-id") || "NORMATECA UI";
};

/******************************************************************************/
/* FUNCIONALIDAD */
/******************************************************************************/
window.obtenerFunctionalId = function () {
    const functionalId = sessionStorage.getItem("functional-id") || "Consulta";

    return functionalId.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/******************************************************************************/
/* USUARIO */
/******************************************************************************/
window.obtenerUsuario = function () {
    return sessionStorage.getItem("usuario") || "USUARIO NORMATECA";
};

/******************************************************************************/
/* NOMBRE OPERADOR */
/******************************************************************************/
window.obtenerNombreOperador = function () {
    return sessionStorage.getItem("nombreCompleto") || "Cuenta Servicio";
};

/******************************************************************************/
/* RFC */
/******************************************************************************/
window.obtenerRFC = function () {
    return sessionStorage.getItem("rfc") || "ABCD123456AA";
};

/******************************************************************************/
/* AREA */
/******************************************************************************/
window.obtenerArea = function () {
    return sessionStorage.getItem("area") || "Infraestructura";
};

/******************************************************************************/
/* PUESTO */
/******************************************************************************/
window.obtenerPuesto = function () {
    return sessionStorage.getItem("puesto") || "Servicio";
};

/******************************************************************************/
/* TOKEN */
/******************************************************************************/
window.token = function () {
    return sessionStorage.getItem("token") || "";
};

/******************************************************************************/
/* HEADERS GLOBALES */
/******************************************************************************/
window.getGlobalHeaders = async function (extraHeaders = {}) {
    let ip = await window.obtenerIP();

    return {
        "Content-Type": "application/json",
        Origin: "http://localhost:8080",
        credentials: sessionStorage.getItem("credentials") || "95170AF3553DF0CF45",

        "app-name": window.obtenerAppName(),

        "consumer-id": window.obtenerConsumerId(),

        "functional-id": window.obtenerFunctionalId(),

        "transaction-id": window.obtenerTransactionId(),

        "ip-equipo": ip,

        "usuario-operador": window.obtenerUsuario(),

        "nombre-operador": window.obtenerNombreOperador(),

        "expediente-operador": sessionStorage.getItem("expediente") || "12345ABCDE",

        "rfc-operador": window.obtenerRFC(),

        "area-operador": window.obtenerArea(),

        "puesto-operador": window.obtenerPuesto(),

        "token-auth": window.token(),

        Authorization: window.obtenerTokenLiferay(),

        ...extraHeaders,
    };
};

/******************************************************************************/
/* FETCH GLOBAL */
/******************************************************************************/
window.apiFetch = async function (
    apiName,
    endpoint,
    method = "GET",
    data = null,
    extraHeaders = {}
) {
    const headers = await window.getGlobalHeaders(extraHeaders);

    let baseUrl = window.apiConfig[apiName];

    if (!baseUrl) {
        return {
            ok: false,

            status: 500,

            data: null,
        };
    }

    baseUrl = baseUrl.replace(/\/$/, "");

    endpoint = endpoint.replace(/^\//, "");

    let config = {
        method,

        headers,
    };

    if (data && method !== "GET") {
        config.body = JSON.stringify(data);
    }

    try {
        const r = await fetch(
            `${baseUrl}/${endpoint}`,

            config
        );

        const responseData = await r.json();

        return {
            ok: r.ok,

            status: r.status,

            data: responseData,
        };
    } catch (e) {
        return {
            ok: false,

            status: 500,

            data: null,
        };
    }
};

/******************************************************************************/
/* POST GLOBAL */
/******************************************************************************/
window.apiPost = async function (
    apiName,
    endpoint,
    data = {},
    extraHeaders = {}
) {
    return await window.apiFetch(
        apiName,

        endpoint,

        "POST",

        data,

        extraHeaders
    );
};

/******************************************************************************/
/* PUT GLOBAL */
/******************************************************************************/
window.apiPut = async function (
    apiName,
    endpoint,
    data = {},
    extraHeaders = {}
) {
    return await window.apiFetch(
        apiName,

        endpoint,

        "PUT",

        data,

        extraHeaders
    );
};

window.apiPatch = async function (
    apiName,
    endpoint,
    data = {},
    extraHeaders = {}
) {
    return await window.apiFetch(
        apiName,

        endpoint,

        "PATCH",

        data,

        extraHeaders
    );
};

/******************************************************************************/
/* DELETE GLOBAL */
/******************************************************************************/
window.apiDelete = async function (apiName, endpoint, extraHeaders = {}) {
    return await window.apiFetch(
        apiName,

        endpoint,

        "DELETE",

        null,

        extraHeaders
    );
};

/******************************************************************************/
/* BITACORA */
/******************************************************************************/
class BitacoraService {
    async accesosLog(metodo, actividad, statusNum, respuestaOperacion) {
        try {
            const data = {
                identificador: 0,
                aplicativoId: "NORMATECA",
                capa: "Frontend",
                metodo,
                transaccionId: window.obtenerTransactionId(),
                estatusOperacion: statusNum === 200 || statusNum === 201 ? "C" : "I",
                respuestaOperacion,
                actividad,
                fechaHoraAcceso: new Date().toISOString(),
                usuarioAcceso: window.obtenerUsuario(),
                nombreUsuario: window.obtenerNombreOperador(),
                expedienteUsuario: sessionStorage.getItem("expediente") || "Sin dato",
                rfcUsuario: window.obtenerRFC(),
                areaUsuario: window.obtenerArea(),
                puestoUsuario: window.obtenerPuesto(),
                ipEquipo: await window.obtenerIP(),
            };
            // La URL base de bitácora ya incluye /bitacora.
            return await window.apiPost("bitacora", "/accesos/registrar", data);
        } catch (error) {
            console.error("Error accesosLog:", error);
            return error;
        }
    }

    async operationLog(
        metodo,
        proceso,
        subproceso,
        detalleOp,
        statusNum,
        responseDTO
    ) {
        let statusCode = statusNum === 200 || statusNum === 201 ? "C" : "I";
        const fecha = new Date();

        const fechaLocal = new Date(
            fecha.getTime() - fecha.getTimezoneOffset() * 60000
        ).toISOString();
        const data = {
            identificador: 0,

            aplicativoId: "NORMATECA",

            capa: "Front",

            metodo,

            proceso,

            subproceso,

            detalleOperacion: detalleOp,

            transaccionId: window.obtenerTransactionId(),

            ipEquipo: await window.obtenerIP(),

            fechaHoraTransaccion: fechaLocal,

            usuarioOperador: window.obtenerUsuario(),

            nombreOperador: window.obtenerNombreOperador(),

            expedienteOperador: sessionStorage.getItem("expediente") || "12345ABCDE",

            rfcOperador: window.obtenerRFC(),

            areaOperador: window.obtenerArea(),

            puestoOperador: window.obtenerPuesto(),

            estatusOperacion: statusCode,

            respuestaOperacion: responseDTO,
        };

        try {
            return await window.apiPost("bitacora", "/operaciones/registrar", data);
        } catch (error) {
            console.error("Error operationLog:", error);

            return error;
        }
    }

    async usuariosLog(
        metodo,
        subproceso,
        detalleOp,
        statusNum,
        responseDTO,
        datosUsuario = {},
        tipoBitacora = "Usuarios"
    ) {
        const statusCode = statusNum === 200 || statusNum === 201 ? "C" : "I";
        const fecha = new Date();

        const fechaLocal = new Date(
            fecha.getTime() - fecha.getTimezoneOffset() * 60000
        ).toISOString();
        const {
            nombreUsuario = "",
            expedienteUsuario = "",
            rfcUsuario = "",
            areaUsuario = "",
            puestoUsuario = "",
            usuario = "",
        } = datosUsuario;

        const data = {
            identificador: 0,
            aplicativoId: "NORMATECA",
            capa: "Frontend",
            metodo,
            transaccionId: window.obtenerTransactionId(),
            ipEquipo: await window.obtenerIP(),
            estatusOperacion: statusCode,
            respuestaOperacion: responseDTO,
            usuarioOperador: window.obtenerUsuario(),
            nombreOperador: window.obtenerNombreOperador(),
            expedienteOperador: "sin dato",
            rfcOperador: window.obtenerRFC(),
            areaOperador: window.obtenerArea(),
            puestoOperador: window.obtenerPuesto(),

            nombreUsuario,
            expedienteUsuario,
            rfcUsuario,
            areaUsuario,
            puestoUsuario,
            usuario,

            proceso: tipoBitacora || "Usuarios",
            subproceso,
            detalleOperacion: detalleOp,
            fechaHoraOperacion: fechaLocal,
        };

        try {
            return await window.apiPost("bitacora", "/usuarios/registrar", data);
        } catch (error) {
            console.error("Error usuariosLog:", error);
            return error;
        }
    }
}

/******************************************************************************/
/* INSTANCIA GLOBAL */
/******************************************************************************/
window.bitacoraService = new BitacoraService();

/******************************************************************************/
/* FUNCIONALIDAD DE TOKEN OAUTH2 */
/******************************************************************************/

function base64url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

async function generatePKCE() {
    const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = base64url(verifierBytes);

    const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );

    return {
        verifier,
        challenge: base64url(hashBytes),
    };
}

function fetchAccessToken(verifier, challenge) {
    return new Promise((resolve, reject) => {
        const authUrl =
            "/o/oauth2/authorize?" +
            new URLSearchParams({
                response_type: "code",
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                code_challenge: challenge,
                code_challenge_method: "S256",
                scope: "",
            });

        const iframe = document.createElement("iframe");
        iframe.style.cssText =
            "display:none;width:0;height:0;border:none;position:absolute;";

        let handled = false;

        iframe.onload = async function () {
            if (handled) return;

            try {
                if (!iframe.contentWindow) return;

                let href;

                try {
                    href = iframe.contentWindow.location.href;
                } catch {
                    handled = true;
                    iframe.remove();
                    reject(new Error("Redirección cross-origin inesperada en OAuth2"));
                    return;
                }

                if (!href || href === "about:blank") return;

                handled = true;
                iframe.remove();

                const params = new URL(href).searchParams;
                const code = params.get("code");
                const error = params.get("error");

                if (error) {
                    reject(new Error("OAuth2: " + error));
                    return;
                }

                if (!code) {
                    reject(
                        new Error(
                            "No se recibió el código de autorización. El iframe llegó a: " +
                            href
                        )
                    );
                    return;
                }

                const resp = await fetch("/o/oauth2/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        grant_type: "authorization_code",
                        code,
                        redirect_uri: REDIRECT_URI,
                        client_id: CLIENT_ID,
                        code_verifier: verifier,
                    }),
                });

                const data = await resp.json();

                if (!resp.ok || data.error) {
                    reject(
                        new Error(
                            data.error_description || data.error || "Error al obtener token"
                        )
                    );
                    return;
                }

                resolve({
                    value: data.access_token,
                    expiresIn: data.expires_in || 600,
                });
            } catch (error) {
                iframe.remove();
                reject(error);
            }
        };

        document.body.appendChild(iframe);
        iframe.src = authUrl;
    });
}

window.obtenerTokenOAuth2 = async function () {
    const now = Date.now();

    if (cachedToken && cachedToken.expiresAt > now + 30000) {
        return cachedToken.value;
    }

    const { verifier, challenge } = await generatePKCE();

    const { value, expiresIn } = await fetchAccessToken(verifier, challenge);

    cachedToken = {
        value,
        expiresAt: now + expiresIn * 1000,
    };

    return value;
};

window.usuarioEsAdminNormateca = async function (intentos = 50) {
    const codigosAdministrador = ["normateca-admin-principal", "normateca-admin"];

    for (let i = 0; i < intentos; i++) {
        const userGroupsStorage = sessionStorage.getItem("userGroups");

        if (userGroupsStorage) {
            try {
                const userGroups = JSON.parse(userGroupsStorage);

                if (Array.isArray(userGroups) && userGroups.length > 0) {
                    return userGroups.some(function (grupo) {
                        const codigo = String(grupo?.codigo || "")
                            .trim()
                            .toLowerCase();

                        return codigosAdministrador.includes(codigo);
                    });
                }
            } catch (error) {
                console.error("No fue posible interpretar userGroups:", error);
            }
        }

        await new Promise(function (resolve) {
            setTimeout(resolve, 200);
        });
    }

    return false;
};

window.obtenerPermisoDocumentoNormateca = function (contenidoId) {
    try {
        const permisosStorage = sessionStorage.getItem("permisos");

        if (!permisosStorage) {
            return null;
        }

        const permisos = JSON.parse(permisosStorage);

        if (!Array.isArray(permisos)) {
            return null;
        }

        const idBuscado = String(contenidoId).trim();

        return (
            permisos.find(function (permiso) {
                return permiso && String(permiso.contenidoId).trim() === idBuscado;
            }) || null
        );
    } catch (error) {
        console.error(
            "[PERMISOS] No fue posible obtener el permiso del documento:",
            error
        );

        return null;
    }
};
window.obtenerRolNORMATECA = function () {
    const grupos = JSON.parse(sessionStorage.getItem("userGroups") || "[]");

    const rolesNORMATECA = {
        "Normateca Admin Principal": 3,
        "Normateca Admin": 2,
        "Normateca Lectura": 1,
    };

    const grupo = grupos.find((g) => rolesNORMATECA.hasOwnProperty(g.nombre));

    if (!grupo) {
        return null;
    }

    return {
        id: grupo.id,
        nombre: grupo.nombre,
        codigo: grupo.codigo,
        permisos: rolesNORMATECA[grupo.nombre],
    };
};
