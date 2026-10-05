require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis
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
  if (millions >= 1000) {
    return (millions / 1000).toFixed(1) + 'B';
  }
  if (millions % 1 === 0) {
    return millions + 'M';
  }
  return millions.toFixed(1) + 'M';
}

function buildPanelContent() {
  const spawnerData = getAllSpawnerPreise();
  const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
    `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
  ).join('\n');

  const header = new ContainerBuilder()
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
    );

  const table = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '```SPAWNER         🛒ANKAUF     💰VERKAUF\n' +
        '─────────────────────────────────────────────\n' +
        rows +
        '\n─────────────────────────────────────────────```'
      )
    );

  const refreshButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_panel')
        .setLabel('↻ Aktualisieren')
        .setStyle(ButtonStyle.Primary)
    );

  return { header, table, refreshButton };
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  if (interaction.isButton() && interaction.customId === 'refresh_panel') {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { header, table, refreshButton } = buildPanelContent();

    await interaction.update({
      components: [header, table, refreshButton]
    });
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'spawner-panel') {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({
          content: 'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
          flags: MessageFlags.Ephemeral
        });
      }

      const { header, table, refreshButton } = buildPanelContent();

      await interaction.reply({
        components: [header, table, refreshButton],
        flags: MessageFlags.IsComponentsV2
      });
    }

    if (interaction.commandName === 'preise-setzen') {
      const spawnerName = interaction.options.getString('spawner');
      const kaufpreis = interaction.options.getNumber('kauf');
      const verkaufspreis = interaction.options.getNumber('verkauf');

      const existingPrice = getSpawnerPreis(spawnerName);
      if (!existingPrice) {
        return interaction.reply({
          content: `❌ Spawner "${spawnerName}" existiert nicht.`,
          flags: MessageFlags.Ephemeral
        });
      }

      updateSpawnerPreis(spawnerName, kaufpreis, verkaufspreis);

      await interaction.reply({
        content: `✅ Preise für ${spawnerName} aktualisiert!\n🛒 Kauf: ${formatMillions(kaufpreis)}\n💰 Verkauf: ${formatMillions(verkaufspreis)}\n\n💡 Nutze den ↻ Aktualisieren-Button im Panel, um die Werte live zu sehen!`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);