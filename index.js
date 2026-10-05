require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ActionRow,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis,
  resetDatabase,
  savePanelMessage,
  getPanelMessage
} = require('./database');


resetDatabase();
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

async function buildPanel() {
  const spawnerData = getAllSpawnerPreise();
  const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
    `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
  ).join('\n');

//====================
//Spawner Panel Conatiner
//====================

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 🛒 • SPAWNER TRADING • 💰\n' +
        '*Yayks Spawner Trading*\n' +
        '*||Only Trusted Trader, Faire Preise 💜||*' +
        '\n\n```SPAWNER      🛒KAUFEN     💰VERKAUF\n' +
        '─────────────────────────────────────────────\n' +
        rows +
        '\n─────────────────────────────────────────────```'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )
    .addTextDisplayComponents()
      new TextDisplayBuilder().setContent(
        '💰 **VERKAUFEN** — Du **verkaufst** uns deine Spawner\n' +
        '🛒 **ANKAUF** — Du **kaufst** unsere Spawner'
      )
    .addSeparatorComponents()
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Klicke unten auf den `💰 VERKAUFEN` oder `🛒 ANKAUF` Button,\num einen Trade zu Starten.'
      )
    )

    const spawnerBuyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('spawner-kaufen')
        .setLabel('Spawner Kaufen')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('spawner-verkaufen')
        .setLabel('Spawner Verkaufen')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    )
    return [container, spawnerBuyRow];
}


//====================
//Spawner Panel Aktualisieren
//====================
async function updateExistingPanel(guildId) {
  const savedPanel = getPanelMessage(guildId);
  if (!savedPanel) {
    return null;
  }

  try {
    const channel = client.channels.cache.get(savedPanel.channel_id);
    if (!channel || !channel.isTextBased()) {
      return null;
    }

    const message = await channel.messages.fetch(savedPanel.message_id);
    if (!message) {
      return null;
    }

    const container = await buildPanel();
    await message.edit({ components: [container] });
    return true;
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Panels:', error);
    return null;
  }
}

//====================
//Spawner Panel in Channel senden
//====================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'spawner-panel') {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
        flags: MessageFlags.Ephemeral
      });
    }

    const container = await buildPanel();

    const reply = await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true
    });

    savePanelMessage(interaction.guildId, interaction.channelId, reply.id);
    await interaction.deleteReply();
  }

//====================
//Spawner Preise setzen
//====================

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
      content: `✅ Preise für ${spawnerName} aktualisiert!\n🛒 Kauf: ${formatMillions(kaufpreis)}\n💰 Verkauf: ${formatMillions(verkaufspreis)}`,
      flags: MessageFlags.Ephemeral
    });

    updateExistingPanel(interaction.guildId);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);