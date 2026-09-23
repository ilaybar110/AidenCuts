// Runs on Netlify's servers only — never sent to the browser, never
// committed to GitHub, so GitHub's secret scanner never sees it and
// can never revoke it. The actual token lives only in Netlify's
// Environment variables (Site configuration -> Environment variables).

const GH_OWNER  = 'ilaybar110';
const GH_REPO   = 'AidenCuts';
const GH_BRANCH = 'main';
const GH_PATH   = 'config.json';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.GH_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing the GH_TOKEN environment variable' }) };
  }

  let newConfig;
  try {
    newConfig = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const api = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'aidencuts-manager-hub'
  };

  try {
    const getRes = await fetch(api + '?ref=' + GH_BRANCH, { headers });
    if (!getRes.ok) {
      return { statusCode: getRes.status, body: JSON.stringify({ error: 'Could not read current config (HTTP ' + getRes.status + ')' }) };
    }
    const current = await getRes.json();

    const json = JSON.stringify(newConfig, null, 2);
    const content = Buffer.from(json, 'utf8').toString('base64');

    const putRes = await fetch(api, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        message: 'Update site settings via manager hub',
        content: content,
        sha: current.sha,
        branch: GH_BRANCH
      })
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(function () { return {}; });
      return { statusCode: putRes.status, body: JSON.stringify({ error: errBody.message || ('GitHub save failed (HTTP ' + putRes.status + ')') }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
