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
  GUILD_ID: process.env.GUILD_ID
};

if (!config.TOKEN || !config.CLIENT_ID) {
  console.error('❌ TOKEN and CLIENT_ID must be set');
}

// ------------------ EXPRESS WEB ------------------
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
  <html>
    <body style="font-family:Arial;padding:24px">
      <h2>QR Generator</h2>
      <form method="POST" action="/api/qr">
        <input name="text" placeholder="Text or URL" required />
        <button type="submit">Generate</button>
      </form>
    </body>
  </html>
  `);
});

app.post('/api/qr', async (req, res) => {
  try {
    const text = req.body.text;
    const buffer = await QRCode.toBuffer(text, { width: 400 });
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('QR failed');
  }
});

app.post('/api/qr-pdf', async (req, res) => {
  try {
    const text = req.body.text || req.query.text;
    const qr = await QRCode.toBuffer(text, { width: 400 });

    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(18).text('QR Code', { align: 'center' });
    doc.moveDown();
    doc.image(qr, { align: 'center' });
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('PDF failed');
  }
});

// ------------------ DISCORD BOT ------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
    }
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Command error', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Command error', ephemeral: true });
    }
  }
});

// ------------------ START ------------------
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

client.login(config.TOKEN)
  .then(() => console.log('✅ Discord login successful'))
  .catch(err => {
    console.error('⚠️ Discord login failed (bot will retry on redeploy)');
  });

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});


