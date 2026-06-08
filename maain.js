import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const YTM_NEXT_URL =
  "https://music.youtube.com/youtubei/v1/next?prettyPrint=false";

// ─── Build exact YTM request body ────────────────────────────────────────────

function buildBody(videoId) {
  const playlistId = `RDAMVM${videoId}`;
  return {
    enablePersistentPlaylistPanel: true,
    tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
    videoId,
    playlistId,
    params: "wAEB8gEAmgMDCNgE-gUA",
    playerParams: "igMDCNgE",
    loggingContext: {
      vssLoggingContext: {
        serializedContextData: Buffer.from(`\n\x11RDAMVM${videoId}`).toString(
          "base64"
        ),
      },
    },
    isAudioOnly: true,
    responsiveSignals: { videoInteraction: [] },
    queueContextParams: "",
    context: {
      client: {
        hl: "en",
        gl: "US",
        clientName: "WEB_REMIX",
        clientVersion: "1.20260531.05.00",
        osName: "Macintosh",
        osVersion: "10_15_7",
        platform: "DESKTOP",
        clientFormFactor: "UNKNOWN_FORM_FACTOR",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36,gzip(gfe)",
        browserName: "Chrome",
        browserVersion: "137.0.0.0",
        userInterfaceTheme: "USER_INTERFACE_THEME_DARK",
        timeZone: "America/New_York",
        originalUrl: `https://music.youtube.com/watch?v=${videoId}&list=RDAMVM${videoId}`,
        screenPixelDensity: 2,
        screenDensityFloat: 2,
        screenWidthPoints: 1280,
        screenHeightPoints: 800,
        utcOffsetMinutes: 0,
        musicAppInfo: {
          webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
          storeDigitalGoodsApiSupportStatus: {
            playStoreDigitalGoodsApiSupportStatus:
              "DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED",
          },
        },
      },
      user: { lockedSafetyMode: false },
      request: { useSsl: true, internalExperimentFlags: [] },
    },
  };
}

// ─── Fetch the "Up next" queue for one video ─────────────────────────────────

async function fetchQueue(videoId) {
  const res = await fetch(YTM_NEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Origin: "https://music.youtube.com",
      Referer: `https://music.youtube.com/watch?v=${videoId}`,
      "X-YouTube-Client-Name": "67",
      "X-YouTube-Client-Version": "1.20260531.05.00",
      "X-Origin": "https://music.youtube.com",
    },
    body: JSON.stringify(buildBody(videoId)),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${videoId}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

// ─── Parse all playlistPanelVideoRenderer items from a /next response ────────
// Returns Map<videoId, trackMeta>

function parseQueue(data) {
  const map = new Map();

  try {
    const tabs =
      data?.contents?.singleColumnMusicWatchNextResultsRenderer
        ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs ?? [];

    for (const tab of tabs) {
      const contents =
        tab?.tabRenderer?.content?.musicQueueRenderer?.content
          ?.playlistPanelRenderer?.contents ?? [];

      for (const item of contents) {
        const v = item?.playlistPanelVideoRenderer;
        if (!v?.videoId) continue;

        const runs = v.longBylineText?.runs ?? [];

        // Title
        const title =
          v.title?.runs?.[0]?.text ?? v.title?.simpleText ?? "Unknown";

        // Artist — first text run
        const artist =
          runs[0]?.text ?? v.shortBylineText?.runs?.[0]?.text ?? "Unknown";

        // Album + albumId — run that links to MUSIC_PAGE_TYPE_ALBUM
        let album = null;
        let albumId = null;
        for (const run of runs) {
          const pt =
            run?.navigationEndpoint?.browseEndpoint
              ?.browseEndpointContextSupportedConfigs
              ?.browseEndpointContextMusicConfig?.pageType;
          if (pt === "MUSIC_PAGE_TYPE_ALBUM") {
            album = run.text;
            albumId = run.navigationEndpoint.browseEndpoint.browseId ?? null;
            break;
          }
        }

        // Year — last run that looks like a 4-digit year
        let year = null;
        for (let i = runs.length - 1; i >= 0; i--) {
          if (/^\d{4}$/.test(runs[i].text?.trim())) {
            year = runs[i].text.trim();
            break;
          }
        }

        // Largest thumbnail
        const thumbs = [...(v.thumbnail?.thumbnails ?? [])].sort(
          (a, b) => (b.width ?? 0) - (a.width ?? 0)
        );
        const thumbnail = thumbs[0]?.url ?? null;

        // Duration
        const duration =
          v.lengthText?.runs?.[0]?.text ??
          v.lengthText?.simpleText ??
          null;

        map.set(v.videoId, {
          videoId: v.videoId,
          title,
          artist,
          album,
          albumId,
          year,
          thumbnail,
          duration,
        });
      }
    }
  } catch (_) {}

  return map;
}

// ─── Core logic ───────────────────────────────────────────────────────────────
// Fetch all queues in parallel, then score: rank tracks by how many seed
// queues they appear in. Return top results sorted by score descending.

async function buildFeed(seedIds, limit, minScore = 1) {
  const seedSet = new Set(seedIds);

  // Parallel fetch
  const settled = await Promise.allSettled(seedIds.map(fetchQueue));

  // Parse each into a Map<videoId, meta>
  const queueMaps = [];
  const perSeed = [];

  for (let i = 0; i < seedIds.length; i++) {
    const result = settled[i];
    const seedId = seedIds[i];

    if (result.status === "rejected") {
      perSeed.push({ seedId, ok: false, error: result.reason?.message, queueSize: 0 });
      queueMaps.push(new Map());
      continue;
    }

    const qmap = parseQueue(result.value);

    // Remove the seed IDs themselves from each queue
    for (const sid of seedSet) qmap.delete(sid);

    perSeed.push({ seedId, ok: true, queueSize: qmap.size });
    queueMaps.push(qmap);
  }

  // Score each track by how many queues it appears in
  const scores = new Map(); // videoId -> { meta, score }

  for (const qmap of queueMaps) {
    for (const [videoId, meta] of qmap) {
      if (scores.has(videoId)) {
        scores.get(videoId).score += 1;
      } else {
        scores.set(videoId, { meta, score: 1 });
      }
    }
  }

  // Sort by score desc, then title asc as tiebreaker
  const ranked = [...scores.values()]
    .filter(({ score }) => score >= minScore)
    .sort(
      (a, b) => b.score - a.score || a.meta.title.localeCompare(b.meta.title)
    );

  const feed = ranked.slice(0, limit).map(({ meta, score }) => ({
    ...meta,
    score,        // how many seeds recommended this track
    maxScore: queueMaps.length, // out of this many seeds
  }));

  return {
    feed,
    meta: {
      seeds: seedIds,
      totalSeeds: seedIds.length,
      uniqueTracksFound: scores.size,
      returnedTracks: feed.length,
      minScore,
      perSeed,
    },
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ytm-feed-builder" });
});

app.get("/api/feed", async (req, res) => {
  const idsParam = req.query.ids ?? "";
  const limitParam = parseInt(req.query.limit ?? "50", 10);
  const minScoreParam = parseInt(req.query.minScore ?? "1", 10);

  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-zA-Z0-9_-]{11}$/.test(s));

  if (ids.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid `ids` param.",
      hint: "Comma-separated 11-char YouTube video IDs.",
      example: "/api/feed?ids=-IrHSWo-MIY,x18b0D8sTwo",
    });
  }

  if (ids.length > 25) {
    return res.status(400).json({ error: "Max 25 seed IDs per request." });
  }

  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 200);
  const minScore = Math.min(Math.max(isNaN(minScoreParam) ? 1 : minScoreParam, 1), ids.length);

  try {
    const result = await buildFeed(ids, limit, minScore);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`ytm-feed-builder running on http://localhost:${PORT}`);
  console.log(`  GET /api/feed?ids=ID1,ID2,...`);
  console.log(`  Optional: &limit=50&minScore=2`);
});
