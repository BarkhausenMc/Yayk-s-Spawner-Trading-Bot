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
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
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

function buildPanel() {
  const spawnerData = getAllSpawnerPreise();

  const rows = spawnerData.map(({ spawner_name, kaufpreis, verkaufspreis }) =>
    `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
  ).join('\n');

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
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '💰 **VERKAUFEN** — Du **verkaufst** uns deine Spawner\n' +
        '🛒 **ANKAUF** — Du **kaufst** unsere Spawner'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Klicke unten auf den `💰 VERKAUFEN` oder `🛒 ANKAUF` Button,\num einen Trade zu Starten.'
      )
    );

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
  );

  return { container, spawnerBuyRow };
}

async function updateExistingPanel(guildId) {
  const savedPanel = getPanelMessage(guildId);

  if (!savedPanel) {
    return false;
  }

  try {
    const channel = client.channels.cache.get(savedPanel.channel_id);

    if (!channel || !channel.isTextBased()) {
      return false;
    }

    const message = await channel.messages.fetch(savedPanel.message_id);

    if (!message) {
      return false;
    }

    const { container, spawnerBuyRow } = buildPanel();

    await message.edit({
      components: [container, spawnerBuyRow]
    });

    return true;
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Panels:', error);
    return false;
  }
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'spawner-panel') {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { container, spawnerBuyRow } = buildPanel();

    const response = await interaction.reply({
      components: [container, spawnerBuyRow],
      flags: MessageFlags.IsComponentsV2,
      withResponse: true
    });

    const message = response.resource?.message;

    if (message) {
      savePanelMessage(
        interaction.guildId,
        interaction.channelId,
        message.id
      );
    }

    return;
  }
});

client.on('interactionCreate', async (interaction) => {
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

    updateSpawnerPreis(
      spawnerName,
      kaufpreis,
      verkaufspreis
    );

    await interaction.reply({
      content:
        `✅ Preise für ${spawnerName} aktualisiert!\n` +
        `🛒 Kauf: ${formatMillions(kaufpreis)}\n` +
        `💰 Verkauf: ${formatMillions(verkaufspreis)}`,
      flags: MessageFlags.Ephemeral
    });



    await updateExistingPanel(interaction.guildId);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'spawner-kaufen') {
      const spawnerData = getAllSpawnerPreise();

      const spawnerSelect = new StringSelectMenuBuilder()
        .setCustomId('spawner-kaufen-select')
        .setPlaceholder('Wähle einen Spawner aus')
        .addOptions(
          spawnerData.map(({ spawner_name, kaufpreis }) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(spawner_name)
              .setDescription(`🛒 Kaufpreis: ${formatMillions(kaufpreis)}`)
              .setValue(spawner_name)
          )
        );

      const spawnerSelectContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '# 🛒 • SPAWNER KAUFEN\n\n' +
            'Wähle den Spawner aus, den du kaufen möchtest.'
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(spawnerSelect)
        );

      return interaction.reply({
        components: [spawnerSelectContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    if (interaction.customId === 'spawner-verkaufen') {
      const spawnerData = getAllSpawnerPreise();

      const spawnerSelect = new StringSelectMenuBuilder()
        .setCustomId('spawner-verkaufen-select')
        .setPlaceholder('Wähle einen Spawner aus')
        .addOptions(
          spawnerData.map(({ spawner_name, verkaufspreis }) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(spawner_name)
              .setDescription(`💰 Verkaufspreis: ${formatMillions(verkaufspreis)}`)
              .setValue(spawner_name)
          )
        );

      const spawnerSelectContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '# 💰 • SPAWNER VERKAUFEN\n\n' +
            'Wähle den Spawner aus, den du verkaufen möchtest.'
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(spawnerSelect)
        );

      return interaction.reply({
        components: [spawnerSelectContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'spawner-kaufen-select') {
      const spawnerName = interaction.values[0];

      const spawnerPreis = getSpawnerPreis(spawnerName);

      if (!spawnerPreis) {
        return interaction.reply({
          content: '❌ Dieser Spawner existiert nicht mehr.',
          flags: MessageFlags.Ephemeral
        });
      }

      const spawnerKaufenModal = new ModalBuilder()
        .setCustomId(`spawner-kaufen-modal-${spawnerName}`)
        .setTitle('Spawner Kaufen');

      const minecraftName = new TextInputBuilder()
        .setCustomId('minecraft-name')
        .setLabel('Wie lautet dein Minecraft Name?')
        .setPlaceholder('z.B. yayk')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const spawnerAnzahl = new TextInputBuilder()
        .setCustomId('spawner-anzahl')
        .setLabel('Wie viele Spawner möchtest du kaufen?')
        .setPlaceholder('z.B. 10')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      spawnerKaufenModal.addComponents(
        new ActionRowBuilder().addComponents(minecraftName),
        new ActionRowBuilder().addComponents(spawnerAnzahl)
      );

      return interaction.showModal(spawnerKaufenModal);
    }

    if (interaction.customId === 'spawner-verkaufen-select') {
      const spawnerName = interaction.values[0];

      const spawnerPreis = getSpawnerPreis(spawnerName);

      if (!spawnerPreis) {
        return interaction.reply({
          content: '❌ Dieser Spawner existiert nicht mehr.',
          flags: MessageFlags.Ephemeral
        });
      }

      const spawnerVerkaufenModal = new ModalBuilder()
        .setCustomId(`spawner-verkaufen-modal-${spawnerName}`)
        .setTitle('Spawner Verkaufen');

      const minecraftName = new TextInputBuilder()
        .setCustomId('minecraft-name')
        .setLabel('Wie lautet dein Minecraft Name?')
        .setPlaceholder('z.B. yayk')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const spawnerAnzahl = new TextInputBuilder()
        .setCustomId('spawner-anzahl')
        .setLabel('Wie viele Spawner möchtest du verkaufen?')
        .setPlaceholder('z.B. 10')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      spawnerVerkaufenModal.addComponents(
        new ActionRowBuilder().addComponents(minecraftName),
        new ActionRowBuilder().addComponents(spawnerAnzahl)
      );

      return interaction.showModal(spawnerVerkaufenModal);
    }
  }

  if (interaction.isModalSubmit()) {
    const minecraftName = interaction.fields.getTextInputValue('minecraft-name');
    const spawnerAnzahl = interaction.fields.getTextInputValue('spawner-anzahl');

   if (interaction.customId.startsWith('spawner-kaufen-modal-')) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const spawnerName = interaction.customId.replace(
    'spawner-kaufen-modal-',
    ''
  );

  const spawnerPreis = getSpawnerPreis(spawnerName);

  if (!spawnerPreis) {
    return interaction.editReply({
      content: '❌ Dieser Spawner existiert nicht mehr.'
    });
  }

  const anzahl = Number(spawnerAnzahl);

  if (!Number.isInteger(anzahl) || anzahl <= 0) {
    return interaction.editReply({
      content: '❌ Bitte gib eine gültige Anzahl ein.'
    });
  }

  const gesamtpreis = spawnerPreis.kaufpreis * anzahl;

  const thread = await interaction.channel.threads.create({
    name: `🛒 ${minecraftName} - ${anzahl} ${spawnerName}`,
    type: 12,
    autoArchiveDuration: 1440,
    reason: 'Spawner Kauf Anfrage'
  });

  await thread.members.add(interaction.user.id);

  const traderRole = interaction.guild.roles.cache.get(
    process.env.TRADER_ROLE_ID
  );

  if (traderRole) {
    for (const [memberId] of traderRole.members) {
      await thread.members.add(memberId);
    }
  }

const ticketKaufenContainer = new ContainerBuilder()
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '# 🛒 Spawner Kauf Anfrage'
    )
  )
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(1)
      .setDivider(true)
  )
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Minecraft Name:** ${minecraftName}\n` +
      `**Spawner:** ${spawnerName}\n` +
      `**Anzahl:** ${anzahl}\n` +
      `**Preis pro Spawner:** ${formatMillions(spawnerPreis.kaufpreis)}\n` +
      `**Gesamtpreis:** ${formatMillions(gesamtpreis)}\n` +
      `**Discord:** ${interaction.user}`
    )
  )
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(1)
      .setDivider(true)
  )
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      'Ein Trader wird sich gleich um deine Anfrage kümmern.'
    )
  );

await thread.send({
  components: [ticketKaufenContainer],
  flags: MessageFlags.IsComponentsV2
});


  const threadCreatedContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ Dein Trade Ticket wurde erstellt: ${thread}`
      )
    );

  await interaction.editReply({
    components: [threadCreatedContainer],
    flags: MessageFlags.IsComponentsV2
  });

  return;
}


   if (interaction.customId.startsWith('spawner-verkaufen-modal-')) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const spawnerName = interaction.customId.replace(
    'spawner-verkaufen-modal-',
    ''
  );

  const spawnerPreis = getSpawnerPreis(spawnerName);

  if (!spawnerPreis) {
    return interaction.editReply({
      content: '❌ Dieser Spawner existiert nicht mehr.'
    });
  }

  const anzahl = Number(spawnerAnzahl);

  if (!Number.isInteger(anzahl) || anzahl <= 0) {
    return interaction.editReply({
      content: '❌ Bitte gib eine gültige Anzahl ein.'
    });
  }

  const gesamtpreis = spawnerPreis.verkaufspreis * anzahl;

  const thread = await interaction.channel.threads.create({
    name: `💰 ${minecraftName} - ${anzahl} ${spawnerName}`,
    type: 12,
    autoArchiveDuration: 1440,
    reason: 'Spawner Verkauf Anfrage'
  });

  await thread.members.add(interaction.user.id);

  const traderRole = interaction.guild.roles.cache.get(
    process.env.TRADER_ROLE_ID
  );

  if (traderRole) {
    for (const [memberId] of traderRole.members) {
      await thread.members.add(memberId);
    }
  }

const ticketVerkaufContainer = new ContainerBuilder()
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '# 💰 Spawner Verkauf Anfrage'
    )
  )
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(1)
      .setDivider(true)
  )
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Minecraft Name:** ${minecraftName}\n` +
      `**Spawner:** ${spawnerName}\n` +
      `**Anzahl:** ${anzahl}\n` +
      `**Preis pro Spawner:** ${formatMillions(spawnerPreis.verkaufspreis)}\n` +
      `**Gesamtpreis:** ${formatMillions(gesamtpreis)}\n` +
      `**Discord:** ${interaction.user}`
    )
  )
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(1)
      .setDivider(true)
  )
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      'Ein Trader wird sich gleich um deine Anfrage kümmern.'
    )
  );

await thread.send({
  components: [ticketVerkaufContainer],
  flags: MessageFlags.IsComponentsV2
});


  const threadCreatedContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ Dein Trade Ticket wurde erstellt: ${thread}`
      )
    );

  await interaction.editReply({
    components: [threadCreatedContainer],
    flags: MessageFlags.IsComponentsV2
  });

  return;
}

  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
