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
    )
    .addIntegerOption(option =>
      option.setName('kauf')
        .setDescription('Neuer Kaufpreis')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('verkauf')
        .setDescription('Neuer Verkaufspreis')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('spawner-hinzufuegen')
    .setDescription('Neuen Spawner zur Datenbank hinzufügen')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name des Spawners')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('kauf')
        .setDescription('Anfangskaufpreis')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('verkauf')
        .setDescription('Anfangsverkaufspreis')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('alle-preise')
    .setDescription('Zeigt alle gespeicherten Spawner Preise')
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