// LwLAT social media dashboard: data function
// --------------------------------------------
// The page calls /api/social?days=28. This function asks Windsor.ai for the
// figures, tidies them into one simple shape and sends them back.
//
// The Windsor.ai API key lives ONLY in a Netlify environment variable called
// WINDSOR_API_KEY. It is never written into this file, the page or GitHub.
//
// To check what Windsor sends back for one platform, open:
//   https://YOUR-SITE.netlify.app/api/social?check=facebook
// It lists the column names Windsor returned, so you can correct the field
// names in PLATFORMS below if a platform shows "not connected".

const WINDSOR = "https://connectors.windsor.ai";

// ---------------------------------------------------------------------------
// PLATFORMS: the only part you should need to edit.
//
// connector   Windsor.ai connector name (shown in the API URL Windsor gives you)
// enabled     true to include the platform, false to hide it
// fields      daily account figures. A list means "add these together".
//   followers       total followers on that day (or new follows, see below)
//   followersMode   "total" if the field is a running total,
//                   "gain"  if it is new followers per day
//   impressions     times content was seen (or reach, if that is all there is)
//   engagements     reactions, comments, shares, clicks and so on
// posts       post-level fields, used for the "Top posts" section.
//             Set posts: null to skip posts for a platform.
//
// Field names checked against Windsor.ai's live field lists on 24 November 2026
// (https://connectors.windsor.ai/<connector>/fields). Facebook and Instagram
// only allow the last two years of data, so historyDays stops the dashboard
// asking for anything older.
// ---------------------------------------------------------------------------
const PLATFORMS = [
  {
    id: "facebook",
    name: "Facebook",
    connector: "facebook_organic",
    enabled: true,
    accountField: "account_name",
    historyDays: 729, // Meta keeps two years of insights
    fields: {
      followers: "page_follows",
      followersMode: "total",
      impressions: "page_impressions",
      engagements: "page_post_engagements",
    },
    posts: {
      id: "post_id",
      text: "post_message",
      url: "permalink_url",
      date: "post_created_time",
      image: "full_picture",
      impressions: "post_impressions",
      engagements: "post_engagements",
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    connector: "instagram",
    enabled: true,
    accountField: "account_name",
    historyDays: 729, // Meta keeps two years of insights
    followersSnapshot: true, // Instagram only gives today's follower total
    fields: {
      followers: "followers_count",
      followersMode: "total",
      impressions: "views",
      engagements: "total_interactions",
    },
    posts: {
      id: "media_id",
      text: "media_caption",
      url: "media_permalink",
      date: "timestamp",
      image: "media_url",
      impressions: "media_views",
      engagements: "media_engagement",
    },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    connector: "linkedin_organic",
    enabled: true,
    accountField: "account_name",
    followersLatestOnly: true, // LinkedIn repeats today's follower total on every day
    fields: {
      followers: "organization_follower_count",
      followersMode: "total",
      impressions: "account_analytics_impression_count",
      engagements: "account_analytics_total_engagements",
    },
    posts: null,
  },
  {
    id: "tiktok",
    name: "TikTok",
    connector: "tiktok_organic",
    enabled: false,
    accountField: "account_name",
    fields: {
      followers: "followers_count",
      followersMode: "total",
      impressions: "video_views",
      engagements: ["likes", "comments", "shares"],
    },
    posts: null,
  },
  {
    id: "youtube",
    name: "YouTube",
    connector: "youtube",
    enabled: false,
    accountField: "account_name",
    fields: {
      followers: "subscribers_gained",
      followersMode: "gain",
      impressions: "views",
      engagements: ["likes", "comments", "shares"],
    },
    posts: null,
  },
];

// Account names, matched to schools. Left side is the account name exactly as
// Windsor.ai returns it, right side is what the page shows. Give a school's
// Facebook, Instagram and LinkedIn accounts the SAME name on the right, and the
// "By school" table adds them together.
const ACCOUNT_NAMES = {
  // Trust
  "Learning without Limits Academy Trust": "LwLAT (trust)",
  "lwlat": "LwLAT (trust)",
  // Babington Academy
  "Babington Academy": "Babington Academy",
  "babingtonlwlat": "Babington Academy",
  "babingtonbolts": "Babington Academy",
  // Lancaster Academy
  "Lancaster Academy": "Lancaster Academy",
  "lancaster_academy_lwlat": "Lancaster Academy",
  // South Wigston High School
  "South Wigston High School": "South Wigston High School",
  "southwigstonhighschool": "South Wigston High School",
  // Heatherbrook Primary Academy
  "Heatherbrook Primary Academy & Nursery": "Heatherbrook Primary Academy",
  "Heatherbrook Primary Academy": "Heatherbrook Primary Academy",
  // Woodstock Primary Academy
  "Woodstock Primary Academy & Nursery": "Woodstock Primary Academy",
  "Woodstock Primary Academy": "Woodstock Primary Academy",
  // Wyken Croft Primary School (Facebook only)
  "Wyken Croft Primary School": "Wyken Croft Primary School",
  // EduHub
  "Eduhub": "EduHub",
  "Eduhub LwLAT": "EduHub",
};

const ALLOWED_DAYS = [7, 28, 90];
const CACHE_MINUTES = 30;
const MAX_POSTS = 9;
const TERM_CACHE_MINUTES = 360; // termly figures: six hours
const MAX_DAILY_DAYS = 1200; // about three school years

// ---------------------------------------------------------------------------
// Nothing below here should need changing.
// ---------------------------------------------------------------------------

const cache = new Map();

const list = (f) => (f == null ? [] : Array.isArray(f) ? f : [f]);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const sumOf = (row, f) => list(f).reduce((t, k) => t + num(row[k]), 0);
const hasAny = (row, f) => list(f).some((k) => row[k] !== null && row[k] !== undefined && row[k] !== "");
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

function periods(days) {
  // End at yesterday so every day in the range is complete.
  const end = shift(new Date(), -1);
  const start = shift(end, -(days - 1));
  const prevEnd = shift(start, -1);
  const prevStart = shift(prevEnd, -(days - 1));
  return {
    current: { from: iso(start), to: iso(end) },
    previous: { from: iso(prevStart), to: iso(prevEnd) },
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

async function windsor(connector, fields, from, to, key, cacheMinutes = CACHE_MINUTES) {
  const wanted = [...new Set(fields.filter(Boolean))];
  const params = new URLSearchParams({ date_from: from, date_to: to, fields: wanted.join(",") });
  const cacheKey = `${connector}?${params}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < cacheMinutes * 60 * 1000) return hit.rows;

  params.set("api_key", key);
  const scrub = (s) => String(s).split(key).join("***");
  let res;
  try {
    res = await fetch(`${WINDSOR}/${connector}?${params}`, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new Error(scrub(`Could not reach Windsor.ai (${err.message})`));
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(scrub(`Windsor.ai sent something other than data (HTTP ${res.status}): ${text.slice(0, 200)}`));
  }
  if (!res.ok) {
    throw new Error(scrub(`Windsor.ai said no (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 300)}`));
  }
  const rows = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : null;
  if (!rows) throw new Error(scrub(`Unexpected reply from Windsor.ai: ${JSON.stringify(body).slice(0, 300)}`));
  cache.set(cacheKey, { at: Date.now(), rows });
  return rows;
}

function accountName(p, row) {
  const raw = row[p.accountField || "account_name"] || p.name;
  return ACCOUNT_NAMES[raw] || raw;
}

function summarise(p, rows) {
  const f = p.fields;
  const byDate = new Map();
  const byAccount = new Map();
  const follows = new Map();
  let impressions = 0;
  let engagements = 0;
  let gainTotal = 0;

  for (const r of rows) {
    const date = String(r.date || "").slice(0, 10);
    const acc = accountName(p, r);
    const imp = sumOf(r, f.impressions);
    const eng = sumOf(r, f.engagements);
    impressions += imp;
    engagements += eng;

    if (date) {
      const day = byDate.get(date) || { date, impressions: 0, engagements: 0, followers: null };
      day.impressions += imp;
      day.engagements += eng;
      if (hasAny(r, f.followers)) day.followers = (day.followers || 0) + sumOf(r, f.followers);
      byDate.set(date, day);
    }
    const a = byAccount.get(acc) || { name: acc, impressions: 0, engagements: 0, followers: null };
    a.impressions += imp;
    a.engagements += eng;
    byAccount.set(acc, a);

    if (hasAny(r, f.followers)) {
      const v = sumOf(r, f.followers);
      if (f.followersMode === "gain") {
        gainTotal += v;
      } else {
        const e = follows.get(acc) || {};
        if (!e.first || date < e.first.date) e.first = { date, v };
        if (!e.last || date >= e.last.date) e.last = { date, v };
        follows.set(acc, e);
      }
    }
  }

  let followers = null;
  let followerGain = f.followersMode === "gain" ? gainTotal : null;
  if (follows.size) {
    followers = 0;
    followerGain = 0;
    for (const [acc, e] of follows) {
      followers += e.last.v;
      followerGain += e.last.v - e.first.v;
      byAccount.get(acc).followers = e.last.v;
    }
  }

  return {
    totals: { followers, followerGain, impressions, engagements },
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    accounts: [...byAccount.values()].sort((a, b) => b.engagements - a.engagements),
  };
}

// Daily figures for each account (school), kept compact: [date, impressions, engagements, followers]
function accountDaily(p, rows) {
  const f = p.fields;
  const byAcc = new Map();
  for (const r of rows) {
    const date = String(r.date || "").slice(0, 10);
    if (!date) continue;
    const acc = accountName(p, r);
    const days = byAcc.get(acc) || new Map();
    const d = days.get(date) || [date, 0, 0, null];
    d[1] += sumOf(r, f.impressions);
    d[2] += sumOf(r, f.engagements);
    if (hasAny(r, f.followers)) d[3] = (d[3] || 0) + sumOf(r, f.followers);
    days.set(date, d);
    byAcc.set(acc, days);
  }
  return [...byAcc].map(([name, days]) => ({ name, daily: [...days.values()].sort((a, b) => a[0].localeCompare(b[0])) }));
}

function safeUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : null;
  } catch {
    return null;
  }
}

function tidyPosts(p, rows) {
  const m = p.posts;
  const seen = new Map();
  for (const r of rows) {
    const id = r[m.id] || r[m.url] || r[m.text];
    if (!id) continue;
    const post = {
      platform: p.id,
      account: accountName(p, r),
      text: String(r[m.text] || "").slice(0, 600),
      url: safeUrl(r[m.url]),
      image: safeUrl(r[m.image]),
      date: r[m.date] ? String(r[m.date]).slice(0, 10) : null,
      impressions: sumOf(r, m.impressions),
      engagements: sumOf(r, m.engagements),
    };
    const old = seen.get(id);
    // Some connectors repeat a post once per day. Keep the highest figures.
    if (!old || post.engagements > old.engagements) seen.set(id, post);
  }
  return [...seen.values()];
}

// Earliest date a platform can supply (Meta allows two years).
function earliest(p) {
  return p.historyDays ? iso(shift(new Date(), -p.historyDays)) : "0000-01-01";
}

// Instagram only reports today's follower total, and LinkedIn repeats today's
// total on every day. Keep the total on the latest day of each account only,
// so past terms do not show a false history.
async function addFollowerSnapshot(p, rows, key) {
  if (p.followersLatestOnly && rows.length) {
    const acc = p.accountField || "account_name";
    const latest = new Map();
    for (const r of rows) if (!latest.has(r[acc]) || String(r.date) > String(latest.get(r[acc]).date)) latest.set(r[acc], r);
    const keep = new Set(latest.values());
    for (const r of rows) if (!keep.has(r)) for (const k of list(p.fields.followers)) r[k] = null;
  }
  if (!p.followersSnapshot || !rows.length) return rows;
  try {
    const today = iso(new Date());
    const snap = await windsor(p.connector, [p.accountField || "account_name", ...list(p.fields.followers)], today, today, key);
    const latest = new Map();
    for (const r of rows) {
      const acc = r[p.accountField || "account_name"];
      if (!latest.has(acc) || String(r.date) > String(latest.get(acc).date)) latest.set(acc, r);
    }
    for (const sr of snap) {
      const target = latest.get(sr[p.accountField || "account_name"]);
      if (target && hasAny(sr, p.fields.followers)) for (const k of list(p.fields.followers)) target[k] = sr[k];
    }
  } catch {
    // Followers are a nice-to-have. Keep the rest of the figures.
  }
  return rows;
}

async function loadPlatform(p, per, key) {
  const f = p.fields;
  const daily = ["date", p.accountField || "account_name", ...list(f.followers), ...list(f.impressions), ...list(f.engagements)];
  try {
    const [cur0, prev] = await Promise.all([
      windsor(p.connector, daily, per.current.from, per.current.to, key),
      windsor(p.connector, daily, per.previous.from, per.previous.to, key),
    ]);
    const cur = await addFollowerSnapshot(p, cur0.filter((r) => !r.date || String(r.date).slice(0, 10) <= per.current.to).map((r) => ({ ...r })), key);
    const now = summarise(p, cur);
    const before = summarise(p, prev);
    let posts = [];
    let postsError = null;
    if (p.posts) {
      const m = p.posts;
      const fields = [p.accountField || "account_name", m.id, m.text, m.url, m.date, m.image, ...list(m.impressions), ...list(m.engagements)];
      try {
        posts = tidyPosts(p, await windsor(p.connector, fields, per.current.from, per.current.to, key));
      } catch (err) {
        postsError = err.message;
      }
    }
    return {
      platform: { id: p.id, name: p.name, ok: true, error: null, postsError, rows: cur.length, totals: now.totals, previous: before.totals, daily: now.daily, accounts: now.accounts },
      posts,
    };
  } catch (err) {
    return { platform: { id: p.id, name: p.name, ok: false, error: err.message }, posts: [] };
  }
}

export default async (req) => {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) {
    return json({ error: "The WINDSOR_API_KEY environment variable is not set in Netlify." }, 500);
  }
  const url = new URL(req.url);

  // Setup helper: /api/social?check=facebook
  const check = url.searchParams.get("check");
  if (check) {
    const p = PLATFORMS.find((x) => x.id === check);
    if (!p) return json({ error: `Unknown platform "${check}".`, platforms: PLATFORMS.map((x) => x.id) }, 404);
    const per = periods(7);
    const f = p.fields;
    const fields = ["date", p.accountField || "account_name", ...list(f.followers), ...list(f.impressions), ...list(f.engagements)];
    try {
      const rows = await windsor(p.connector, fields, per.current.from, per.current.to, key);
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const empty = fields.filter((k) => !rows.some((r) => r[k] !== null && r[k] !== undefined && r[k] !== ""));
      return json({ platform: p.id, connector: p.connector, asked_for: fields, columns_returned: columns, fields_with_no_data: empty, rows: rows.length, sample: rows.slice(0, 3) });
    } catch (err) {
      return json({ platform: p.id, connector: p.connector, asked_for: fields, error: err.message }, 502);
    }
  }

  // Termly figures: /api/social?mode=daily&from=2024-08-27&to=2026-11-22
  // Returns daily totals for each platform. The page groups them into terms.
  if (url.searchParams.get("mode") === "daily") {
    const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
    const from = url.searchParams.get("from");
    const yesterday = iso(shift(new Date(), -1));
    let to = url.searchParams.get("to") || yesterday;
    if (to > yesterday) to = yesterday;
    if (!isDate(from) || !isDate(to) || from > to) return json({ error: "Give from and to as YYYY-MM-DD." }, 400);
    if ((new Date(to) - new Date(from)) / 864e5 > MAX_DAILY_DAYS) return json({ error: `Ask for ${MAX_DAILY_DAYS} days or fewer.` }, 400);
    // Ask Windsor.ai for one year at a time, so no single request is too large.
    const chunks = [];
    for (let a = new Date(from + "T00:00:00Z"); iso(a) <= to; a = shift(a, 365)) {
      const b = shift(a, 364);
      chunks.push([iso(a), iso(b) < to ? iso(b) : to]);
    }
    // Optional: one platform per request (?platform=facebook), so each request stays quick.
    const only = url.searchParams.get("platform");
    const platforms = await Promise.all(
      PLATFORMS.filter((p) => p.enabled && (!only || p.id === only)).map(async (p) => {
        const f = p.fields;
        const fields = ["date", p.accountField || "account_name", ...list(f.followers), ...list(f.impressions), ...list(f.engagements)];
        try {
          // Skip any part of the range older than the platform allows.
          const first = earliest(p);
          const usable = chunks.map(([a, b]) => [a < first ? first : a, b]).filter(([a, b]) => a <= b);
          // Past days do not change, so keep them for longer.
          const parts = await Promise.all(usable.map(([a, b]) => windsor(p.connector, fields, a, b, key, TERM_CACHE_MINUTES)));
          const rows = await addFollowerSnapshot(p, parts.flat().filter((r) => !r.date || String(r.date).slice(0, 10) <= to).map((r) => ({ ...r })), key);
          const sum = summarise(p, rows);
          return { id: p.id, name: p.name, ok: true, error: null, followersMode: f.followersMode || "total", historyFrom: first > from ? first : from, daily: sum.daily, accounts: accountDaily(p, rows) };
        } catch (err) {
          return { id: p.id, name: p.name, ok: false, error: err.message };
        }
      })
    );
    return json(
      { generated: new Date().toISOString(), from, to, platforms },
      200,
      { "cache-control": "public, max-age=900", "netlify-cdn-cache-control": `public, s-maxage=${TERM_CACHE_MINUTES * 60}, stale-while-revalidate=86400` }
    );
  }

  const days = ALLOWED_DAYS.includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 28;
  const per = periods(days);
  const results = await Promise.all(PLATFORMS.filter((p) => p.enabled).map((p) => loadPlatform(p, per, key)));

  const posts = results
    .flatMap((r) => r.posts)
    .sort((a, b) => b.engagements - a.engagements)
    .slice(0, MAX_POSTS);

  return json(
    { generated: new Date().toISOString(), days, period: per, platforms: results.map((r) => r.platform), posts },
    200,
    { "cache-control": "public, max-age=300", "netlify-cdn-cache-control": `public, s-maxage=${CACHE_MINUTES * 60}, stale-while-revalidate=3600` }
  );
};

export const config = { path: "/api/social" };
