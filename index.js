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
  savePanelMessage,
  getPanelMessage,
  getNextTradeNumber,

  createTrade,
  getTradeByThreadId,
  claimTrade,
  releaseTrade,
  markTradeBought,
  createCloseRequest,
  cancelCloseRequest,
  closeTrade
} = require('./database');


/* =========================================================
   DEFAULT SPAWNER
========================================================= */

initDefaultSpawner('💀 Skelly', 0, 0);
initDefaultSpawner('💥 Creeper', 0, 0);


/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});


/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function getSpawnerEmoji(spawnerName) {
  const emojis = {
    '💀 Skelly': '💀',
    '💥 Creeper': '💥'
  };

  return emojis[spawnerName] || '🔹';
}


function formatMillions(millions) {
  if (millions >= 1000) {
    return (millions / 1000).toFixed(1) + 'B';
  }

  if (millions % 1 === 0) {
    return millions + 'M';
  }

  return millions.toFixed(1) + 'M';
}


function isTrader(interaction) {
  return interaction.member?.roles?.cache?.has(
    process.env.TRADER_ROLE_ID
  );
}


function isCustomer(trade, interaction) {
  return trade.customer_id === interaction.user.id;
}


function canUseCloseButton(trade, interaction) {
  return (
    trade.customer_id === interaction.user.id ||
    trade.trader_id === interaction.user.id
  );
}


/* =========================================================
   TRADE CONTAINER
========================================================= */

function buildTradeContainer(trade) {

  let statusText = '';
  let statusInfo = '';
  let buttons = [];

  /*
   * OFFEN
   */

  if (trade.status === 'open') {

    statusText = '🟢 **Status:** Offen';

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-claim-${trade.thread_id}`)
        .setLabel('Claim')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`trade-close-${trade.thread_id}`)
        .setLabel('Abbrechen')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    ];
  }


  /*
   * ÜBERNOMMEN
   */

  else if (trade.status === 'claimed') {

    statusText = '🟡 **Status:** Übernommen';

    statusInfo =
      `👷 **Trader:** <@${trade.trader_id}>`;

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-bought-${trade.thread_id}`)
        .setLabel('Als gekauft')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`trade-release-${trade.thread_id}`)
        .setLabel('Freigeben')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`trade-close-${trade.thread_id}`)
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    ];
  }


  /*
   * SCHLIESSUNGSANFRAGE
   */

  else if (trade.status === 'close_requested') {

    statusText = '🟠 **Status:** Schließungsanfrage';

    statusInfo =
      `⚠️ <@${trade.close_requester_id}> möchte den Trade schließen.\n\n` +
      'Die andere Partei muss die Anfrage bestätigen.';

    buttons = [];
  }


  /*
   * GEKAUFT
   */

  else if (trade.status === 'bought') {

    statusText = '🟢 **Status:** Gekauft';

    statusInfo =
      `👷 **Trader:** <@${trade.trader_id}>\n\n` +
      '🔒 Trade abgeschlossen.\n' +
      'Das Ticket wird archiviert.';

    buttons = [];
  }


  /*
   * GESCHLOSSEN
   */

  else if (trade.status === 'closed') {

    statusText = '🔴 **Status:** Geschlossen';

    statusInfo =
      'Dieser Trade wurde geschlossen.';

    buttons = [];
  }


  const container = new ContainerBuilder()

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        trade.trade_type === 'buy'
          ? '# 🛒 • Spawner Kaufen\n' +
            `**🤝 • Handel #${trade.trade_number}**`
          : '# 💰 • Spawner Verkauf Anfrage\n' +
            `**🤝 • Handel #${trade.trade_number}**`
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**👤 Kunde:** <@${trade.customer_id}>\n` +
        `**🎮 ING:** \`${trade.minecraft_name}\`\n` +
        `${getSpawnerEmoji(trade.spawner_name)} **Spawner:** ${trade.spawner_name}`
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**📦 Menge:** ${trade.amount}\n` +
        `**💵 Preis/Stk:** ${formatMillions(trade.price_per_item)}\n` +
        `**💰 Gesamtpreis:** ${formatMillions(trade.total_price)}`
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${statusText}\n\n${statusInfo}`
      )
    );


  if (buttons.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(buttons)
    );
  }


  /*
   * Bei einer Schließungsanfrage
   * bekommt die andere Partei eigene Buttons.
   */

  if (trade.status === 'close_requested') {

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(

        new ButtonBuilder()
          .setCustomId(`trade-close-accept-${trade.thread_id}`)
          .setLabel('Annehmen')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`trade-close-deny-${trade.thread_id}`)
          .setLabel('Ablehnen')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)

      )
    );
  }


  return container;
}


/* =========================================================
   PANEL
========================================================= */

function buildPanel() {

  const spawnerData = getAllSpawnerPreise();

  const rows = spawnerData
    .map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
    )
    .join('\n');


  const container = new ContainerBuilder()

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 🛒 • SPAWNER TRADING • 💰\n' +
        '*Yayks Spawner Trading*\n' +
        '*||Only Trusted Trader, Faire Preise 💜||*\n\n' +

        '```SPAWNER      🛒KAUFEN     💰VERKAUF\n' +
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
        'Klicke unten auf den `💰 VERKAUFEN` oder `🛒 ANKAUF` Button,\n' +
        'um einen Trade zu starten.'
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


  return {
    container,
    spawnerBuyRow
  };
}


/* =========================================================
   PANEL AKTUALISIEREN
========================================================= */

async function updateExistingPanel(guildId) {

  const savedPanel = getPanelMessage(guildId);

  if (!savedPanel) {
    return false;
  }

  try {

    const channel = client.channels.cache.get(
      savedPanel.channel_id
    );

    if (!channel || !channel.isTextBased()) {
      return false;
    }

    const message = await channel.messages.fetch(
      savedPanel.message_id
    );

    const {
      container,
      spawnerBuyRow
    } = buildPanel();

    await message.edit({
      components: [
        container,
        spawnerBuyRow
      ]
    });

    return true;

  } catch (error) {

    console.error(
      'Fehler beim Aktualisieren des Panels:',
      error
    );

    return false;
  }
}


/* =========================================================
   INTERACTIONS
========================================================= */

client.on('interactionCreate', async interaction => {

  try {

    /* =====================================================
       SLASH COMMAND: SPAWNER PANEL
    ===================================================== */

    if (interaction.commandName === 'spawner-panel') {

      if (
        !interaction.member.roles.cache.has(
          process.env.ADMIN_ROLE_ID
        )
      ) {

        return interaction.reply({
          content:
            'Du hast keine Berechtigung, diesen Befehl zu nutzen.',
          flags: MessageFlags.Ephemeral
        });
      }


      const {
        container,
        spawnerBuyRow
      } = buildPanel();


      const response = await interaction.reply({
        components: [
          container,
          spawnerBuyRow
        ],
        flags: MessageFlags.IsComponentsV2,
        withResponse: true
      });


      const message =
        response.resource?.message;


      if (message) {

        savePanelMessage(
          interaction.guildId,
          interaction.channelId,
          message.id
        );
      }

      return;
    }


    /* =====================================================
       SLASH COMMAND: PREISE SETZEN
    ===================================================== */

    if (interaction.commandName === 'preise-setzen') {

      const spawnerName =
        interaction.options.getString('spawner');

      const kaufpreis =
        interaction.options.getNumber('kauf');

      const verkaufspreis =
        interaction.options.getNumber('verkauf');


      const existingPrice =
        getSpawnerPreis(spawnerName);


      if (!existingPrice) {

        return interaction.reply({
          content:
            `❌ Spawner "${spawnerName}" existiert nicht.`,
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


      await updateExistingPanel(
        interaction.guildId
      );

      return;
    }


    /* =====================================================
       BUTTONS
    ===================================================== */

    if (interaction.isButton()) {

      /* ===================================================
         SPAWNER KAUFEN
      =================================================== */

      if (
        interaction.customId === 'spawner-kaufen'
      ) {

        const spawnerData =
          getAllSpawnerPreise();


        const spawnerSelect =
          new StringSelectMenuBuilder()
            .setCustomId(
              'spawner-kaufen-select'
            )
            .setPlaceholder(
              'Wähle einen Spawner aus'
            )
            .addOptions(
              spawnerData.map(
                ({
                  spawner_name,
                  kaufpreis
                }) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(spawner_name)
                    .setDescription(
                      `🛒 Kaufpreis: ${formatMillions(kaufpreis)}`
                    )
                    .setValue(spawner_name)
              )
            );


        const container =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  '# 🛒 • SPAWNER KAUFEN\n\n' +
                  'Wähle den Spawner aus, den du kaufen möchtest.'
                )
            )
            .addActionRowComponents(
              new ActionRowBuilder()
                .addComponents(spawnerSelect)
            );


        return interaction.reply({
          components: [container],
          flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral
        });
      }


      /* ===================================================
         SPAWNER VERKAUFEN
      =================================================== */

      if (
        interaction.customId ===
        'spawner-verkaufen'
      ) {

        const spawnerData =
          getAllSpawnerPreise();


        const spawnerSelect =
          new StringSelectMenuBuilder()
            .setCustomId(
              'spawner-verkaufen-select'
            )
            .setPlaceholder(
              'Wähle einen Spawner aus'
            )
            .addOptions(
              spawnerData.map(
                ({
                  spawner_name,
                  verkaufspreis
                }) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(spawner_name)
                    .setDescription(
                      `💰 Verkaufspreis: ${formatMillions(verkaufspreis)}`
                    )
                    .setValue(spawner_name)
              )
            );


        const container =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  '# 💰 • SPAWNER VERKAUFEN\n\n' +
                  'Wähle den Spawner aus, den du verkaufen möchtest.'
                )
            )
            .addActionRowComponents(
              new ActionRowBuilder()
                .addComponents(spawnerSelect)
            );


        return interaction.reply({
          components: [container],
          flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral
        });
      }


      /* ===================================================
         CLAIM
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-claim-'
        )
      ) {

        if (!isTrader(interaction)) {

          return interaction.reply({
            content:
              '❌ Nur ein Trader kann dieses Ticket übernehmen.',
            flags: MessageFlags.Ephemeral
          });
        }


        const threadId =
          interaction.customId.replace(
            'trade-claim-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (trade.status !== 'open') {

          return interaction.reply({
            content:
              '❌ Dieser Trade wurde bereits übernommen.',
            flags: MessageFlags.Ephemeral
          });
        }


        claimTrade(
          threadId,
          interaction.user.id
        );


        const updatedTrade =
          getTradeByThreadId(threadId);


        const container =
          buildTradeContainer(
            updatedTrade
          );


        await interaction.update({
          components: [container]
        });


        await interaction.followUp({
          content:
            `🎯 Du hast **Handel #${updatedTrade.trade_number}** übernommen.`,
          flags: MessageFlags.Ephemeral
        });


        return;
      }


      /* ===================================================
         FREIGEBEN
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-release-'
        )
      ) {

        const threadId =
          interaction.customId.replace(
            'trade-release-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (!isTrader(interaction)) {

          return interaction.reply({
            content:
              '❌ Nur ein Trader kann einen Trade freigeben.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.trader_id !==
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              '❌ Du hast diesen Trade nicht übernommen.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (trade.status !== 'claimed') {

          return interaction.reply({
            content:
              '❌ Dieser Trade kann nicht mehr freigegeben werden.',
            flags: MessageFlags.Ephemeral
          });
        }


        releaseTrade(
          threadId,
          interaction.user.id
        );


        const updatedTrade =
          getTradeByThreadId(threadId);


        await interaction.update({
          components: [
            buildTradeContainer(updatedTrade)
          ]
        });


        return;
      }


      /* ===================================================
         ALS GEKAUFT
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-bought-'
        )
      ) {

        const threadId =
          interaction.customId.replace(
            'trade-bought-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (!isTrader(interaction)) {

          return interaction.reply({
            content:
              '❌ Nur ein Trader kann einen Trade als gekauft markieren.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.trader_id !==
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              '❌ Du bist nicht der Trader dieses Tickets.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (trade.status !== 'claimed') {

          return interaction.reply({
            content:
              '❌ Dieser Trade wurde bereits bearbeitet.',
            flags: MessageFlags.Ephemeral
          });
        }


        markTradeBought(
          threadId,
          interaction.user.id
        );


        const updatedTrade =
          getTradeByThreadId(threadId);


        await interaction.update({
          components: [
            buildTradeContainer(updatedTrade)
          ]
        });


        const thread =
          interaction.channel;


        await thread.send({
          content:
            `✅ <@${interaction.user.id}> hat den Trade als **gekauft** markiert.\n` +
            '🔒 Das Ticket wird archiviert.'
        });


        /*
         * Kurz warten, damit die Abschlussnachricht
         * noch sichtbar ist.
         */

        setTimeout(async () => {

          try {

            await thread.setArchived(
              true,
              'Trade wurde als gekauft markiert'
            );

          } catch (error) {

            console.error(
              'Fehler beim Archivieren:',
              error
            );
          }

        }, 1500);


        return;
      }


      /* ===================================================
         ABBRECHEN / SCHLIESSUNGSANFRAGE
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-close-'
        ) &&
        !interaction.customId.startsWith(
          'trade-close-accept-'
        ) &&
        !interaction.customId.startsWith(
          'trade-close-deny-'
        )
      ) {

        const threadId =
          interaction.customId.replace(
            'trade-close-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          !canUseCloseButton(
            trade,
            interaction
          )
        ) {

          return interaction.reply({
            content:
              '❌ Nur der Kunde oder der zugewiesene Trader kann diesen Trade abbrechen.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.status !== 'open' &&
          trade.status !== 'claimed'
        ) {

          return interaction.reply({
            content:
              '❌ Für diesen Trade kann keine Schließungsanfrage mehr erstellt werden.',
            flags: MessageFlags.Ephemeral
          });
        }


        createCloseRequest(
          threadId,
          interaction.user.id
        );


        const updatedTrade =
          getTradeByThreadId(threadId);


        await interaction.update({
          components: [
            buildTradeContainer(updatedTrade)
          ]
        });


        return;
      }


      /* ===================================================
         SCHLIESSUNG ANNEHMEN
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-close-accept-'
        )
      ) {

        const threadId =
          interaction.customId.replace(
            'trade-close-accept-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        /*
         * Derjenige, der die Anfrage erstellt hat,
         * darf sie nicht selbst annehmen.
         */

        if (
          trade.close_requester_id ===
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              '❌ Du kannst deine eigene Schließungsanfrage nicht annehmen.',
            flags: MessageFlags.Ephemeral
          });
        }


        /*
         * Nur Kunde oder Trader dürfen bestätigen.
         */

        if (
          !canUseCloseButton(
            trade,
            interaction
          )
        ) {

          return interaction.reply({
            content:
              '❌ Du bist nicht an diesem Trade beteiligt.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.status !==
          'close_requested'
        ) {

          return interaction.reply({
            content:
              '❌ Es gibt keine aktive Schließungsanfrage.',
            flags: MessageFlags.Ephemeral
          });
        }


        closeTrade(threadId);


        const updatedTrade =
          getTradeByThreadId(threadId);


        await interaction.update({
          components: [
            buildTradeContainer(updatedTrade)
          ]
        });


        const thread =
          interaction.channel;


        await thread.send({
          content:
            `🔒 Der Trade wurde von <@${interaction.user.id}> geschlossen.\n` +
            'Das Ticket wird archiviert.'
        });


        setTimeout(async () => {

          try {

            await thread.setArchived(
              true,
              'Trade wurde geschlossen'
            );

          } catch (error) {

            console.error(
              'Fehler beim Archivieren:',
              error
            );
          }

        }, 1500);


        return;
      }


      /* ===================================================
         SCHLIESSUNG ABLEHNEN
      =================================================== */

      if (
        interaction.customId.startsWith(
          'trade-close-deny-'
        )
      ) {

        const threadId =
          interaction.customId.replace(
            'trade-close-deny-',
            ''
          );


        const trade =
          getTradeByThreadId(threadId);


        if (!trade) {

          return interaction.reply({
            content:
              '❌ Dieser Trade existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.close_requester_id ===
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              '❌ Du kannst deine eigene Schließungsanfrage nicht ablehnen.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          !canUseCloseButton(
            trade,
            interaction
          )
        ) {

          return interaction.reply({
            content:
              '❌ Du bist nicht an diesem Trade beteiligt.',
            flags: MessageFlags.Ephemeral
          });
        }


        if (
          trade.status !==
          'close_requested'
        ) {

          return interaction.reply({
            content:
              '❌ Es gibt keine aktive Schließungsanfrage.',
            flags: MessageFlags.Ephemeral
          });
        }


        cancelCloseRequest(threadId);


        const updatedTrade =
          getTradeByThreadId(threadId);


        await interaction.update({
          components: [
            buildTradeContainer(updatedTrade)
          ]
        });


        await interaction.followUp({
          content:
            '❌ Die Schließungsanfrage wurde abgelehnt.',
          flags: MessageFlags.Ephemeral
        });


        return;
      }
    }


    /* =====================================================
       SELECT MENÜS
    ===================================================== */

    if (interaction.isStringSelectMenu()) {

      /* ===================================================
         KAUFEN
      =================================================== */

      if (
        interaction.customId ===
        'spawner-kaufen-select'
      ) {

        const spawnerName =
          interaction.values[0];


        const spawnerPreis =
          getSpawnerPreis(spawnerName);


        if (!spawnerPreis) {

          return interaction.reply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        const modal =
          new ModalBuilder()
            .setCustomId(
              `spawner-kaufen-modal-${spawnerName}`
            )
            .setTitle(
              'Spawner Kaufen'
            );


        const minecraftName =
          new TextInputBuilder()
            .setCustomId(
              'minecraft-name'
            )
            .setLabel(
              'Wie lautet dein Minecraft Name?'
            )
            .setPlaceholder(
              'z.B. yayk'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        const spawnerAnzahl =
          new TextInputBuilder()
            .setCustomId(
              'spawner-anzahl'
            )
            .setLabel(
              'Wie viele Spawner möchtest du kaufen?'
            )
            .setPlaceholder(
              'z.B. 10'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              minecraftName
            ),

          new ActionRowBuilder()
            .addComponents(
              spawnerAnzahl
            )
        );


        return interaction.showModal(
          modal
        );
      }


      /* ===================================================
         VERKAUFEN
      =================================================== */

      if (
        interaction.customId ===
        'spawner-verkaufen-select'
      ) {

        const spawnerName =
          interaction.values[0];


        const spawnerPreis =
          getSpawnerPreis(spawnerName);


        if (!spawnerPreis) {

          return interaction.reply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.',
            flags: MessageFlags.Ephemeral
          });
        }


        const modal =
          new ModalBuilder()
            .setCustomId(
              `spawner-verkaufen-modal-${spawnerName}`
            )
            .setTitle(
              'Spawner Verkaufen'
            );


        const minecraftName =
          new TextInputBuilder()
            .setCustomId(
              'minecraft-name'
            )
            .setLabel(
              'Wie lautet dein Minecraft Name?'
            )
            .setPlaceholder(
              'z.B. yayk'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        const spawnerAnzahl =
          new TextInputBuilder()
            .setCustomId(
              'spawner-anzahl'
            )
            .setLabel(
              'Wie viele Spawner möchtest du verkaufen?'
            )
            .setPlaceholder(
              'z.B. 10'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              minecraftName
            ),

          new ActionRowBuilder()
            .addComponents(
              spawnerAnzahl
            )
        );


        return interaction.showModal(
          modal
        );
      }
    }


    /* =====================================================
       MODALS
    ===================================================== */

    if (interaction.isModalSubmit()) {

      const minecraftName =
        interaction.fields.getTextInputValue(
          'minecraft-name'
        );

      const spawnerAnzahl =
        interaction.fields.getTextInputValue(
          'spawner-anzahl'
        );


      /* ===================================================
         KAUF
      =================================================== */

      if (
        interaction.customId.startsWith(
          'spawner-kaufen-modal-'
        )
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });


        const spawnerName =
          interaction.customId.replace(
            'spawner-kaufen-modal-',
            ''
          );


        const spawnerPreis =
          getSpawnerPreis(spawnerName);


        if (!spawnerPreis) {

          return interaction.editReply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.'
          });
        }


        const anzahl =
          Number(spawnerAnzahl);


        if (
          !Number.isInteger(anzahl) ||
          anzahl <= 0
        ) {

          return interaction.editReply({
            content:
              '❌ Bitte gib eine gültige Anzahl ein.'
          });
        }


        const gesamtpreis =
          spawnerPreis.kaufpreis *
          anzahl;


        const tradeNumber =
          getNextTradeNumber();


        const thread =
          await interaction.channel.threads.create({
            name:
              `🛒 ${minecraftName} - ${anzahl} ${spawnerName}`,

            type: 12,

            autoArchiveDuration: 1440,

            reason:
              'Spawner Kauf Anfrage'
          });


        await thread.members.add(
          interaction.user.id
        );


        const traderRole =
          interaction.guild.roles.cache.get(
            process.env.TRADER_ROLE_ID
          );


        if (traderRole) {

          for (
            const [memberId]
            of traderRole.members
          ) {

            try {

              await thread.members.add(
                memberId
              );

            } catch (error) {

              console.error(
                `Trader ${memberId} konnte nicht hinzugefügt werden:`,
                error
              );
            }
          }
        }


        createTrade({

          tradeNumber,

          guildId:
            interaction.guildId,

          threadId:
            thread.id,

          customerId:
            interaction.user.id,

          minecraftName,

          spawnerName,

          amount:
            anzahl,

          pricePerItem:
            spawnerPreis.kaufpreis,

          totalPrice:
            gesamtpreis,

          tradeType:
            'buy'

        });


        const trade =
          getTradeByThreadId(
            thread.id
          );


        await thread.send({

          components: [
            buildTradeContainer(trade)
          ],

          flags:
            MessageFlags.IsComponentsV2

        });


        const createdContainer =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  `✅ Dein Trade Ticket wurde erstellt: ${thread}`
                )
            );


        await interaction.editReply({

          components: [
            createdContainer
          ],

          flags:
            MessageFlags.IsComponentsV2

        });


        return;
      }


      /* ===================================================
         VERKAUF
      =================================================== */

      if (
        interaction.customId.startsWith(
          'spawner-verkaufen-modal-'
        )
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });


        const spawnerName =
          interaction.customId.replace(
            'spawner-verkaufen-modal-',
            ''
          );


        const spawnerPreis =
          getSpawnerPreis(spawnerName);


        if (!spawnerPreis) {

          return interaction.editReply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.'
          });
        }


        const anzahl =
          Number(spawnerAnzahl);


        if (
          !Number.isInteger(anzahl) ||
          anzahl <= 0
        ) {

          return interaction.editReply({
            content:
              '❌ Bitte gib eine gültige Anzahl ein.'
          });
        }


        const gesamtpreis =
          spawnerPreis.verkaufspreis *
          anzahl;


        const tradeNumber =
          getNextTradeNumber();


        const thread =
          await interaction.channel.threads.create({

            name:
              `💰 ${minecraftName} - ${anzahl} ${spawnerName}`,

            type: 12,

            autoArchiveDuration: 1440,

            reason:
              'Spawner Verkauf Anfrage'

          });


        await thread.members.add(
          interaction.user.id
        );


        const traderRole =
          interaction.guild.roles.cache.get(
            process.env.TRADER_ROLE_ID
          );


        if (traderRole) {

          for (
            const [memberId]
            of traderRole.members
          ) {

            try {

              await thread.members.add(
                memberId
              );

            } catch (error) {

              console.error(
                `Trader ${memberId} konnte nicht hinzugefügt werden:`,
                error
              );
            }
          }
        }


        createTrade({

          tradeNumber,

          guildId:
            interaction.guildId,

          threadId:
            thread.id,

          customerId:
            interaction.user.id,

          minecraftName,

          spawnerName,

          amount:
            anzahl,

          pricePerItem:
            spawnerPreis.verkaufspreis,

          totalPrice:
            gesamtpreis,

          tradeType:
            'sell'

        });


        const trade =
          getTradeByThreadId(
            thread.id
          );


        await thread.send({

          components: [
            buildTradeContainer(trade)
          ],

          flags:
            MessageFlags.IsComponentsV2

        });


        const createdContainer =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  `✅ Dein Trade Ticket wurde erstellt: ${thread}`
                )
            );


        await interaction.editReply({

          components: [
            createdContainer
          ],

          flags:
            MessageFlags.IsComponentsV2

        });


        return;
      }
    }

  } catch (error) {

    console.error(
      'Fehler bei interactionCreate:',
      error
    );


    try {

      if (interaction.replied ||
          interaction.deferred) {

        await interaction.followUp({
          content:
            '❌ Bei der Verarbeitung ist ein Fehler aufgetreten.',
          flags:
            MessageFlags.Ephemeral
        });

      } else {

        await interaction.reply({
          content:
            '❌ Bei der Verarbeitung ist ein Fehler aufgetreten.',
          flags:
            MessageFlags.Ephemeral
        });

      }

    } catch (replyError) {

      console.error(
        'Fehler beim Senden der Fehlermeldung:',
        replyError
      );
    }
  }
});


/* =========================================================
   LOGIN
========================================================= */

client.login(
  process.env.DISCORD_BOT_TOKEN
);
