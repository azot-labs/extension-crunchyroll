import { defineExtension, utils, Input, UrlSource, type Options, type MediaEntry } from "azot";
import { PLAY_PLATFORMS, ROUTES, USER_AGENT } from "./lib/constants";
import { signIn, signOut, updateAuthorizationHeader } from "./lib/auth";
import {
  fetchEpisodes,
  fetchObject,
  fetchPlayback,
  fetchPlayData,
  fetchSeriesSeasons,
  getCms,
  revokePlayData,
} from "./lib/api";

type SharedContext = {
  contentId?: string;
  language?: string;
  drmConfig?: {
    server?: string;
    headers?: Record<string, string>;
  };
};

const sanitizeString = (value: string) => {
  return value?.replace(/[&/\\#,+()$~%.'":*?<>{}]/g, "");
};

const filterSeasonVersionsByAudio = (versions: any, selectedAudioLangs: string[] = []) => {
  const matchLang = (version: any) =>
    selectedAudioLangs.some((lang) => version.audio_locale.startsWith(lang));
  const matchOriginal = (version: any) => !!version.original;
  return selectedAudioLangs.length
    ? versions.find(matchLang)
    : versions.find(matchOriginal) || versions[0];
};

const getAudioLocales = (versions: any) =>
  versions
    .map((v: any) => v.audio_locale)
    .join(", ")
    .trim();

const getEpisodeMetadata = async (episodeId: string) => {
  const object = await fetchObject(episodeId);
  const isError = object.__class__ === "error";
  if (isError) {
    const response = await fetch("https://api.country.is").catch(() => null);
    const { ip, country } = ((await response?.json()) ?? {}) as { ip?: string; country?: string };
    console.info(`IP: ${ip}. Country: ${country}`);
    throw new Error(`Episode ${episodeId} not found. Code: ${object.code}. Type: ${object.type}. `);
  }

  const episode = object.items[0];
  const rawMetadata = episode.episode_metadata;
  const isMovie = !rawMetadata.episode_number;

  return {
    type: isMovie ? ("movie" as const) : ("episode" as const),
    id: episode.id,
    title: sanitizeString(rawMetadata.series_title),
    seasonNumber: isMovie ? undefined : rawMetadata.season_number,
    episodeNumber: isMovie ? undefined : rawMetadata.episode_number,
    episodeTitle: isMovie ? undefined : sanitizeString(episode.title),
  };
};

const convertDownloadToPlayback = (audioUrl: string, videoUrl: string): string => {
  try {
    const url = new URL(audioUrl);
    const playbackUrl = new URL(videoUrl);
    url.pathname = url.pathname.replace("/manifest/download/", "/manifest/");
    url.searchParams.delete("downloadGuid");
    url.searchParams.set("playbackGuid", playbackUrl.searchParams.get("playbackGuid") as string);
    return url.toString();
  } catch {
    return audioUrl;
  }
};

const getEpisodeSource = async (episodeId: string, args: Options) => {
  let videoPlayPlatform: string = PLAY_PLATFORMS.androidtv;
  let audioPlayPlatform: string = PLAY_PLATFORMS.android;

  if (!localStorage.getItem("scope")?.includes("offline_access")) {
    audioPlayPlatform = PLAY_PLATFORMS.androidtv;
    console.warn(
      '192 kb/s audio downloads are not available on your current Crunchyroll plan. Please upgrade to the "Mega Fan" plan to enable this feature. Falling back to 128 kb/s CBR stream.',
    );
  }

  const videoPlay = await fetchPlayback(episodeId, videoPlayPlatform, "play");
  const audioPlay = await fetchPlayback(episodeId, audioPlayPlatform, "download");
  videoPlay.url = convertDownloadToPlayback(audioPlay.url, videoPlay.url);

  if (videoPlay.error === "TOO_MANY_ACTIVE_STREAMS") {
    console.warn("Too many active streams. Revoking all active streams...");
    for (const activeStream of videoPlay.activeStreams) {
      await revokePlayData(activeStream.contentId, activeStream.token);
    }
  }

  const subtitles: { url: string; language?: string; format?: string }[] = [];
  for (const subtitle of Object.values(videoPlay.subtitles) as any[]) {
    const containsSelectedSubtitles =
      !args.subtitleLanguages?.length ||
      args.subtitleLanguages.some((lang: string) => subtitle.language.startsWith(lang));
    if (!containsSelectedSubtitles) continue;
    subtitles.push({
      url: subtitle.url,
      language: subtitle.language,
      format: subtitle.format,
    });
  }

  let data = videoPlay;
  if (videoPlay.versions) {
    const defaultVersion = { audio_locale: videoPlay.audioLocale, guid: episodeId };
    const versions = [defaultVersion, ...videoPlay.versions];
    const version = filterSeasonVersionsByAudio(versions, args.languages);
    if (!version) {
      console.warn(
        `No suitable version found for episode #${episodeId}. Available audio: ${getAudioLocales(versions)}`,
      );
    } else if (version.guid !== episodeId) {
      data = await fetchPlayData(version.guid);
    }
  }

  if (args.hardsub) {
    let hardsubUrl = "";
    for (const hardsub of Object.values(data.hardSubs) as any[]) {
      const matchHardsubLang =
        !args.subtitleLanguages?.length ||
        args.subtitleLanguages.some((lang: string) => hardsub.hlang.includes(lang));
      if (matchHardsubLang) hardsubUrl = hardsub.url;
    }
    if (!hardsubUrl) console.warn("No suitable hardsub stream found");
    else data.url = hardsubUrl;
  }

  return {
    url: data.url,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      "User-Agent": USER_AGENT,
    },
    drmConfig: {
      server: ROUTES.widevine,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        "User-Agent": USER_AGENT,
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "content-type": "application/octet-stream",
        "x-cr-content-id": data.guid || episodeId,
        "x-cr-video-token": videoPlay.token,
      },
    },
    subtitles,
  };
};

const getEpisodeIdsBySeries = async (seriesId: string, args: Options) => {
  const response = await fetchSeriesSeasons(seriesId);
  const seasons = response.data;
  if (!seasons?.length) {
    console.error("No seasons found");
    return [];
  }

  const episodesQueue = seasons.map((season: any) => {
    const version = filterSeasonVersionsByAudio(season.versions);
    if (!version) return [];
    const overrideSeasonNumber = (episodes: any[]) =>
      episodes.map((episode: any) => ({
        ...episode,
        season_number: season.season_number,
      }));
    return fetchEpisodes(version.guid)
      .then((data) => overrideSeasonNumber(data.items))
      .catch(() => []);
  });

  const allEpisodes = (await Promise.all(episodesQueue)).flat();
  const eps = utils.extendEpisodes(args.episodes || new Map());
  const episodes = eps.items.size
    ? allEpisodes.filter((episode: any) => eps.has(episode.episode_number, episode.season_number))
    : allEpisodes;

  if (!episodes.length) {
    const availableSeasons = seasons
      .map(
        (s: any) =>
          `S${s.season_number.toString().padStart(2, "0")} (${getAudioLocales(s.versions)})`,
      )
      .join(", ");
    console.error(`No suitable episodes found. Available seasons: ${availableSeasons}`);
    return [];
  }

  return episodes.map((episode: any) => episode.id);
};

export default defineExtension<SharedContext>({
  async initialize() {
    await updateAuthorizationHeader();
    await signIn();
  },

  async getEntries({ url, options }) {
    const cms = getCms();
    if (!cms.bucket) {
      console.error("CMS bucket not found");
      return [];
    }

    const episodeId = url.split("watch/")[1]?.split("/")[0];
    const seriesId = url.split("series/")[1]?.split("/")[0];
    const results: MediaEntry<SharedContext>[] = [];
    const languages = structuredClone(options.languages || []);
    if (!languages.length) languages.push("ja-JP");

    for (const language of languages) {
      if (episodeId) {
        const entry = await getEpisodeMetadata(episodeId);
        results.push({
          ...entry,
          context: { contentId: episodeId, language },
        });
      } else if (seriesId) {
        const episodeIds = await getEpisodeIdsBySeries(seriesId, {
          ...options,
          languages: [language],
        });
        for (const currentEpisodeId of episodeIds) {
          const entry = await getEpisodeMetadata(currentEpisodeId);
          results.push({
            ...entry,
            context: { contentId: currentEpisodeId, language },
          });
        }
      }
    }

    return results;
  },

  async resolveEntry({ options, entry }) {
    const contentId = entry.context?.contentId;
    if (typeof contentId !== "string") {
      throw new Error("Crunchyroll content ID is missing");
    }

    const language = entry.context?.language;
    const source = await getEpisodeSource(contentId, {
      ...options,
      languages: typeof language === "string" ? [language] : options.languages,
    });

    entry.context = {
      ...entry.context,
      drmConfig: source.drmConfig,
    };

    const input = new Input({
      source: new UrlSource(source.url, {
        requestInit: source.headers ? { headers: source.headers } : undefined,
      }),
    });

    for (const subtitle of source.subtitles ?? []) {
      if (!subtitle.url) continue;
      input.addSubtitleTrack(new UrlSource(subtitle.url), {
        languageCode: subtitle.language,
        codec: subtitle.format?.toLowerCase() as any,
      });
    }

    return { entry, input };
  },

  auth: {
    async getState() {
      return { authenticated: !!localStorage.getItem("accessToken") };
    },
    async login(request) {
      await updateAuthorizationHeader();
      if (request.method === "password") await signIn(request.username, request.password);
      else await signIn();
    },
    async logout() {
      await signOut();
    },
  },

  drm: {
    async requestLicense(request) {
      if (request.system !== "widevine") {
        throw new Error(`Unsupported DRM system: ${request.system}`);
      }

      const drmConfig = request.resource.entry.context?.drmConfig;
      const url = drmConfig?.server;
      if (!url) {
        throw new Error("Crunchyroll DRM config is missing on the resolved entry");
      }

      const response = await fetch(url, {
        method: "POST",
        headers: drmConfig.headers,
        body: request.data as any,
      });
      return new Uint8Array(await response.arrayBuffer());
    },
  },
});
