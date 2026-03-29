const https = require('https');

const parseRSS = (xml) => {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  const extractTag = (str, tag) => {
    const start = str.indexOf(`<${tag}`);
    if (start === -1) return '';
    const endTag = str.indexOf('</' + tag + '>', start);
    if (endTag === -1) return '';
    let content = str.substring(str.indexOf('>', start) + 1, endTag);
    content = content.replace(/<!\[CDATA\[|\]\]>/g, '');
    return content.trim();
  };

  const extractSubtitle = (str, tag) => {
    const content = extractTag(str, tag);
    if (!content) return '';
    const pMatch = content.match(/<p>([^<]+)<\/p>/);
    if (pMatch) return pMatch[1].replace(/<[^>]+>/g, '');
    const plainText = content.replace(/<[^>]+>/g, '');
    return plainText.substring(0, 200);
  };
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, 'title'),
      subtitle: extractSubtitle(itemXml, 'content:encoded'),
      link: extractTag(itemXml, 'link'),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate'),
      guid: extractTag(itemXml, 'guid'),
      author: extractTag(itemXml, 'author'),
      categories: []
    });
  }
  
  return items;
};

const fail = (status, error, reject, callback) => {
  const result = { status, error };
  callback instanceof Function && callback(result, result);
  reject(result);
};

module.exports = (endpoint = '/', callback) => {
  if (endpoint.charAt(0) !== '/') {
    endpoint = '/' + endpoint;
  }

  const url = `https://medium.com/feed${endpoint}`;
  console.log(url);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://medium.com/',
      }
    }, res => {
      if (callback && callback.write instanceof Function) {
        return res.pipe(callback);
      }

      res.statusCode === 200 || fail(res.statusCode, res.statusMessage, reject, callback);

      let data = '';

      res.on('data', chunk => (data += chunk));

      res.on('end', () => {
        try {
          const posts = parseRSS(data);

          if (posts && posts.length > 0) {
            const result = { status: 200, response: posts };
            callback instanceof Function && callback(result);
            resolve(result);
          } else {
            fail(500, 'Could not parse the RSS feed.', reject, callback);
          }

        } catch (error) {
          fail(500, error.message, reject, callback);
        }
      });
    });

    req.on('error', error => fail(500, error.message, reject, callback));
  });
};
