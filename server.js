const http = require('http');
const zlib = require('zlib');
const mediumJSONFeed = require('./index.js');

const port = process.env.PORT || 3000;
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Content-Encoding': 'gzip'
};

http.createServer((req, res) => {
  if (req.method !== 'GET' || ['/robots.txt', '/favicon.ico'].indexOf(req.url) !== -1) {
    res.writeHead(204);
    return res.end();
  }

  console.log(`> GET: '${req.url}' --- ${new Date()}`);

  mediumJSONFeed(req.url, data => {
    res.writeHead(data.status || 500, headers);
    const gzip = zlib.createGzip();
    const json = JSON.stringify(data);
    gzip.end(json); // Compress the JSON string and send it to the client
    gzip.pipe(res);
  });

}).listen(port);

console.info('>>> Server listening on port', port, '\n');
