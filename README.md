# 📌 Tweet Scrapbook

A simple, single-user web app that acts as a **curated digital scrapbook for important tweets**. Instead of endlessly scrolling through X bookmarks, paste a tweet URL to save it, categorize it, and find it later.

## ✨ Features

- **Link Importer** — paste a Twitter/X URL and hit *Add to Archive*.
- **Live Embeds** — tweets are rendered with Twitter's official [Embedded Tweets](https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview) script, so they look exactly like they do on X (images, videos, likes, retweets).
- **Manual Tagging** — assign each tweet a category when you save it:
  - 🚀 Milestones
  - 💡 Insights/Learnings
  - ❤️ Wall of Fame (50+ Likes)
  - 🛠️ Useful Tools
- **Filter** — one-click category buttons at the top filter the feed.
- **Durable storage** — works offline using `localStorage`, and can optionally sync to a **private GitHub Gist** so your archive survives clearing browser data and follows you across devices.

## 🚀 Usage

No build step, no dependencies. Just open the site:

1. Open `index.html` in a browser, **or** serve the folder:
   ```bash
   python3 -m http.server 8000
   # then visit http://localhost:8000
   ```
2. Paste a tweet URL (e.g. `https://x.com/user/status/123456789`).
3. Pick a category and click **Add to Archive**.
4. Use the filter buttons to browse by category. Click ✕ on a card to remove it.

## 🗂️ Project structure

```
tweet-scrapbook/
├── index.html   # markup
├── style.css    # styling
├── script.js    # logic: URL parsing, storage, embeds, filtering
└── README.md
```

## 🛠️ How it works

- A pasted URL is parsed to extract the numeric **status id** (supports `twitter.com`, `x.com`, and mobile variants).
- Each saved item (`tweetId`, `category`, `addedAt`) is persisted to `localStorage`.
- The feed renders a `<blockquote class="twitter-tweet">` per item, then loads `platform.twitter.com/widgets.js` to upgrade them into full embeds.

> **Note:** Embeds require an internet connection to fetch from Twitter/X. If a tweet is deleted or set to private, the embed will fall back to a plain link.

## ☁️ Optional sync to a private Gist

`localStorage` alone is per-browser and gets wiped if you clear site data. To make your archive durable, connect a GitHub Gist:

1. Create a **classic Personal Access Token** with **only** the `gist` scope:
   <https://github.com/settings/tokens/new?scopes=gist&description=Tweet+Scrapbook>
2. Click **Connect GitHub** in the app and paste the token.
3. The app finds (or creates) a private gist named `tweet-scrapbook.json` and keeps it in sync on every add/delete.

How it stays safe and durable:

- The token is stored **only in your browser's `localStorage`** — never committed to this repo or sent anywhere except GitHub's API. Revoke it anytime from GitHub settings.
- Because the gist is located **by filename**, clearing browser data and re-pasting the token reconnects to the *same* gist (no duplicates) and restores your archive.
- Local and remote archives are **merged by tweet id** on connect, so you never lose entries.
- The gist is **private** and only stores the same lightweight pointers (`tweetId`, `category`, `addedAt`) — no tweet content.

## 📄 License

MIT
