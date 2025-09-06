import type { Cms } from './types';
import { PLAY_PLATFORMS, ROUTES, USER_AGENT } from './constants';

const request = async (url: string, method: string = 'GET') => {
  console.debug(`Getting data from ${url}...`);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      'User-Agent': USER_AGENT,
    },
  });
  const data = (await response.text()) || '';
  response.status === 401 && console.error(`Unauthorized: ${url}`);
  response.status === 400 && console.error(`Bad Request: ${url}`);
  const isSuccess = response.status === 200;
  if (!isSuccess) console.debug(`Request failed. Route: ${url}. ${data}`);
  try {
    return data ? JSON.parse(data) : data;
  } catch (e) {
    console.debug(data);
    console.debug(e as any);
    console.error(`Parsing JSON response failed. Route: ${url}`);
    process.exit(1);
  }
};

export const getCms = () => {
  const cmsAuth = localStorage.getItem('cmsAuth');
  if (!cmsAuth) return {} as Cms;
  return JSON.parse(cmsAuth).cms as Cms;
};

const getSign = (cms = getCms()) => ({
  Policy: cms.policy,
  Signature: cms.signature,
  'Key-Pair-Id': cms.key_pair_id,
});

const sign = (params: Record<string, string> = {}) => new URLSearchParams({ ...params, ...getSign() }).toString();

const DEFAULT_DUB = 'ja-JP';
const preferDub = (language: string = DEFAULT_DUB) => ({ preferred_audio_language: language });

export const fetchMe = async () => {
  return request(ROUTES.me);
};

export const fetchProfile = async () => {
  return request(ROUTES.profile);
};

export const fetchSubscriptionBenefits = async (subscriptionId: string) => {
  return request(ROUTES.subscriptionBenefits.replace('{subscriptionId}', subscriptionId));
};

export const fetchPlayback = async (
  id: string | number,
  platform: string = PLAY_PLATFORMS.androidtv,
  purpose: 'play' | 'download' = 'play'
) => {
  return request(`${ROUTES.playback}/${id}/${platform}/${purpose}`);
};

export const fetchPlayData = async (id: string | number, platform: string = PLAY_PLATFORMS.androidtv) => {
  return request(`${ROUTES.play}/${id}/${platform}/play`);
};

export const revokePlayData = async (id: string | number, token: string) => {
  return request(`${ROUTES.play}/token/${id}/${token}`, 'DELETE');
};

export const fetchObject = async (objectId: string | number) => {
  return request(`${ROUTES.cms}${getCms().bucket}/objects/${objectId}?${sign()}`);
};

export const fetchStreams = async (videoId: string) => {
  return request(`${ROUTES.cms}${getCms().bucket}/videos/${videoId}/streams?${sign()}`);
};

export const fetchSeries = async (seriesId: string, dub?: string) => {
  return request(`${ROUTES.contentCms}/series/${seriesId}?${sign(preferDub(dub))}`);
};

export const fetchSeriesSeasons = async (seriesId: string, dub?: string) => {
  return request(`${ROUTES.contentCms}/series/${seriesId}/seasons?${sign(preferDub(dub))}`);
};

export const fetchSeason = async (seasonId: string, dub?: string) => {
  return request(`${ROUTES.contentCms}/seasons/${seasonId}?${sign(preferDub(dub))}`);
};

export const fetchEpisodes = async (seasonId: string) => {
  return request(`${ROUTES.cms}${getCms().bucket}/episodes?${sign({ season_id: seasonId })}`);
};
