const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, code, redirect_uri, waba_id, phone_number_id, client_name } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const update = { updated_at: new Date().toISOString() };

  if (client_name) update.client_name = client_name;
  if (waba_id) update.waba_id = waba_id;
  if (phone_number_id) update.phone_number_id = phone_number_id;

  if (code) {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ error: 'Missing META_APP_ID or META_APP_SECRET env vars' });
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirect_uri || ''
    });

    const tokenResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`, {
      method: 'POST'
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData });
    }

    update.access_token = tokenData.access_token;
  }

  await kv.hset(`signup:${sessionId}`, update);

  if (phone_number_id) {
    await kv.set(`phone:${phone_number_id}`, sessionId);
  }

  return res.status(200).json({ ok: true });
};
