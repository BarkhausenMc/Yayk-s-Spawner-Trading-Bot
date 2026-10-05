require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} = require('discord.js');

const {
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis,
  addSpawner,
  deleteSpawner
} = require('./database');

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

initDefaultSpawner('💀 Skelly', 0, 0);
initDefaultSpawner('💥 Creeper', 0, 0);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

function formatMillions(millions) {
  return millions >= 1000 ? (millions / 1000) + 'B' : millions + 'M';
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'spawner-panel') {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
        flags: MessageFlags.Ephemeral
      });
    }

    const spawnerData = getAllSpawnerPreise();

    const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
    ).join('\n');

    const content =
      '```SPAWNER         🛒ANKAUF     💰VERKAUF\n' +
      '─────────────────────────────────────────────\n' +
      rows +
      '\n─────────────────────────────────────────────```';

    const spawnerPanelContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '# 🛒 • SPAWNER TRADING • 💰\n' +
          '*Yayks Spawner Trading*\n' +
          '*||Only Trusted Trader, Faire Preise 💜||*'
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(1)
          .setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
      );

    await interaction.reply({
      components: [spawnerPanelContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }

  if (interaction.commandName === 'preise-setzen') {
    const spawnerName = interaction.options.getString('spawner');
    const kaufpreis = interaction.options.getInteger('kauf');
    const verkaufspreis = interaction.options.getInteger('verkauf');

    const existingPrice = getSpawnerPreis(spawnerName);
    if (!existingPrice) {
      return interaction.reply({
        content: `❌ Spawner "${spawnerName}" existiert nicht. Nutze /spawner-hinzufuegen zuerst.`,
        flags: MessageFlags.Ephemeral
      });
    }

    updateSpawnerPreis(spawnerName, kaufpreis, verkaufspreis);

    await interaction.reply({
      content: `✅ Preise für ${spawnerName} aktualisiert!\n🛒 Kauf: ${formatMillions(kaufpreis)}\n💰 Verkauf: ${formatMillions(verkaufspreis)}`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'spawner-hinzufuegen') {
    const name = interaction.options.getString('name');
    const kauf = interaction.options.getInteger('kauf');
    const verkauf = interaction.options.getInteger('verkauf');

    const existingPrice = getSpawnerPreis(name);
    if (existingPrice) {
      return interaction.reply({
        content: `⚠️ "${name}" existiert bereits. Nutze /preise-setzen zum Aktualisieren.`,
        flags: MessageFlags.Ephemeral
      });
    }

    addSpawner(name, kauf, verkauf);

    await interaction.reply({
      content: `✅ Spawner "${name}" hinzugefügt!\n🛒 Kauf: ${formatMillions(kauf)}\n💰 Verkauf: ${formatMillions(verkauf)}`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'alle-preise') {
    const spawnerData = getAllSpawnerPreise();

    const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `**${spawner_name}** - 🛒 ${formatMillions(kaufpreis)} | 💰 ${formatMillions(verkaufspreis)}`
    ).join('\n');

    const content =
      '# 💹 • Alle Spawner Preise\n\n' +
      '```css\n' +
      rows +
      '\n```';

    await interaction.reply({
      content,
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'spawner-loeschen') {
    const spawnerName = interaction.options.getString('spawner');

    const existingPrice = getSpawnerPreis(spawnerName);
    if (!existingPrice) {
      return interaction.reply({
        content: `❌ Spawner "${spawnerName}" existiert nicht.`,
        flags: MessageFlags.Ephemeral
      });
    }

    deleteSpawner(spawnerName);

    await interaction.reply({
      content: `🗑️ Spawner "${spawnerName}" wurde gelöscht!`,
      flags: MessageFlags.Ephemeral
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);