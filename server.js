const http = require('http');
const zlib = require('zlib'); // Require the zlib module
const mediumJSONFeed = require('./index.js');

const port = process.env.PORT || 3000;
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Content-Encoding': 'gzip' // Add the Content-Encoding header to indicate gzip compression
};

http.createServer((req, res) => {
  if (req.method !== 'GET' || ['/robots.txt', '/favicon.ico'].indexOf(req.url) !== -1) {
    res.writeHead(204);
    return res.end();
  }

  console.log(`> GET: '${req.url}' --- ${new Date()}`);

  mediumJSONFeed(req.url, data => {
    res.writeHead(data.status || 500, headers);
    const gzip = zlib.createGzip(); // Create a gzip transform stream
    data.pipe(gzip).pipe(res); // Use the gzip stream to compress the response data
  });

}).listen(port);

console.info('>>> Server listening on port', port, '\n');
