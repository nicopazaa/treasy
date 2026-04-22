const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const FETCH_TIMEOUT_MS = 10000;

async function fetchJsonWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const code = event.queryStringParameters && event.queryStringParameters.code;
    if (!code) {
      return { statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: 'Missing code' }) };
    }

    const clientId = process.env.GITHUB_CLIENT_ID || process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'GitHub OAuth is not configured (missing env vars).' }),
      };
    }

    const tokenResponse = await fetchJsonWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const tokenRes = tokenResponse.res;
    const tokenData = tokenResponse.data;

    const accessToken = tokenData && tokenData.access_token;

    if (!tokenRes.ok || !accessToken) {
      return {
        statusCode: 502,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Token exchange failed' }),
      };
    }

    const userResponse = await fetchJsonWithTimeout('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'treasy',
        Accept: 'application/vnd.github+json',
      },
    });
    const userRes = userResponse.res;
    const user = userResponse.data;
    if (!userRes.ok || !user) {
      return {
        statusCode: 502,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'Failed to fetch GitHub user' }),
      };
    }

    let email = user && user.email;
    if (!email) {
      const emailsResponse = await fetchJsonWithTimeout('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'treasy',
          Accept: 'application/vnd.github+json',
        },
      });
      const emailsRes = emailsResponse.res;
      const emails = emailsResponse.data;
      if (Array.isArray(emails)) {
        const primary = emails.find((e) => e && e.primary) || emails[0];
        email = primary && primary.email;
      } else if (!emailsRes.ok) {
        return {
          statusCode: 502,
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ error: 'Failed to fetch GitHub email' }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        login: user && user.login ? String(user.login) : null,
        name: user && user.name ? String(user.name) : null,
        email: email ? String(email) : null,
      }),
    };
  } catch (e) {
    const message = e && e.name === 'AbortError' ? 'GitHub OAuth timed out' : 'GitHub OAuth failed';
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
