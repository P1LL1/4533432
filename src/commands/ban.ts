import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) =>
    option.setName("user").setDescription("The user to ban").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the ban").setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("delete_days")
      .setDescription("Days of message history to delete (0–7, default 0)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(7)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

  if (targetUser.id === interaction.user.id) {
    await interaction.reply({ content: "❌ You cannot ban yourself.", flags: 64 });
    return;
  }

  if (targetUser.id === interaction.client.user.id) {
    await interaction.reply({ content: "❌ I cannot ban myself.", flags: 64 });
    return;
  }

  const member = await guild.members.fetch(targetUser.id).catch(() => null) as GuildMember | null;

  if (member) {
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: `❌ I cannot ban **${targetUser.tag}** — their role is equal to or higher than mine.`,
        flags: 64,
      });
      return;
    }

    if (member.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
      await interaction.reply({
        content: `❌ You cannot ban **${targetUser.tag}** — their role is equal to or higher than yours.`,
        flags: 64,
      });
      return;
    }

    await member.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(`🔨 You have been banned from ${guild.name}`)
          .addFields({ name: "Reason", value: reason })
          .setTimestamp(),
      ],
    }).catch(() => {});
  }

  try {
    await guild.bans.create(targetUser.id, {
      reason: `${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86400,
    });
  } catch {
    await interaction.reply({
      content: `❌ Failed to ban **${targetUser.tag}**. Make sure I have the Ban Members permission.`,
      flags: 64,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔨 User Banned")
    .addFields(
      { name: "User", value: `${targetUser} (${targetUser.tag})`, inline: true },
      { name: "Banned By", value: `${interaction.user}`, inline: true },
      { name: "Reason", value: reason },
      ...(deleteDays > 0 ? [{ name: "Messages Deleted", value: `${deleteDays} day${deleteDays !== 1 ? "s" : ""}` }] : [])
    )
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
