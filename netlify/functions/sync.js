const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const FETCH_TIMEOUT_MS = 12000;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function parseJsonBody(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBearerToken(headers) {
  const raw = headers?.authorization || headers?.Authorization;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

async function fetchJsonWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const rawText = await res.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    return { res, data, rawText };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeEvents(value) {
  if (!Array.isArray(value)) {
    throw createError(400, 'Request body must include an events array');
  }
  if (value.length === 0) {
    return [];
  }

  const normalized = value.map((event, index) => {
    if (!isRecord(event)) {
      throw createError(400, `Event at index ${index} must be an object`);
    }

    const id = typeof event.id === 'string' ? event.id.trim() : '';
    const entityType = typeof event.entityType === 'string' ? event.entityType.trim() : '';
    const entityId = typeof event.entityId === 'string' ? event.entityId.trim() : '';
    const clientId = typeof event.clientId === 'string' ? event.clientId.trim() : '';
    const operation = typeof event.operation === 'string' ? event.operation.trim() : '';
    const changedAt = typeof event.changedAt === 'string' ? event.changedAt.trim() : '';
    const version = Number.isInteger(event.version) ? event.version : Number.parseInt(String(event.version ?? ''), 10);

    if (!id || !entityType || !entityId || !clientId || !operation || !changedAt || !Number.isInteger(version) || version < 1) {
      throw createError(400, `Event at index ${index} is missing required sync fields`);
    }

    if (operation !== 'upsert' && operation !== 'delete') {
      throw createError(400, `Event ${id} has unsupported operation "${operation}"`);
    }

    if (operation === 'upsert' && !isRecord(event.entity)) {
      throw createError(400, `Upsert event ${id} must include an entity payload`);
    }

    if (operation === 'delete') {
      const deletedAt = typeof event.deletedAt === 'string' ? event.deletedAt.trim() : '';
      if (!deletedAt) {
        throw createError(400, `Delete event ${id} must include deletedAt`);
      }
    }

    return {
      id,
      entityType,
      entityId,
      clientId,
      operation,
      version,
      changedAt,
      entity: operation === 'upsert' ? event.entity : null,
      deletedAt: operation === 'delete' ? String(event.deletedAt).trim() : null,
    };
  });

  const entityPriority = {
    exercise: 0,
    set: 1,
    cardio: 2,
    log: 3,
    note: 4,
  };

  normalized.sort((left, right) => {
    if (left.changedAt !== right.changedAt) {
      return left.changedAt < right.changedAt ? -1 : 1;
    }

    if (left.operation !== right.operation) {
      return left.operation === 'upsert' ? -1 : 1;
    }

    const priorityDelta =
      (entityPriority[left.entityType] ?? Number.MAX_SAFE_INTEGER) -
      (entityPriority[right.entityType] ?? Number.MAX_SAFE_INTEGER);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  return normalized;
}

async function fetchSupabaseUser({ bearerToken, publishableKey, supabaseUrl }) {
  const { res, data } = await fetchJsonWithTimeout(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!res.ok || !isRecord(data) || typeof data.id !== 'string' || !data.id.trim()) {
    throw createError(401, 'Supabase bearer token is missing or invalid');
  }

  return {
    id: data.id.trim(),
    email: typeof data.email === 'string' ? data.email.trim() || null : null,
  };
}

async function applySyncBatch({ events, serviceRoleKey, supabaseUrl, userId }) {
  const { res, data, rawText } = await fetchJsonWithTimeout(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/apply_sync_batch`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_events: events,
      }),
    }
  );

  if (!res.ok) {
    const detail =
      isRecord(data) && typeof data.message === 'string'
        ? data.message.trim()
        : rawText && rawText.trim()
          ? rawText.trim()
          : `Supabase RPC failed with status ${res.status}`;
    throw createError(502, detail);
  }

  if (!Array.isArray(data)) {
    throw createError(502, 'Supabase RPC returned an invalid response shape');
  }

  const acknowledgedEventIds = data
    .filter((row) => isRecord(row) && row.acknowledged === true && typeof row.event_id === 'string')
    .map((row) => row.event_id.trim())
    .filter((value) => value.length > 0);

  return {
    acknowledgedEventIds,
    results: data,
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const supabaseUrl = readEnv('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
    const publishableKey = readEnv('SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          error: 'Sync backend is not configured (missing Supabase env vars).',
        }),
      };
    }

    const bearerToken = normalizeBearerToken(event.headers);
    if (!bearerToken) {
      return {
        statusCode: 401,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Missing Authorization bearer token' }),
      };
    }

    const body = parseJsonBody(event.body);
    if (!isRecord(body)) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Request body must be valid JSON' }),
      };
    }

    if (body.schemaVersion !== 1) {
      return {
        statusCode: 400,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Unsupported schemaVersion' }),
      };
    }

    const events = normalizeEvents(body.events);
    const authUser = await fetchSupabaseUser({
      bearerToken,
      publishableKey,
      supabaseUrl,
    });

    const requestedUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (requestedUserId && requestedUserId !== authUser.id) {
      return {
        statusCode: 403,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Authenticated user does not match sync payload userId' }),
      };
    }

    if (events.length === 0) {
      return {
        statusCode: 200,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          acknowledgedEventIds: [],
          receivedEventCount: 0,
          userId: authUser.id,
        }),
      };
    }

    const syncResult = await applySyncBatch({
      events,
      serviceRoleKey,
      supabaseUrl,
      userId: authUser.id,
    });

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        acknowledgedEventIds: syncResult.acknowledgedEventIds,
        receivedEventCount: events.length,
        userId: authUser.id,
      }),
    };
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Sync backend request timed out'
          : error.message || 'Sync backend failed'
        : 'Sync backend failed';

    return {
      statusCode,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
