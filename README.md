# Medium JSON Feed

> Get [Medium](https://medium.com/) latest articles in JSON format

Medium's public API is quite limited and it is not possible to fetch data from browsers due to [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) issue. Use this package in your server to get JSON article list from Medium or fork and deploy this minimum server to Heroku or another PaaS.

## Installation

```
npm install medium-json-feed --save
```

## Usage

Gets the user/publication name and an optional callback or stream. Returns a promise.

```typescript
mediumJSONFeed(endpoint: string, callback?: Function | Stream): Promise
```

Simple example:

```javascript
const mediumJSONFeed = require('medium-json-feed');

// Usernames start with '@'
mediumJSONFeed('@my-user-name')
  .then(data => ...)
  .catch(data => ...);

// Publication names without '@'
mediumJSONFeed('my-publication-name', data => ...);

// Medium's top page (trending posts)
mediumJSONFeed().then(data => ...);
```

Other endpoint examples are `@user-name/latest`, `publication-name/latest` or `publication-name/trending`.

The `data` response contains:

* `data.status`: HTTP status code (**number**).
* `data.error`: Error message if exists (**string**).
* `data.response`: List of found articles (**Array**). The format is the one returned by Medium. Inspect `data.response[...].content` and `data.response[...].virtuals` for useful information.

To get the full raw response given by Medium, provide a stream:

```javascript
// Raw stream pipe to stdout
mediumJSONFeed('@my-user-name', process.stdout);

// Raw stream pipe to server's response
mediumJSONFeed('@my-user-name', response);
```

***Note**: the raw output will likely contain random characters at the beginning of the string that break JSON format.*

For a full example, see `server.js` file.

## Server API

Run the server with:

```bash
npm start
```

The server listens on port `3000` by default (override with `PORT` env variable).

### Endpoints

#### `GET /@username`

Fetch latest articles for a Medium user.

**Example:** `http://localhost:3000/@adityadroid`

**Response:**

```json
{
  "status": 200,
  "response": [
    {
      "title": "Article Title",
      "subtitle": "First paragraph text...",
      "link": "https://medium.com/@user/article-slug",
      "description": "Article description",
      "pubDate": "Mon, 01 Jan 2024 00:00:00 GMT",
      "guid": "https://medium.com/p/abc123",
      "author": "Author Name",
      "categories": []
    }
  ]
}
```

#### `GET /tag/tagname`

Fetch articles by tag.

**Example:** `http://localhost:3000/tag/javascript`

#### `GET /article/:slug`

Fetch full article content by slug. Returns cleaned HTML with Medium tracking removed and media redirects resolved.

**Example:** `http://localhost:3000/article/my-article-slug`

**Response:**

```json
{
  "status": 200,
  "response": {
    "title": "Article Title",
    "subtitle": "First paragraph text...",
    "author": "Author Name",
    "publishedAt": 1704067200000,
    "coverImage": "https://miro.medium.com/...",
    "slug": "https://medium.com/@user/my-article-slug",
    "html": "<p>Cleaned article HTML...</p>"
  }
}
```

### Response Format

All endpoints return gzip-compressed JSON with CORS enabled.

| Field | Type | Description |
|-------|------|-------------|
| `status` | number | HTTP status code |
| `error` | string | Error message (only on failure) |
| `response` | object/array | Article data or list of articles |

## Deploying

1. Clone this repo.
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Set `PORT` env variable to override default port `3000`.
