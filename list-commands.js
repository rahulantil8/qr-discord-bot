require('dotenv').config();
const { REST, Routes } = require('discord.js');

(async () => {
  const TOKEN = process.env.TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID;

  if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error("? Missing TOKEN / CLIENT_ID / GUILD_ID in .env file");
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    const commands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    console.log("? Registered commands in guild:");
    console.table(commands.map(c => ({ name: c.name, id: c.id })));
  } catch (err) {
    console.error("??  Failed to list commands:", err);
  }
})();
