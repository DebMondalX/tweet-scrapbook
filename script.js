/* =========================================================================
   Tweet Scrapbook — single-user, browser-only tweet archive.
   Tweets are stored in localStorage and rendered with Twitter's official
   widgets.js embed script so they look exactly like they do on X.
   ========================================================================= */

// --- Configuration -------------------------------------------------------

const CATEGORIES = [
  { id: "milestones", label: "🚀 Milestones" },
  { id: "insights", label: "💡 Insights/Learnings" },
  { id: "wall-of-fame", label: "❤️ Wall of Fame (50+ Likes)" },
  { id: "tools", label: "🛠️ Useful Tools" },
];

const STORAGE_KEY = "tweet-scrapbook.items";

// --- State ---------------------------------------------------------------

let items = loadItems(); // [{ id, tweetId, url, category, addedAt }]
let activeFilter = "all";

// --- DOM references ------------------------------------------------------

const form = document.getElementById("add-form");
const urlInput = document.getElementById("tweet-url");
const categorySelect = document.getElementById("category");
const formError = document.getElementById("form-error");
const filtersEl = document.getElementById("filters");
const feedEl = document.getElementById("feed");
const emptyState = document.getElementById("empty-state");

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
    note.className = "empty-state";
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
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  saveItems();
  renderFeed();
}

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

// --- Wire up -------------------------------------------------------------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem(urlInput.value, categorySelect.value);
});

renderCategoryOptions();
renderFilters();
renderFeed();
