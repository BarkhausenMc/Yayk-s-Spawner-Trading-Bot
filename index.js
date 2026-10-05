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
  getAllSpawnerNamen
} = require('./database');

initDefaultSpawner('Blaze', 15000, 12000);
initDefaultSpawner('Zombie', 8000, 6000);
initDefaultSpawner('Skeleton', 9000, 7000);
initDefaultSpawner('Enderman', 25000, 20000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'spawner-panel') {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
        flags: MessageFlags.Ephemeral
      });
    }

    const spawnerData = getAllSpawnerPreise();

    if (spawnerData.length === 0) {
      return interaction.reply({
        content: 'Keine Spawner in der Datenbank gefunden.',
        flags: MessageFlags.Ephemeral
      });
    }

    const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `${spawner_name.padEnd(12)}${('🛒' + kaufpreis).padEnd(14)}💰${verkaufspreis}`
    ).join('\n');

    const content =
      '```SPAWNER     🛒ANKAUF     💰VERKAUF\n' +
      '────────────────────────────────────\n' +
      rows +
      '\n────────────────────────────────────```';

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
      content: `✅ Preise für ${spawnerName} aktualisiert!\n🛒 Kauf: ${kaufpreis}\n💰 Verkauf: ${verkaufspreis}`,
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
      content: `✅ Spawner "${name}" hinzugefügt!\n🛒 Kauf: ${kauf}\n💰 Verkauf: ${verkauf}`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'alle-preise') {
    const spawnerData = getAllSpawnerPreise();

    if (spawnerData.length === 0) {
      return interaction.reply({
        content: 'Keine Spawner in der Datenbank gefunden.',
        flags: MessageFlags.Ephemeral
      });
    }

    const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `**${spawner_name}** - 🛒 ${kaufpreis} | 💰 ${verkaufspreis}`
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
});

client.login(process.env.DISCORD_BOT_TOKEN);