import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelType,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { pool } from "../db.js";
import { isOwner } from "../constants.js";

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID ?? "1482708422062510169";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system management")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Send the ticket creation panel in this channel")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.options.getSubcommand() === "setup") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 Support Tickets")
      .setDescription(
        "Need help or have a question? Click the button below to open a private support ticket.\n\nOur team will assist you as soon as possible."
      )
      .setFooter({ text: "One ticket per user at a time." })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("📩 Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await (interaction.channel as TextChannel).send({
      embeds: [embed],
      components: [row],
    });

    await interaction.reply({ content: "✅ Ticket panel has been sent!", flags: 64 });
  }
}

export async function handleTicketCreate(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const guild = interaction.guild;
  if (!guild) return;

  const existing = await pool.query<{ channel_id: string }>(
    "SELECT channel_id FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'",
    [guild.id, interaction.user.id]
  );

  if (existing.rows.length > 0) {
    const channelId = existing.rows[0]!.channel_id;
    await interaction.editReply({
      content: `❌ You already have an open ticket: <#${channelId}>`,
    });
    return;
  }

  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20) || interaction.user.id.slice(-6);

  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${safeName}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
      ],
      topic: `Ticket for ${interaction.user.tag} | ${interaction.user.id}`,
    }) as TextChannel;
  } catch (err) {
    console.error("Failed to create ticket channel:", err);
    await interaction.editReply({
      content: "❌ Failed to create ticket channel. Make sure I have the correct permissions and the category exists.",
    });
    return;
  }

  await pool.query(
    "INSERT INTO tickets (guild_id, channel_id, user_id, username) VALUES ($1, $2, $3, $4)",
    [guild.id, channel.id, interaction.user.id, interaction.user.tag]
  );

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${channel.id}`)
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🎫 Ticket Opened")
    .setDescription(
      `Welcome ${interaction.user}!\n\nA staff member will be with you shortly.\nPlease describe your issue in detail and we'll help you as soon as possible.`
    )
    .setFooter({ text: "Click 'Close Ticket' when your issue is resolved." })
    .setTimestamp();

  await channel.send({
    content: `${interaction.user}`,
    embeds: [ticketEmbed],
    components: [closeRow],
  });

  await interaction.editReply({
    content: `✅ Your ticket has been created: ${channel}`,
  });
}

export async function handleTicketClose(
  interaction: ButtonInteraction,
  channelId: string
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const guild = interaction.guild;
  if (!guild) return;

  const ticketRes = await pool.query<{ user_id: string; username: string }>(
    "SELECT user_id, username FROM tickets WHERE channel_id = $1 AND status = 'open'",
    [channelId]
  );

  if (ticketRes.rows.length === 0) {
    await interaction.editReply({ content: "❌ This ticket is already closed or doesn't exist." });
    return;
  }

  const ticket = ticketRes.rows[0]!;
  const isAdmin = isOwner(interaction.user.id) || (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false);

  if (!isAdmin && interaction.user.id !== ticket.user_id) {
    await interaction.editReply({
      content: "❌ Only admins or the ticket owner can close this ticket.",
    });
    return;
  }

  await pool.query(
    "UPDATE tickets SET status = 'closed' WHERE channel_id = $1",
    [channelId]
  );

  const closeEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔒 Ticket Closed")
    .setDescription(`Closed by ${interaction.user}. This channel will be deleted in 5 seconds.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [closeEmbed] });

  setTimeout(async () => {
    const channel = await guild.channels.fetch(channelId).catch(() => null) as TextChannel | null;
    if (channel) {
      await channel.delete("Ticket closed").catch(() => {});
    }
  }, 5000);
}
