require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('spawner-panel')
    .setDescription('Schicket das Spawner Panel in den Channel'),
  new SlashCommandBuilder()
    .setName('preise-setzen')
    .setDescription('Preise für einen Spawner anpassen')
    .addStringOption(option =>
      option.setName('spawner')
        .setDescription('Name des Spawners')
        .setRequired(true)
        .setChoices(
          { name: '💀 Skelly', value: '💀 Skelly' },
          { name: '💥 Creeper', value: '💥 Creeper' }
        )
    )
    .addIntegerOption(option =>
      option.setName('kauf')
        .setDescription('Neuer Kaufpreis (in Millionen, z.B. 14 für 14M)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('verkauf')
        .setDescription('Neuer Verkaufspreis (in Millionen, z.B. 12 für 12M)')
        .setRequired(true)
    )
];

const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log('Guild Slash Command registriert.');
  } catch (error) {
    console.error(error);
  }
})();