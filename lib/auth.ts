import type { CmsAuthResponse } from './types';
import { AUTH_HEADERS, DEVICE, ROUTES } from './constants';

const HEADERS = { ...AUTH_HEADERS };

const fetchProductionSecret = async () => {
  const text = await fetch(ROUTES.bundle).then((res) => res.text());
  const tokens = text.match(/prod="([\w-]+:[\w-]+)"/);
  if (!tokens) {
    console.error('Failed to find production secret');
    return null;
  }
  const [id, secret] = tokens[1].split(':');
  return { id, secret };
};

const fetchAppCredentials = async () => {
  const url = 'https://raw.githubusercontent.com/vitalygashkov/crextractor/refs/heads/main/credentials.tv.json';
  const credentials = await fetch(url)
    .then((response) => response.json())
    .catch(() => null);
  return credentials;
};

export const updateAuthorizationHeader = async () => {
  const credentials = await fetchAppCredentials();
  if (!credentials?.authorization) return;
  HEADERS.Authorization = credentials.authorization;
};

const buildRequestOptions = (params: Record<string, string>) => {
  return { method: 'POST', body: new URLSearchParams(params).toString(), headers: HEADERS };
};

const promptCredentials = async () => {
  const { username, password } = await Azot.prompt({
    fields: {
      username: { label: 'Username' },
      password: { label: 'Password' },
    },
  });
  return { username, password };
};

const fetchCmsAuth = async (accessToken: string) => {
  const requestOptions = { method: 'GET', headers: { authorization: `Bearer ${accessToken}` } };
  const response = await fetch(ROUTES.index, requestOptions);
  if (response.status !== 200) {
    console.error(`Can't get CMS token. Status code: ${response.status}`);
    console.debug(await response.text());
    return;
  }
  return (await response.json()) as CmsAuthResponse;
};

const checkToken = () => {
  const TIME_MARGIN = 60000;
  const hasToken =
    !!localStorage.getItem('accessToken') &&
    !!localStorage.getItem('refreshToken') &&
    !!localStorage.getItem('cmsAuth');
  const isTokenExpired = hasToken && Number(localStorage.getItem('expires')) - TIME_MARGIN < new Date().getTime();
  return { hasToken, isTokenExpired };
};

const fetchToken = async (params: Record<string, string>) => {
  try {
    const deviceName = localStorage.getItem('deviceName') || DEVICE.name;
    const deviceId = localStorage.getItem('deviceId') || DEVICE.id;
    const deviceType = localStorage.getItem('deviceType') || DEVICE.type;
    const options = buildRequestOptions({
      ...params,
      scope: 'offline_access',
      device_name: deviceName,
      device_id: deviceId,
      device_type: deviceType,
    });
    const response = await fetch(ROUTES.token, options);
    const auth: any = await response.json();
    const error = auth.error || response.status !== 200;
    if (error) {
      console.error(`Can't get token. Status code: ${response.status}. Message: ${auth.error}.`);
      console.debug(JSON.stringify(auth));
      await signOut();
    } else {
      const cmsAuth = await fetchCmsAuth(auth.access_token);
      localStorage.setItem('accessToken', auth.access_token);
      localStorage.setItem('refreshToken', auth.refresh_token);
      localStorage.setItem('expires', String(new Date().getTime() + auth.expires_in * 1000));
      localStorage.setItem('tokenType', auth.token_type);
      localStorage.setItem('scope', auth.scope);
      localStorage.setItem('country', auth.country);
      localStorage.setItem('accountId', auth.account_id);
      localStorage.setItem('cmsAuth', JSON.stringify(cmsAuth));
      localStorage.setItem('deviceName', deviceName);
      localStorage.setItem('deviceId', deviceId);
      localStorage.setItem('deviceType', deviceType);
    }
  } catch (e: any) {
    console.debug(`Auth failed: ${e.message}`);
  }
};

const fetchAccessToken = (username: string, password: string) => {
  return fetchToken({ grant_type: 'password', username, password });
};

const fetchRefreshToken = (refreshToken: string) => {
  return fetchToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
};

export const signIn = async (username?: string, password?: string) => {
  const { hasToken, isTokenExpired } = checkToken();
  if (!hasToken) {
    localStorage.removeItem('deviceName');
    localStorage.removeItem('deviceId');
    localStorage.removeItem('deviceType');
    console.debug(`Requesting credentials`);
    const credentials = username && password ? { username, password } : await promptCredentials();
    console.debug(`Requesting token`);
    await fetchAccessToken(credentials.username, credentials.password);
  } else if (isTokenExpired) {
    console.debug(`Refreshing token`);
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) await fetchRefreshToken(refreshToken);
  }
};

export const signOut = async () => {
  localStorage.clear();
};
