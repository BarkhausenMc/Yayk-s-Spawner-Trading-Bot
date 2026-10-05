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
  resetDatabase
} = require('./database');

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

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
  const kaufpreis = interaction.options.getNumber('kauf');
  const verkaufspreis = interaction.options.getNumber('verkauf');

  console.log(`🔄 UPDATE: ${spawnerName} auf Kauf=${kaufpreis}M, Verkauf=${verkaufspreis}M`);

  const result = updateSpawnerPreis(spawnerName, kaufpreis, verkaufspreis);
  console.log(`✅ Update Rows affected: ${result.changes}`);

  const existingPrice = getSpawnerPreis(spawnerName);
  console.log(`📖 Neuladen aus DB: Kauf=${existingPrice.kaufpreis}, Verkauf=${existingPrice.verkaufspreis}`);

  if (!existingPrice) {
    return interaction.reply({
      content: `❌ Spawner "${spawnerName}" existiert nicht.`,
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.reply({
    content: `✅ Preise für ${spawnerName} aktualisiert!\n🛒 Kauf: ${formatMillions(kaufpreis)}\n💰 Verkauf: ${formatMillions(verkaufspreis)}`,
    flags: MessageFlags.Ephemeral
  });
}
});

console.log('📊 DB Reset durchgeführt');
console.log('💀 Skelly angelegt:', getSpawnerPreis('💀 Skelly'));
console.log('💥 Creeper angelegt:', getSpawnerPreis('💥 Creeper'));
console.log('Alle Spawner:', getAllSpawnerPreise());
console.log('\n=== DATABASE STATUS ===');
console.log('Alle Spawner in DB:', getAllSpawnerPreise());
console.log('=======================\n');

client.login(process.env.DISCORD_BOT_TOKEN);