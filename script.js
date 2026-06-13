/* =========================================================================
   Tweet Scrapbook — single-user tweet archive.

   Storage model:
     • localStorage is a fast local cache for instant rendering.
     • The durable source of truth is an OPTIONAL private GitHub Gist. When a
       gist-scoped token is connected, the archive is synced to a private gist
       named `tweet-scrapbook.json`, so it survives clearing browser data and
       follows the user across devices/browsers.
   Tweets are rendered with Twitter's official widgets.js embed script.
   ========================================================================= */

// --- Configuration -------------------------------------------------------

const CATEGORIES = [
  { id: "milestones", label: "🚀 Milestones" },
  { id: "insights", label: "💡 Insights/Learnings" },
  { id: "wall-of-fame", label: "❤️ Wall of Fame (50+ Likes)" },
  { id: "tools", label: "🛠️ Useful Tools" },
];

const STORAGE_KEY = "tweet-scrapbook.items";
const TOKEN_KEY = "tweet-scrapbook.gh-token";
const GIST_ID_KEY = "tweet-scrapbook.gist-id";
const GIST_FILENAME = "tweet-scrapbook.json";

// --- State ---------------------------------------------------------------

let items = loadItems(); // [{ id, tweetId, url, category, addedAt }]
let activeFilter = "all";

let ghToken = localStorage.getItem(TOKEN_KEY) || null;
let gistId = localStorage.getItem(GIST_ID_KEY) || null;

// --- DOM references ------------------------------------------------------

const form = document.getElementById("add-form");
const urlInput = document.getElementById("tweet-url");
const categorySelect = document.getElementById("category");
const formError = document.getElementById("form-error");
const filtersEl = document.getElementById("filters");
const feedEl = document.getElementById("feed");
const emptyState = document.getElementById("empty-state");

// Sync UI
const syncDot = document.getElementById("sync-dot");
const syncText = document.getElementById("sync-text");
const syncToggle = document.getElementById("sync-toggle");
const syncPanel = document.getElementById("sync-panel");
const tokenInput = document.getElementById("gh-token");
const connectBtn = document.getElementById("gh-connect");
const disconnectBtn = document.getElementById("gh-disconnect");
const syncError = document.getElementById("sync-error");

// --- Persistence ---------------------------------------------------------

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// --- GitHub Gist sync ----------------------------------------------------

const GH_API = "https://api.github.com";

function ghHeaders() {
  return {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

const isConnected = () => Boolean(ghToken && gistId);

// Reflect sync state in the little status bar.
function setSyncStatus(state, message) {
  const map = {
    disconnected: ["", "Not connected — saved only in this browser"],
    connected: ["connected", "Synced to a private Gist"],
    syncing: ["syncing", "Syncing…"],
    error: ["error", message || "Sync error"],
  };
  const [cls, text] = map[state] || map.disconnected;
  syncDot.className = "sync-dot" + (cls ? " " + cls : "");
  syncText.textContent = text;
}

// Find an existing `tweet-scrapbook.json` gist for this account, else create
// one. Returns the gist id. Searching by filename means a browser-data clear
// (which loses the cached gist id) reconnects to the SAME gist, not a dupe.
async function findOrCreateGist() {
  const res = await fetch(`${GH_API}/gists?per_page=100`, { headers: ghHeaders() });
  if (res.status === 401) throw new Error("Invalid or expired token.");
  if (!res.ok) throw new Error(`GitHub error (${res.status}).`);

  const gists = await res.json();
  const existing = gists.find((g) => g.files && g.files[GIST_FILENAME]);
  if (existing) return existing.id;

  const createRes = await fetch(`${GH_API}/gists`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({
      description: "Tweet Scrapbook archive",
      public: false,
      files: { [GIST_FILENAME]: { content: "[]" } },
    }),
  });
  if (!createRes.ok) throw new Error(`Could not create gist (${createRes.status}).`);
  const created = await createRes.json();
  return created.id;
}

async function pullFromGist() {
  const res = await fetch(`${GH_API}/gists/${gistId}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`Could not read gist (${res.status}).`);
  const gist = await res.json();
  const file = gist.files && gist.files[GIST_FILENAME];
  if (!file) return [];
  try {
    return JSON.parse(file.content) || [];
  } catch {
    return [];
  }
}

async function pushToGist() {
  if (!isConnected()) return;
  setSyncStatus("syncing");
  try {
    const res = await fetch(`${GH_API}/gists/${gistId}`, {
      method: "PATCH",
      headers: ghHeaders(),
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: JSON.stringify(items, null, 2) } },
      }),
    });
    if (!res.ok) throw new Error(`Sync failed (${res.status}).`);
    setSyncStatus("connected");
  } catch (err) {
    setSyncStatus("error", "Saved locally, but sync failed.");
  }
}

// Merge two archives by tweetId (union), so connecting never loses tweets
// that exist only locally or only in the gist.
function mergeArchives(a, b) {
  const seen = new Set();
  const out = [];
  for (const item of [...a, ...b]) {
    if (item && item.tweetId && !seen.has(item.tweetId)) {
      seen.add(item.tweetId);
      out.push(item);
    }
  }
  return out;
}

async function connect(token) {
  ghToken = token;
  setSyncStatus("syncing");
  try {
    gistId = await findOrCreateGist();
    const remote = await pullFromGist();
    items = mergeArchives(items, remote); // keep local + remote
    saveItems();
    await pushToGist(); // write the merged result back
    localStorage.setItem(TOKEN_KEY, ghToken);
    localStorage.setItem(GIST_ID_KEY, gistId);
    setSyncStatus("connected");
    renderConnectionUI();
    renderFeed();
  } catch (err) {
    ghToken = null;
    gistId = null;
    setSyncStatus("disconnected");
    showSyncError(err.message || "Could not connect.");
  }
}

// Disconnect keeps the local cache; only the token + cached gist id are dropped.
function disconnect() {
  ghToken = null;
  gistId = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  setSyncStatus("disconnected");
  renderConnectionUI();
}

// On load, if we already have a token, re-sync from the gist.
async function initSync() {
  if (!ghToken) {
    setSyncStatus("disconnected");
    return;
  }
  setSyncStatus("syncing");
  try {
    if (!gistId) gistId = await findOrCreateGist();
    const remote = await pullFromGist();
    items = mergeArchives(remote, items); // remote first: prefer stored copy
    saveItems();
    localStorage.setItem(GIST_ID_KEY, gistId);
    setSyncStatus("connected");
    renderFeed();
  } catch (err) {
    setSyncStatus("error", "Couldn't reach GitHub. Showing local copy.");
  }
  renderConnectionUI();
}

// --- URL parsing ---------------------------------------------------------

// Accepts twitter.com / x.com / mobile variants and returns the numeric
// status (tweet) id, or null if the URL isn't a recognizable tweet link.
function extractTweetId(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const validHosts = ["twitter.com", "x.com", "mobile.twitter.com", "mobile.x.com"];
  if (!validHosts.includes(host)) return null;

  const match = url.pathname.match(/\/status(?:es)?\/(\d+)/);
  return match ? match[1] : null;
}

// Build a canonical x.com URL from a tweet id so embeds are consistent.
function canonicalUrl(tweetId) {
  return `https://twitter.com/i/status/${tweetId}`;
}

function categoryLabel(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.label : id;
}

// --- Rendering: filters & category dropdown ------------------------------

function renderCategoryOptions() {
  categorySelect.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.label;
    categorySelect.appendChild(opt);
  });
}

function renderFilters() {
  filtersEl.innerHTML = "";

  const makeBtn = (id, label) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (activeFilter === id ? " active" : "");
    btn.textContent = label;
    btn.type = "button";
    btn.addEventListener("click", () => {
      activeFilter = id;
      renderFilters();
      renderFeed();
    });
    return btn;
  };

  filtersEl.appendChild(makeBtn("all", "All"));
  CATEGORIES.forEach((cat) => {
    filtersEl.appendChild(makeBtn(cat.id, cat.label));
  });
}

// --- Rendering: feed -----------------------------------------------------

function renderFeed() {
  feedEl.innerHTML = "";

  const visible = items.filter(
    (item) => activeFilter === "all" || item.category === activeFilter
  );

  // Newest first.
  visible.sort((a, b) => b.addedAt - a.addedAt);

  emptyState.hidden = items.length !== 0;
  if (visible.length === 0 && items.length !== 0) {
    const note = document.createElement("p");
    note.className = "empty-state span-all";
    note.textContent = "No tweets in this category yet.";
    feedEl.appendChild(note);
    return;
  }

  visible.forEach((item) => feedEl.appendChild(buildTweetCard(item)));
  loadTwitterWidgets();
}

function buildTweetCard(item) {
  const card = document.createElement("article");
  card.className = "tweet-card";

  const bar = document.createElement("div");
  bar.className = "tweet-card-bar";

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = categoryLabel(item.category);

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.type = "button";
  del.title = "Remove from archive";
  del.textContent = "✕";
  del.addEventListener("click", () => removeItem(item.id));

  bar.appendChild(tag);
  bar.appendChild(del);

  const embed = document.createElement("div");
  embed.className = "tweet-embed";

  // Twitter's widgets.js looks for <blockquote class="twitter-tweet"> and
  // upgrades it into a fully rendered embed.
  const blockquote = document.createElement("blockquote");
  blockquote.className = "twitter-tweet";
  blockquote.setAttribute("data-width", "300"); // smaller embed for the grid
  blockquote.setAttribute("data-conversation", "none");
  const a = document.createElement("a");
  a.href = item.url;
  a.textContent = "View tweet on X";
  blockquote.appendChild(a);
  embed.appendChild(blockquote);

  card.appendChild(bar);
  card.appendChild(embed);
  return card;
}

// Load (once) and run Twitter's widget script to upgrade blockquotes.
function loadTwitterWidgets() {
  if (window.twttr && window.twttr.widgets) {
    window.twttr.widgets.load(feedEl);
    return;
  }
  if (document.getElementById("twitter-wjs")) return; // already loading

  const s = document.createElement("script");
  s.id = "twitter-wjs";
  s.src = "https://platform.twitter.com/widgets.js";
  s.async = true;
  document.body.appendChild(s);
}

// --- Actions -------------------------------------------------------------

function addItem(rawUrl, category) {
  const tweetId = extractTweetId(rawUrl);
  if (!tweetId) {
    showError("That doesn't look like a tweet URL. Try something like https://x.com/user/status/123456789");
    return;
  }

  if (items.some((it) => it.tweetId === tweetId)) {
    showError("That tweet is already in your archive.");
    return;
  }

  items.push({
    id: `${tweetId}-${Date.now()}`,
    tweetId,
    url: canonicalUrl(tweetId),
    category,
    addedAt: Date.now(),
  });

  saveItems();
  clearError();
  urlInput.value = "";
  renderFeed();
  pushToGist();
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  saveItems();
  renderFeed();
  pushToGist();
}

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

// --- Sync UI -------------------------------------------------------------

function showSyncError(msg) {
  syncError.textContent = msg;
  syncError.hidden = false;
}

function clearSyncError() {
  syncError.hidden = true;
  syncError.textContent = "";
}

// Reflect connected/disconnected state in the panel controls.
function renderConnectionUI() {
  if (isConnected()) {
    syncToggle.textContent = "Manage sync";
    disconnectBtn.hidden = false;
    tokenInput.value = "";
  } else {
    syncToggle.textContent = "Connect GitHub";
    disconnectBtn.hidden = true;
  }
}

syncToggle.addEventListener("click", () => {
  syncPanel.hidden = !syncPanel.hidden;
});

connectBtn.addEventListener("click", () => {
  clearSyncError();
  const token = tokenInput.value.trim();
  if (!token) {
    showSyncError("Paste your gist-scoped token first.");
    return;
  }
  connect(token);
});

tokenInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connectBtn.click();
});

disconnectBtn.addEventListener("click", disconnect);

// --- Wire up -------------------------------------------------------------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem(urlInput.value, categorySelect.value);
});

renderCategoryOptions();
renderFilters();
renderConnectionUI();
renderFeed();
initSync();
