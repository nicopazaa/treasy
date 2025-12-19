const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

exports.handler = async (event) => {
  try {
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

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
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

    const tokenData = await tokenRes.json();
    const accessToken = tokenData && tokenData.access_token;

    if (!accessToken) {
      return {
        statusCode: 502,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ error: 'No access token returned from GitHub', details: tokenData }),
      };
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'treasy',
        Accept: 'application/vnd.github+json',
      },
    });
    const user = await userRes.json();

    let email = user && user.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'treasy',
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e) => e && e.primary) || emails[0];
        email = primary && primary.email;
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
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: 'GitHub OAuth failed', details: String(e && e.message ? e.message : e) }),
    };
  }
};

