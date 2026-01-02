// index.js  -- replace your current index.js with this
const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const PORT = process.env.PORT || 3000;
const config = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID // optional but useful for deploy scripts
};

if (!config.TOKEN || !config.CLIENT_ID) {
  console.error('Error: TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ------------------ Web endpoints ------------------
// GET / -> small form to create PNG
app.get('/', (req, res) => {
  res.send(`
  <html>
    <head><meta charset="utf-8"><title>QR-BOT - Web Generator</title></head>
    <body style="font-family:Arial,Helvetica,sans-serif;padding:24px;">
      <h2>QR Generator</h2>
      <form method="POST" action="/api/qr" style="max-width:600px;">
        <label>Text or URL:<br/>
          <input name="text" style="width:100%;padding:8px" placeholder="https://example.com" required />
        </label><br/><br/>
        <label>Foreground color (hex):<br/>
          <input name="fg" placeholder="#000000" style="width:200px;padding:6px" />
        </label>
        <label style="margin-left:12px">Background color (hex):<br/>
          <input name="bg" placeholder="#ffffff" style="width:200px;padding:6px" />
        </label><br/><br/>
        <button type="submit" style="padding:8px 12px">Generate QR</button>
      </form>
      <p>After submitting the browser will download <code>qrcode.png</code>.</p>
    </body>
  </html>
  `);
});

// POST /api/qr -> returns PNG QR
app.post('/api/qr', async (req, res) => {
  try {
    const text = req.body.text || req.query.text;
    if (!text) return res.status(400).send('Missing text');
    const fg = req.body.fg || req.query.fg || '#000000';
    const bg = req.body.bg || req.query.bg || '#ffffff';
    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      color: { dark: fg, light: bg },
      width: 400,
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="qrcode.png"');
    return res.send(buffer);
  } catch (err) {
    console.error('QR web endpoint error:', err);
    return res.status(500).send('Failed to generate QR');
  }
});

// POST /api/qr-pdf -> returns a PDF with embedded QR
app.post('/api/qr-pdf', async (req, res) => {
  try {
    const text = (req.body && req.body.text) || req.query.text;
    if (!text) return res.status(400).send('Missing text parameter');
    const title = (req.body && req.body.title) || req.query.title || 'QR Code PDF';

    const qrBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 800,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const endPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.addPage({ size: 'A4', margin: 72 });
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).text(`QR for: ${text}`, { align: 'center' });
    doc.moveDown(1);

    const imgWidth = 320;
    const imgX = (doc.page.width - imgWidth) / 2;
    doc.image(qrBuffer, imgX, doc.y, { width: imgWidth });

    doc.moveDown(2);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();
    const pdfBuffer = await endPromise;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="qrcode.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('api/qr-pdf error:', err);
    return res.status(500).send('Failed to generate PDF');
  }
});
// ------------------ End web endpoints ------------------

// ------------------ Discord bot ------------------
// Use only non-privileged intents unless you need them.
// If you add MessageContent or GuildMembers later, you MUST enable them in the Developer Portal.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds // slash commands only need this
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
let commandFiles = [];
if (fs.existsSync(commandsPath)) {
  commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
}
console.log('Loading command files:', commandFiles);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name} (from ${file})`);
    } else {
      console.warn(`Skipping ${file} — missing data or execute`);
    }
  } catch (err) {
    console.error(`Failed to load command ${file}:`, err);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found`);
    return;
  }
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

// Start web server and login
app.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

client.login(config.TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});

// global unhandled rejection logging
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

module.exports = config;

