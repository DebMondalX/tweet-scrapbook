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
- **Local & Private** — everything is saved in your browser's `localStorage`. No account, no server, no tracking.

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

## 📄 License

MIT
