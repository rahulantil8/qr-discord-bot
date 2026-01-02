const https = require('https');

https.get('https://discord.com', res => {
  console.log('statusCode:', res.statusCode);
  res.on('data', () => {}); // consume
  res.on('end', () => console.log('OK: request ended'));
}).on('error', err => {
  console.error('ERROR:', err);
});