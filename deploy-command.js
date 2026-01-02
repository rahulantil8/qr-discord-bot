/* deploy-command.js */
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // load .env

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // for instant guild registration

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Error: TOKEN, CLIENT_ID and GUILD_ID must be set in .env before deploying commands.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  console.error('Error: commands folder not found:', commandsPath);
  process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
console.log('Found command files:', commandFiles);

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command && command.data && typeof command.data.toJSON === 'function') {
      commands.push(command.data.toJSON());
      console.log(`Loaded command: ${file} -> ${command.data.name || '(no name)'}`);
    } else {
      console.warn(`Skipping ${file} — missing data.toJSON()`);
    }
  } catch (err) {
    console.error(`Failed to load ${file}:`, err);
  }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands to guild ${GUILD_ID}.`);
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    process.exit(0);
  } catch (error) {
    console.error('Deploy error:', error);
    process.exit(1);
  }
})();
