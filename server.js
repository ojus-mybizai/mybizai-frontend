// server.js (CommonJS version)
const { createServer } = require('https');
const { readFileSync } = require('fs');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync('./localhost+2-key.pem'),
  cert: readFileSync('./localhost+2.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    handle(req, res);
  }).listen(3000, () => {
    console.log('> ✅ Server ready on https://localhost:3000');
  });
});
