export const createBasicToken = (clientId: string, clientSecret: string) =>
  Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

export const CLIENT = { id: 'pug0n7ymuaolkkgi3lbj', secret: 'XikisaCaXFYBcXqoOlkST1h6oZXlwDJN' };

export const USER_AGENT = 'Crunchyroll/ANDROIDTV/3.45.0_22272 (Android 16; en-US; sdk_gphone64_x86_64)';

export const AUTH_HEADERS = {
  Authorization: `Basic ${createBasicToken(CLIENT.id, CLIENT.secret)}`,
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'User-Agent': USER_AGENT,
};

export const DEVICE = {
  id: crypto.randomUUID(),
  name: 'iPhone',
  type: 'iPhone 13',
};

export const PLAY_PLATFORMS = {
  chrome: 'web/chrome',
  firefox: 'web/firefox',
  safari: 'web/safari',
  edge: 'web/edge',
  fallback: 'web/fallback',
  ps4: 'console/ps4',
  ps5: 'console/ps5',
  switch: 'console/switch',
  xboxone: 'console/xbox_one',
  vidaa: 'tv/vidaa',
  samsungtv: 'tv/samsung',
  lgtv: 'tv/lg',
  rokutv: 'tv/roku',
  android: 'android/phone',
  androidtablet: 'android/tablet',
  androidtv: 'tv/android_tv',
  iphone: 'ios/iphone',
  ipad: 'ios/ipad',
  vision: 'ios/vision',
};

export const DOMAINS = {
  www: 'https://www.crunchyroll.com',
  api: 'https://api.crunchyroll.com',
  beta: 'https://beta.crunchyroll.com',
  betaApi: 'https://beta-api.crunchyroll.com',
  proto: 'https://beta-api.etp-proto0.com',
  staging: 'https://beta-stage-api.crunchyroll.com',
  play: 'https://cr-play-service.prd.crunchyrollsvc.com',
  static: 'https://static.crunchyroll.com',
};

export const ROUTES = {
  rss: `${DOMAINS.www}/rss/anime`,
  token: `${DOMAINS.betaApi}/auth/v1/token`,
  cms: `${DOMAINS.betaApi}/cms/v2`,
  index: `${DOMAINS.betaApi}/index/v2`,
  contentCms: `${DOMAINS.betaApi}/content/v2/cms`,
  me: `${DOMAINS.www}/accounts/v1/me`,
  profile: `${DOMAINS.betaApi}/accounts/v1/me/profile`,
  subscriptionBenefits: `${DOMAINS.www}/subs/v1/subscriptions/{subscriptionId}/benefits`,
  playback: `${DOMAINS.www}/playback/v3`,
  play: `${DOMAINS.play}/v3`,
  bundle: `${DOMAINS.static}/vilos-v2/web/vilos/js/bundle.js`,
  drm: `${DOMAINS.betaApi}/drm/v1/auth`, // broken - deprecated since 06.05.2025
  widevine: `${DOMAINS.www}/license/v1/license/widevine`,
  playready: `${DOMAINS.www}/license/v1/license/playReady`, // playready endpoint currently broken
};
