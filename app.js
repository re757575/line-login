const Koa = require('koa');
const views = require('koa-views');
const Router = require('koa-router');
const logger = require('koa-logger');
const request = require('request-promise');
const line = require('./config.json').line;

const app = new Koa();
const router = new Router();

app.use(views(__dirname + '/views-ejs', {
  extension: 'ejs'
}));

const client_id = line.clientId;
const client_secret = line.clientSecret;
const redirect_uri = line.redirectUri;
const grant_type = 'authorization_code';

const access_token_url = 'https://api.line.me/v2/oauth/accessToken';
const get_profile_url = 'https://api.line.me/v2/profile';
const verify_url = 'https://api.line.me/v2/oauth/verify';
const revoke_url = 'https://api.line.me/v2/oauth/revoke';

let userName = ''
let userImg = '';
let access_token = '';
let refresh_token = '';

/**
 * show token info
 *
 */
function showTokenInfo() {
  console.log('--------------- showTokenInfo ---------------');
  console.log('access_token: ', access_token);
  console.log('refresh_token: ', refresh_token);
  console.log('userName: ', userName);
  console.log('userImg: ', userImg);
  console.log('----------------------------------------------');
}

/**
 * verify token
 *
 * @param {any} token
 * @returns
 */
async function verifyToken(token) {
  console.log('----------------- verifyToken -----------------');

  const postData = {
    access_token: token
  };

  try {
    let body = await request.post(verify_url, {
      form: postData
    });
    console.log('token 驗證成功');

    return true;
  } catch (err) {
    console.log('token 驗證失效');

    return false;
  }
}

/**
 * get user profile
 *
 * @param {any} token
 */
async function getProfile(token) {

  console.log('----------------- getProfile -----------------');

  const options = {
    uri: get_profile_url,
    headers: {
      'User-Agent': 'Request-Promise',
      'Authorization': `Bearer ${access_token}`
    }
  };

  try {
    let body = await request(options);
    let json = JSON.parse(body);
    userName = json.displayName;
    userImg = json.pictureUrl;

    return true;
  } catch (err) {
    console.log(err);

    return false;
  }
}

router.get('/', async function (ctx, next) {
  ctx.type = 'html';

  showTokenInfo();

  const times = new Date().getTime();
  const oauth_url = `https://access.line.me/dialog/oauth/weblogin?
		response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&state=${times}`;

  let html = '';
  if (access_token && await verifyToken(access_token)) {
    html = `<html><body>
			<p>登入成功</p>
			name: ${userName}</br>
			<img src='${userImg}'></br>
			<a href="/revoke">Revoking tokens</a>
		</body></html>`;
  } else {
    html = `<html><body>
			<a href='${oauth_url}'>line login</a>
		</body></html>`
  }

  await ctx.render('index', {
    oauth_url: oauth_url,
    html: html
  });

  await next();
});

// 撤銷 token
router.get('/revoke', async function (ctx, next) {

  showTokenInfo();

  const postData = {
    refresh_token: refresh_token
  };

  try {
    let body = await request.post(revoke_url, {
      form: postData
    });
    ctx.redirect('/');
  } catch (err) {
    ctx.body = err.message;
  }
});

// line login
router.get('/auth', async function (ctx, next) {

  console.log('query string: ', ctx.query);

  showTokenInfo();
  const code = ctx.query.code;
  const state = ctx.query.state;

  const postData = {
    grant_type: grant_type,
    code: code,
    client_id: client_id,
    client_secret: client_secret,
    redirect_uri: redirect_uri
  };

  try {
    // get access token
    let body = await request.post(access_token_url, {
      form: postData
    }, function (error, response, body) {});

    let json = JSON.parse(body);
    access_token = json.access_token;
    refresh_token = json.refresh_token;

    // get profile
    if (await getProfile()) {
      ctx.status = 301;
      ctx.redirect('/');
    } else {
      ctx.body = 'get profile error';
    }

  } catch (err) {
    ctx.body = err.message;
    console.log('Get an error:', err.message);
  }
});

app
  .use(logger())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(async(ctx, next) => {
    if ('404' == ctx.status) {
      ctx.status = 404;
      ctx.body = 'page not found';
      await next();
    }
  })
  .listen(3000, () => {
    console.info('server start on http://127.0.0.1:3000');
    showTokenInfo();
  });
