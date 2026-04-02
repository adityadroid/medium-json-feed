const https = require("https");

/**
 * Fetches a Medium article's full content from the RSS feed.
 * The <content:encoded> tag in the RSS feed contains the complete HTML.
 */
const fetchArticle = (slug, callback) => {
  const feedUrl = "https://medium.com/feed/@adityadroid";

  return new Promise((resolve, reject) => {
    https
      .get(
        feedUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://medium.com/",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            const result = { status: res.statusCode, error: res.statusMessage };
            callback instanceof Function && callback(result);
            return reject(result);
          }

          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const article = extractArticle(data, slug);

              if (!article) {
                const result = {
                  status: 404,
                  error: `Article not found: ${slug}`,
                };
                callback instanceof Function && callback(result);
                return reject(result);
              }

              const result = { status: 200, response: article };
              callback instanceof Function && callback(result);
              resolve(result);
            } catch (error) {
              const result = { status: 500, error: error.message };
              callback instanceof Function && callback(result);
              reject(result);
            }
          });
        }
      )
      .on("error", (error) => {
        const result = { status: 500, error: error.message };
        callback instanceof Function && callback(result);
        reject(result);
      });
  });
};

/**
 * Extract a specific article from the RSS XML by matching its slug
 */
function extractArticle(xml, slug) {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const link = extractTag(itemXml, "link");

    // Match by slug appearing in the link URL
    if (link && link.includes(slug)) {
      const title = extractTag(itemXml, "title");
      const contentEncoded = extractTag(itemXml, "content:encoded");
      const pubDate = extractTag(itemXml, "pubDate");
      const author = extractTag(itemXml, "dc:creator");
      const description = extractTag(itemXml, "description");

      // Extract subtitle: first <p> text from content, truncated
      const subtitle = extractSubtitle(contentEncoded);

      // Extract cover image from first <img> tag
      const coverImage = extractCoverImage(contentEncoded);

      // Clean the HTML: remove Medium-specific tracking, normalize
      const html = cleanHtml(contentEncoded);

      return {
        title,
        subtitle,
        author,
        publishedAt: pubDate ? new Date(pubDate).getTime() : 0,
        coverImage,
        slug: link,
        html,
      };
    }
  }

  return null;
}

/**
 * Extract tag content from XML string
 */
function extractTag(str, tag) {
  // Handle namespaced tags like content:encoded and dc:creator
  const start = str.indexOf(`<${tag}`);
  if (start === -1) return "";
  const endTag = str.indexOf(`</${tag}>`, start);
  if (endTag === -1) return "";
  let content = str.substring(str.indexOf(">", start) + 1, endTag);
  content = content.replace(/<!\[CDATA\[|\]\]>/g, "");
  return content.trim();
}

/**
 * Extract subtitle from first <p> in content HTML
 */
function extractSubtitle(html) {
  if (!html) return "";
  const pMatch = html.match(/<p>([^<]+)<\/p>/);
  if (pMatch) return pMatch[1].replace(/<[^>]+>/g, "").substring(0, 200);
  return html.replace(/<[^>]+>/g, "").substring(0, 200);
}

/**
 * Extract cover image URL from content HTML
 */
function extractCoverImage(html) {
  if (!html) return "";
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : "";
}

/**
 * Clean Medium HTML for rendering on own site
 * - Removes tracking pixels
 * - Extracts gist/media URLs from empty iframes
 * - Preserves whitespace in code blocks
 * - Preserves semantic HTML (p, h3, h4, img, a, figure, iframe, pre, code, ul, ol, li, blockquote)
 */
function cleanHtml(html) {
  if (!html) return "";

  let cleaned = html
    // Remove Medium tracking pixels (1x1 images)
    .replace(
      /<img[^>]*(?:height="1"[^>]*width="1"|width="1"[^>]*height="1")[^>]*>/g,
      ""
    )
    // Remove Medium stat tracking images
    .replace(/<img[^>]*medium\.com\/_\/stat[^>]*>/g, "")
    // Remove any script tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
    // Remove noscript tags
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/g, "")
    // Fix Twitter links where Medium's noscript text leaked as link text
    .replace(
      /<a href="([^"]*twitter\.com\/[^"]*)">JavaScript is not available\.<\/a>/g,
      (match, url) => {
        const handle = url.match(/twitter\.com\/([^\/?#]+)/)?.[1] || "Twitter";
        return `<a href="${url}">@${handle}</a>`;
      }
    )
    // Remove empty paragraphs Medium sometimes adds
    .replace(/<p>\s*<\/p>/g, "")
    // Remove Medium's image wrapper divs but keep the img
    .replace(/<div class="aspect-ratio[^"]*"[^>]*>/g, "")
    .replace(/<\/div>\s*(?=<\/figure>)/g, "");

  // Extract URLs from empty iframes (Medium RSS strips iframe src for gists/embeds)
  // These iframes have src="" but contain <a> tags with the real URL
  cleaned = cleaned.replace(
    /<iframe[^>]*src=""[^>]*>[\s\S]*?<\/iframe>/g,
    (iframeMatch) => {
      // Try to find a gist URL in the inner <a> tag
      const gistLinkMatch = iframeMatch.match(
        /<a[^>]*href="(https?:\/\/gist\.github\.com[^"]*)"[^>]*>/
      );
      if (gistLinkMatch) {
        return `<a href="${gistLinkMatch[1]}" class="gist-embed">${gistLinkMatch[1]}</a>`;
      }

      // Try to find any media URL in the inner <a> tag
      const mediaLinkMatch = iframeMatch.match(
        /<a[^>]*href="(https?:\/\/medium\.com\/media\/[^"]*)"[^>]*>/
      );
      if (mediaLinkMatch) {
        // For medium media embeds, try to extract the actual embedded URL
        try {
          const mediaUrl = new URL(mediaLinkMatch[1]);
          // Medium media URLs often redirect to the actual content
          return `<a href="${mediaLinkMatch[1]}" class="media-embed">View embedded content</a>`;
        } catch {
          return `<a href="${mediaLinkMatch[1]}" class="media-embed">View embedded content</a>`;
        }
      }

      // If no recognizable URL found, remove the empty iframe
      return "";
    }
  );

  // Normalize whitespace but preserve it inside <pre> and <code> blocks
  // First, extract and protect code blocks
  const codeBlocks = [];
  cleaned = cleaned.replace(/<(pre|code)[^>]*>[\s\S]*?<\/\1>/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Normalize whitespace in non-code content
  cleaned = cleaned.replace(/\s+/g, " ").replace(/> </g, ">\n<").trim();

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    cleaned = cleaned.replace(`__CODE_BLOCK_${i}__`, block);
  });

  return cleaned;
}

module.exports = fetchArticle;
