const mongoose = require("mongoose");
const Bug = require("../models/bug");

/* ================= HELPERS ================= */

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (value === false) return value;

    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      if (value.trim() !== "") return value.trim();
      continue;
    }

    return value;
  }

  return undefined;
}

function toObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return fallback;
}

function truncate(value, max = 5000) {
  if (value === undefined || value === null) return value;
  const str = String(value);
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_e) {
    return value;
  }
}

function normalizeIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  return (
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null
  );
}

function parseUserAgent(userAgent) {
  const ua = String(userAgent || "");
  const uaLower = ua.toLowerCase();

  let browser = "Desconhecido";
  let os = "Desconhecido";
  let deviceType = "Desconhecido";

  if (uaLower.includes("edg/")) browser = "Edge";
  else if (uaLower.includes("opr/") || uaLower.includes("opera")) browser = "Opera";
  else if (uaLower.includes("chrome/") && !uaLower.includes("edg/")) browser = "Chrome";
  else if (uaLower.includes("safari/") && !uaLower.includes("chrome/")) browser = "Safari";
  else if (uaLower.includes("firefox/")) browser = "Firefox";
  else if (uaLower.includes("msie") || uaLower.includes("trident/")) browser = "Internet Explorer";

  if (uaLower.includes("windows nt")) os = "Windows";
  else if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad") || uaLower.includes("ios")) os = "iOS";
  else if (uaLower.includes("mac os x") || uaLower.includes("macintosh")) os = "macOS";
  else if (uaLower.includes("linux")) os = "Linux";

  if (uaLower.includes("mobile")) deviceType = "Mobile";
  else if (uaLower.includes("tablet") || uaLower.includes("ipad")) deviceType = "Tablet";
  else if (ua) deviceType = "Desktop";

  return { browser, os, deviceType };
}

function sanitizeBody(body) {
  const raw = safeClone(body);

  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const cloned = { ...raw };

  const sensitiveKeys = [
    "password",
    "senha",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "auth",
    "secret",
    "pin",
    "cpf",
    "cnpj",
    "cardNumber",
    "cvv",
  ];

  for (const key of Object.keys(cloned)) {
    if (sensitiveKeys.includes(String(key).toLowerCase())) {
      cloned[key] = "[REDACTED]";
    }
  }

  return cloned;
}

function buildMergedMeta(body = {}) {
  return {
    ...toObject(body.meta, {}),
    ...toObject(body.metadata, {}),
    ...toObject(body.context, {}),
    ...toObject(body.deviceInfo, {}),
    ...toObject(body.environment, {}),
    ...toObject(body.env, {}),
    ...toObject(body.extra, {}),
    ...toObject(body.payload?.meta, {}),
    ...toObject(body.payload?.metadata, {}),
    ...toObject(body.payload?.context, {}),
    ...toObject(body.payload?.deviceInfo, {}),
    ...toObject(body.payload?.environment, {}),
  };
}

function pickNested(obj, paths = []) {
  for (const path of paths) {
    const parts = String(path).split(".");
    let current = obj;

    let found = true;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }

    if (found) {
      const value = firstNonEmpty(current);
      if (value !== undefined) return value;
    }
  }

  return undefined;
}

function inferTitle(body, meta, req) {
  return firstNonEmpty(
    body?.title,
    body?.message,
    body?.error,
    body?.name,
    body?.description,
    body?.exceptionName,
    pickNested(body, [
      "error.message",
      "exception.message",
      "payload.title",
      "payload.message",
    ]),
    meta?.title,
    meta?.message,
    meta?.error,
    meta?.screen ? `Bug em ${meta.screen}` : undefined,
    meta?.route ? `Bug em ${meta.route}` : undefined,
    req.headers["x-screen-name"] ? `Bug em ${req.headers["x-screen-name"]}` : undefined,
    req.headers["x-route-name"] ? `Bug em ${req.headers["x-route-name"]}` : undefined,
    req.originalUrl ? `Bug reportado em ${req.originalUrl}` : undefined,
    "Bug sem título"
  );
}

function inferDescription(body, meta, req) {
  return firstNonEmpty(
    body?.description,
    body?.message,
    body?.errorMessage,
    body?.details,
    body?.reason,
    pickNested(body, [
      "error.message",
      "exception.message",
      "payload.description",
      "payload.details",
    ]),
    meta?.description,
    meta?.details,
    meta?.reason,
    meta?.route ? `Rota: ${meta.route}` : undefined,
    meta?.screen ? `Tela: ${meta.screen}` : undefined,
    req.originalUrl ? `Origem: ${req.originalUrl}` : undefined,
    "Sem descrição detalhada"
  );
}

function inferType(body, meta) {
  return firstNonEmpty(
    body?.type,
    body?.category,
    body?.errorType,
    body?.kind,
    body?.name,
    body?.exceptionName,
    pickNested(body, [
      "error.type",
      "error.name",
      "exception.name",
      "payload.type",
      "payload.category",
    ]),
    meta?.type,
    meta?.category,
    meta?.errorType,
    meta?.kind,
    meta?.exceptionName,
    body?.title
  );
}

function inferSource(body, meta, req) {
  return firstNonEmpty(
    body?.source,
    body?.origin,
    body?.module,
    body?.feature,
    body?.app,
    pickNested(body, [
      "payload.source",
      "payload.origin",
      "payload.module",
      "payload.feature",
    ]),
    meta?.source,
    meta?.origin,
    meta?.module,
    meta?.feature,
    req.headers["x-source"],
    req.headers["x-module"],
    req.headers["origin"],
    req.originalUrl
  );
}

function inferModule(body, meta, req) {
  return firstNonEmpty(
    body?.module,
    body?.feature,
    body?.contextModule,
    pickNested(body, [
      "payload.module",
      "payload.feature",
      "error.module",
      "context.module",
    ]),
    meta?.module,
    meta?.feature,
    meta?.contextModule,
    req.headers["x-module"]
  );
}

function inferScreen(body, meta, req) {
  return firstNonEmpty(
    body?.screen,
    body?.screenName,
    body?.currentScreen,
    pickNested(body, [
      "payload.screen",
      "payload.screenName",
      "payload.currentScreen",
      "context.screen",
      "context.currentScreen",
      "navigation.screen",
    ]),
    meta?.screen,
    meta?.screenName,
    meta?.routeName,
    meta?.currentScreen,
    req.headers["x-screen-name"],
    req.headers["x-screen"],
    req.headers["x-route-name"]
  );
}

function inferRoute(body, meta, req) {
  return firstNonEmpty(
    body?.route,
    body?.pathname,
    body?.path,
    body?.routeName,
    body?.currentRoute,
    pickNested(body, [
      "payload.route",
      "payload.pathname",
      "payload.path",
      "payload.routeName",
      "context.route",
      "context.pathname",
      "navigation.route",
    ]),
    meta?.route,
    meta?.pathname,
    meta?.path,
    meta?.routeName,
    req.headers["x-route-name"],
    req.headers["x-pathname"],
    req.headers["referer"],
    req.originalUrl
  );
}

function inferEndpoint(body, meta, req) {
  return firstNonEmpty(
    body?.endpoint,
    body?.url,
    body?.apiEndpoint,
    body?.requestUrl,
    pickNested(body, [
      "payload.endpoint",
      "payload.url",
      "request.url",
      "request.endpoint",
      "api.endpoint",
    ]),
    meta?.endpoint,
    meta?.url,
    req.originalUrl
  );
}

function inferUserContext(req, body, meta) {
  const bodyUser = toObject(body?.user, {});
  const payloadUser = toObject(body?.payload?.user, {});
  const metaUser = toObject(meta?.user, {});
  const metaCtx = toObject(meta?.userContext, {});

  return {
    id: firstNonEmpty(
      req.user?._id,
      bodyUser.id,
      bodyUser._id,
      payloadUser.id,
      payloadUser._id,
      metaUser.id,
      metaUser._id,
      metaCtx.id,
      metaCtx._id
    ),
    email: firstNonEmpty(
      req.user?.email,
      body?.userEmail,
      bodyUser.email,
      payloadUser.email,
      meta?.userEmail,
      metaUser.email,
      metaCtx.email
    ),
    name: firstNonEmpty(
      req.user?.name,
      body?.userName,
      bodyUser.name,
      bodyUser.fullName,
      payloadUser.name,
      payloadUser.fullName,
      meta?.userName,
      metaUser.name,
      metaUser.fullName,
      metaCtx.name,
      metaCtx.fullName
    ),
    role: firstNonEmpty(
      req.user?.role,
      body?.userRole,
      bodyUser.role,
      payloadUser.role,
      meta?.userRole,
      metaUser.role,
      metaCtx.role
    ),
  };
}

function buildRequest(req, body, normalized) {
  return {
    method: req.method,
    url: req.originalUrl,
    endpoint: normalized.endpoint,
    route: normalized.route,
    query: safeClone(req.query || {}),
    params: safeClone(req.params || {}),
    body: sanitizeBody(body),
    headers: {
      host: req.headers["host"],
      origin: req.headers["origin"],
      referer: req.headers["referer"],
      "user-agent": req.headers["user-agent"],
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "x-real-ip": req.headers["x-real-ip"],
      "x-platform": req.headers["x-platform"],
      "x-app-version": req.headers["x-app-version"],
      "x-build-number": req.headers["x-build-number"],
      "x-device": req.headers["x-device"],
      "x-os-version": req.headers["x-os-version"],
      "x-browser": req.headers["x-browser"],
      "x-screen-name": req.headers["x-screen-name"],
      "x-route-name": req.headers["x-route-name"],
      "x-module": req.headers["x-module"],
      "x-pathname": req.headers["x-pathname"],
      "accept-language": req.headers["accept-language"],
      "x-request-id": req.headers["x-request-id"],
      "x-correlation-id": req.headers["x-correlation-id"],
    },
    ip: normalized.ip,
    host: normalized.host,
    origin: normalized.origin,
    referer: normalized.referer,
    protocol: req.protocol,
    secure: req.secure,
  };
}

function buildMetadata(req, body, normalized, meta) {
  return {
    ...toObject(meta, {}),
    capturedAt: new Date(),
    title: normalized.title,
    description: normalized.description,
    type: normalized.type,
    source: normalized.source,
    module: normalized.module,
    screen: normalized.screen,
    route: normalized.route,
    endpoint: normalized.endpoint,
    method: normalized.method,
    url: normalized.url,
    ip: normalized.ip,
    host: normalized.host,
    origin: normalized.origin,
    referer: normalized.referer,
    userAgent: normalized.userAgent,
    browser: normalized.browser,
    os: normalized.os,
    osVersion: normalized.osVersion,
    device: normalized.device,
    deviceType: normalized.deviceType,
    deviceName: normalized.deviceName,
    appVersion: normalized.appVersion,
    buildNumber: normalized.buildNumber,
    platform: normalized.platform,
    manufacturer: normalized.manufacturer,
    model: normalized.model,
    requestId: normalized.requestId,
    userContext: normalized.userContext,
    code: normalized.code,
    errorCode: normalized.errorCode,
    exceptionName: normalized.exceptionName,
    functionName: normalized.functionName,
    fileName: normalized.fileName,
    lineNumber: normalized.lineNumber,
    columnNumber: normalized.columnNumber,
    raw: normalized.raw,
    log: normalized.log,
    payload: normalized.payload,
    occurrences: normalized.occurrences,
    firstSeen: normalized.firstSeen,
    lastSeen: normalized.lastSeen,
  };
}

function hydrateBug(bug) {
  const metadata = toObject(bug?.metadata, Object.keys(toObject(bug?.meta, {})).length ? bug.meta : {});
  const request = toObject(bug?.request, {});
  const response = toObject(bug?.response, {});

  const user = {
    id: firstNonEmpty(
      bug?.userId,
      bug?.user?.id,
      metadata?.userContext?.id,
      metadata?.user?.id
    ),
    email: firstNonEmpty(
      bug?.userEmail,
      bug?.user?.email,
      metadata?.userContext?.email,
      metadata?.user?.email
    ),
    name: firstNonEmpty(
      bug?.userName,
      bug?.user?.name,
      metadata?.userContext?.name,
      metadata?.user?.name
    ),
    role: firstNonEmpty(
      bug?.userRole,
      bug?.user?.role,
      metadata?.userContext?.role,
      metadata?.user?.role
    ),
  };

  return {
    ...bug,

    type: firstNonEmpty(
      bug?.type,
      metadata?.type,
      metadata?.errorType,
      metadata?.category
    ),

    source: firstNonEmpty(
      bug?.source,
      metadata?.source,
      metadata?.origin
    ),

    module: firstNonEmpty(
      bug?.module,
      metadata?.module,
      metadata?.feature,
      bug?.source
    ),

    screen: firstNonEmpty(
      bug?.screen,
      metadata?.screen,
      metadata?.screenName
    ),

    route: firstNonEmpty(
      bug?.route,
      metadata?.route,
      metadata?.pathname,
      request?.route
    ),

    endpoint: firstNonEmpty(
      bug?.endpoint,
      metadata?.endpoint,
      bug?.url,
      request?.endpoint,
      request?.url
    ),

    occurrences: firstNonEmpty(
      bug?.occurrences,
      metadata?.occurrences,
      1
    ),

    firstSeen: firstNonEmpty(
      bug?.firstSeen,
      metadata?.firstSeen,
      bug?.createdAt
    ),

    lastSeen: firstNonEmpty(
      bug?.lastSeen,
      metadata?.lastSeen,
      bug?.updatedAt
    ),

    appVersion: firstNonEmpty(
      bug?.appVersion,
      metadata?.appVersion
    ),

    buildNumber: firstNonEmpty(
      bug?.buildNumber,
      metadata?.buildNumber
    ),

    platform: firstNonEmpty(
      bug?.platform,
      metadata?.platform,
      metadata?.os
    ),

    os: firstNonEmpty(
      bug?.os,
      metadata?.os
    ),

    osVersion: firstNonEmpty(
      bug?.osVersion,
      metadata?.osVersion
    ),

    device: firstNonEmpty(
      bug?.device,
      metadata?.device,
      bug?.deviceName,
      metadata?.deviceName,
      bug?.deviceType,
      metadata?.deviceType
    ),

    manufacturer: firstNonEmpty(
      bug?.manufacturer,
      metadata?.manufacturer
    ),

    model: firstNonEmpty(
      bug?.model,
      metadata?.model,
      bug?.deviceName,
      metadata?.deviceName
    ),

    browser: firstNonEmpty(
      bug?.browser,
      metadata?.browser
    ),

    ip: firstNonEmpty(
      bug?.ip,
      metadata?.ip,
      request?.ip
    ),

    code: firstNonEmpty(
      bug?.code,
      bug?.errorCode,
      metadata?.code,
      metadata?.errorCode
    ),

    errorCode: firstNonEmpty(
      bug?.errorCode,
      bug?.code,
      metadata?.errorCode,
      metadata?.code
    ),

    exceptionName: firstNonEmpty(
      bug?.exceptionName,
      metadata?.exceptionName
    ),

    functionName: firstNonEmpty(
      bug?.functionName,
      metadata?.functionName
    ),

    fileName: firstNonEmpty(
      bug?.fileName,
      metadata?.fileName,
      metadata?.file
    ),

    lineNumber: firstNonEmpty(
      bug?.lineNumber,
      metadata?.lineNumber,
      metadata?.line
    ),

    columnNumber: firstNonEmpty(
      bug?.columnNumber,
      metadata?.columnNumber,
      metadata?.column
    ),

    message: firstNonEmpty(
      bug?.message,
      bug?.errorMessage,
      bug?.description,
      metadata?.message
    ),

    metadata,
    request,
    response,

    raw: firstNonEmpty(
      bug?.raw,
      metadata?.raw
    ),

    log: firstNonEmpty(
      bug?.log,
      metadata?.log
    ),

    payload: firstNonEmpty(
      bug?.payload,
      metadata?.payload
    ),

    user,
  };
}

/* ================= LIST ================= */

exports.list = async (req, res) => {
  try {
    const {
      status,
      userId,
      companyId,
      screen,
      appVersion,
      dateFrom,
      dateTo,
      q,
      limit = 200,
    } = req.query;

    const cond = {};

    if (status) cond.status = status;
    if (userId) cond.userId = userId;
    if (companyId) cond.companyId = companyId;

    if (screen) {
      cond.$or = [
        { screen },
        { "metadata.screen": screen },
        { "meta.screen": screen },
      ];
    }

    if (appVersion) cond.appVersion = appVersion;

    if (dateFrom || dateTo) cond.createdAt = {};
    if (dateFrom) cond.createdAt.$gte = new Date(dateFrom);
    if (dateTo) cond.createdAt.$lte = new Date(dateTo);

    if (q) {
      cond.$and = cond.$and || [];
      cond.$and.push({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
          { message: { $regex: q, $options: "i" } },
          { stack: { $regex: q, $options: "i" } },
          { source: { $regex: q, $options: "i" } },
          { screen: { $regex: q, $options: "i" } },
          { route: { $regex: q, $options: "i" } },
          { endpoint: { $regex: q, $options: "i" } },
          { type: { $regex: q, $options: "i" } },
          { browser: { $regex: q, $options: "i" } },
          { userAgent: { $regex: q, $options: "i" } },
          { userEmail: { $regex: q, $options: "i" } },
          { userName: { $regex: q, $options: "i" } },
          { "metadata.screen": { $regex: q, $options: "i" } },
          { "metadata.route": { $regex: q, $options: "i" } },
          { "metadata.source": { $regex: q, $options: "i" } },
          { "metadata.module": { $regex: q, $options: "i" } },
          { "metadata.browser": { $regex: q, $options: "i" } },
          { "metadata.userAgent": { $regex: q, $options: "i" } },
          { "meta.screen": { $regex: q, $options: "i" } },
          { "meta.route": { $regex: q, $options: "i" } },
          { "meta.source": { $regex: q, $options: "i" } },
          { "meta.module": { $regex: q, $options: "i" } },
        ],
      });
    }

    const items = await Bug.find(cond)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      items: items.map(hydrateBug),
    });
  } catch (e) {
    console.error("[bugs.list] erro", e);
    res.status(500).json({
      message: "Falha ao listar bugs",
    });
  }
};

/* ================= GET ================= */

exports.get = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    const bug = await Bug.findById(id).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado",
      });
    }

    const hydrated = hydrateBug(bug);

    res.json(hydrated);
  } catch (e) {
    console.error("[bugs.get] erro", e);
    res.status(500).json({
      message: "Falha ao obter bug",
    });
  }
};

/* ================= COUNT ================= */

exports.countOpen = async (_req, res) => {
  try {
    const count = await Bug.countDocuments({
      status: { $in: ["aberto", "triagem", "em_andamento"] },
    });

    res.json({ count });
  } catch (e) {
    console.error("[bugs.countOpen] erro", e);
    res.status(500).json({
      message: "Falha ao contar bugs",
    });
  }
};

/* ================= START ================= */

exports.start = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "em_andamento" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado",
      });
    }

    res.json(hydrateBug(bug));
  } catch (e) {
    console.error("[bugs.start] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug",
    });
  }
};

/* ================= RESOLVE ================= */

exports.resolve = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "resolvido" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado",
      });
    }

    res.json(hydrateBug(bug));
  } catch (e) {
    console.error("[bugs.resolve] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug",
    });
  }
};

/* ================= REOPEN ================= */

exports.reopen = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "aberto" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado",
      });
    }

    res.json(hydrateBug(bug));
  } catch (e) {
    console.error("[bugs.reopen] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug",
    });
  }
};

/* ================= LOGS ================= */

exports.logs = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    const bug = await Bug.findById(id).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado",
      });
    }

    const hydrated = hydrateBug(bug);

    res.json({
      stack: hydrated.stack || "Sem stack",
      context: hydrated.metadata || {},
      device: hydrated.device || "Desconhecido",
      platform: hydrated.platform || hydrated.os || "Desconhecido",
      version: hydrated.appVersion || "Desconhecida",
      browser: hydrated.browser || "Desconhecido",
      ip: hydrated.ip || "Desconhecido",
      method: hydrated.method || hydrated.request?.method || "Desconhecido",
      url: hydrated.endpoint || hydrated.url || hydrated.request?.url || "Desconhecido",
      userAgent: hydrated.userAgent || hydrated.metadata?.userAgent || "Desconhecido",
      firstSeen: hydrated.firstSeen || hydrated.createdAt,
      lastSeen: hydrated.lastSeen || hydrated.updatedAt,
      occurrences: hydrated.occurrences || 1,
    });
  } catch (e) {
    console.error("[bugs.logs] erro", e);
    res.status(500).json({
      message: "Falha ao obter logs",
    });
  }
};

/* ================= REPORT ================= */

exports.report = async (req, res) => {
  try {
    const body = req.body || {};
    const mergedMeta = buildMergedMeta(body);

    const userAgent = req.headers["user-agent"] || "";
    const uaInfo = parseUserAgent(userAgent);
    const now = new Date();

    const userContext = inferUserContext(req, body, mergedMeta);

    const title = truncate(inferTitle(body, mergedMeta, req), 300);
    const description = truncate(inferDescription(body, mergedMeta, req), 5000);

    const normalized = {
      title,
      description,

      severity: firstNonEmpty(
        body.severity,
        mergedMeta.severity,
        "médio"
      ),

      message: truncate(
        firstNonEmpty(
          body.message,
          body.errorMessage,
          body.description,
          body.details,
          pickNested(body, [
            "error.message",
            "exception.message",
            "payload.message",
            "payload.errorMessage",
          ]),
          mergedMeta.message,
          mergedMeta.errorMessage,
          description
        ),
        10000
      ),

      appVersion: firstNonEmpty(
        body.appVersion,
        body.version,
        mergedMeta.appVersion,
        mergedMeta.version,
        req.headers["x-app-version"],
        req.headers["x-client-version"]
      ),

      buildNumber: firstNonEmpty(
        body.buildNumber,
        mergedMeta.buildNumber,
        req.headers["x-build-number"]
      ),

      platform: firstNonEmpty(
        body.platform,
        mergedMeta.platform,
        req.headers["x-platform"],
        uaInfo.os
      ),

      os: firstNonEmpty(
        body.os,
        body.osName,
        mergedMeta.os,
        mergedMeta.osName,
        uaInfo.os
      ),

      osVersion: firstNonEmpty(
        body.osVersion,
        mergedMeta.osVersion,
        req.headers["x-os-version"]
      ),

      device: firstNonEmpty(
        body.device,
        body.deviceName,
        mergedMeta.device,
        mergedMeta.deviceName,
        req.headers["x-device"],
        uaInfo.deviceType
      ),

      deviceType: firstNonEmpty(
        body.deviceType,
        mergedMeta.deviceType,
        uaInfo.deviceType
      ),

      deviceName: firstNonEmpty(
        body.deviceName,
        body.device,
        mergedMeta.deviceName,
        mergedMeta.device,
        req.headers["x-device"]
      ),

      manufacturer: firstNonEmpty(
        body.manufacturer,
        mergedMeta.manufacturer,
        req.headers["x-device-manufacturer"]
      ),

      model: firstNonEmpty(
        body.model,
        mergedMeta.model,
        req.headers["x-device-model"]
      ),

      browser: firstNonEmpty(
        body.browser,
        mergedMeta.browser,
        req.headers["x-browser"],
        uaInfo.browser
      ),

      ip: normalizeIp(req),
      userAgent,

      method: req.method,
      url: req.originalUrl,

      route: inferRoute(body, mergedMeta, req),
      endpoint: inferEndpoint(body, mergedMeta, req),

      host: req.headers["host"],
      origin: req.headers["origin"],
      referer: req.headers["referer"],

      requestId: firstNonEmpty(
        req.headers["x-request-id"],
        req.headers["x-correlation-id"],
        mergedMeta.requestId
      ),

      source: inferSource(body, mergedMeta, req),
      module: inferModule(body, mergedMeta, req),
      screen: inferScreen(body, mergedMeta, req),
      type: inferType(body, mergedMeta),

      occurrences: Number(
        firstNonEmpty(body.occurrences, mergedMeta.occurrences, 1)
      ) || 1,

      firstSeen: firstNonEmpty(
        body.firstSeen,
        mergedMeta.firstSeen,
        now
      ),

      lastSeen: firstNonEmpty(
        body.lastSeen,
        mergedMeta.lastSeen,
        now
      ),

      stack: truncate(
        firstNonEmpty(
          body.stack,
          body.stackTrace,
          pickNested(body, [
            "error.stack",
            "exception.stack",
            "payload.stack",
            "payload.stackTrace",
          ]),
          mergedMeta.stack,
          mergedMeta.stackTrace
        ),
        20000
      ),

      code: firstNonEmpty(
        body.code,
        body.errorCode,
        pickNested(body, ["error.code", "exception.code"]),
        mergedMeta.code,
        mergedMeta.errorCode
      ),

      errorCode: firstNonEmpty(
        body.errorCode,
        body.code,
        pickNested(body, ["error.code", "exception.code"]),
        mergedMeta.errorCode,
        mergedMeta.code
      ),

      exceptionName: firstNonEmpty(
        body.exceptionName,
        body.errorName,
        body.name,
        pickNested(body, [
          "error.name",
          "exception.name",
        ]),
        mergedMeta.exceptionName,
        mergedMeta.errorName
      ),

      functionName: firstNonEmpty(
        body.functionName,
        pickNested(body, ["error.functionName", "exception.functionName"]),
        mergedMeta.functionName
      ),

      fileName: firstNonEmpty(
        body.fileName,
        body.file,
        pickNested(body, ["error.fileName", "exception.fileName"]),
        mergedMeta.fileName,
        mergedMeta.file
      ),

      lineNumber: firstNonEmpty(
        body.lineNumber,
        body.line,
        pickNested(body, ["error.lineNumber", "exception.lineNumber"]),
        mergedMeta.lineNumber,
        mergedMeta.line
      ),

      columnNumber: firstNonEmpty(
        body.columnNumber,
        body.column,
        pickNested(body, ["error.columnNumber", "exception.columnNumber"]),
        mergedMeta.columnNumber,
        mergedMeta.column
      ),

      raw: firstNonEmpty(
        body.raw,
        body.logRaw,
        mergedMeta.raw
      ),

      log: firstNonEmpty(
        body.log,
        body.logs,
        mergedMeta.log
      ),

      payload: firstNonEmpty(
        body.payload,
        mergedMeta.payload,
        body
      ),

      userContext,
    };

    if (!normalized.title) {
      return res.status(400).json({
        message: "title é obrigatório",
      });
    }

    const request = buildRequest(req, body, normalized);
    const response = toObject(body.response, {});
    const metadata = buildMetadata(req, body, normalized, mergedMeta);

    const doc = new Bug({
      title: normalized.title,
      description: normalized.description,
      message: normalized.message,

      severity: normalized.severity,

      appVersion: normalized.appVersion,
      buildNumber: normalized.buildNumber,

      platform: normalized.platform,
      os: normalized.os,
      osVersion: normalized.osVersion,

      device: normalized.device,
      deviceType: normalized.deviceType,
      deviceName: normalized.deviceName,

      manufacturer: normalized.manufacturer,
      model: normalized.model,

      browser: normalized.browser,
      ip: normalized.ip,
      userAgent: normalized.userAgent,

      source: normalized.source,
      screen: normalized.screen,
      route: normalized.route,
      endpoint: normalized.endpoint,
      type: normalized.type,

      method: normalized.method,
      url: normalized.url,
      host: normalized.host,
      origin: normalized.origin,
      referer: normalized.referer,

      request,
      response,
      headers: request.headers,

      occurrences: normalized.occurrences,
      firstSeen: normalized.firstSeen,
      lastSeen: normalized.lastSeen,

      stack: normalized.stack,
      code: normalized.code,
      errorCode: normalized.errorCode,
      exceptionName: normalized.exceptionName,
      functionName: normalized.functionName,
      fileName: normalized.fileName,
      lineNumber: normalized.lineNumber,
      columnNumber: normalized.columnNumber,

      raw: normalized.raw,
      log: normalized.log,
      payload: normalized.payload,

      userEmail: normalized.userContext.email || undefined,
      userName: normalized.userContext.name || undefined,
      userRole: normalized.userContext.role || undefined,

      metadata: {
        ...metadata,
        module: normalized.module,
      },
      meta: {
        ...metadata,
        module: normalized.module,
      },
    });

    if (normalized.userContext.id && mongoose.Types.ObjectId.isValid(String(normalized.userContext.id))) {
      const role = String(normalized.userContext.role || "").toLowerCase();

      if (role === "empresa") {
        doc.companyId = normalized.userContext.id;
      } else {
        doc.userId = normalized.userContext.id;
      }
    }

    const saved = await doc.save();

    res.status(201).json(hydrateBug(saved.toObject ? saved.toObject() : saved));
  } catch (e) {
    console.error("[bugs.report] erro", e);
    res.status(500).json({
      message: "Falha ao reportar bug",
    });
  }
};