import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getServiceByName, addStockItem } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("addstock")
  .setDescription("Add a stock item to a service (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("Service name to add stock to")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName("content")
      .setDescription("The account/item to add (e.g. user@email.com:password)")
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const serviceName = interaction.options.getString("service", true);
  const content = interaction.options.getString("content", true);

  const service = await getServiceByName(serviceName);
  if (!service) {
    await interaction.editReply(
      `❌ Service **${serviceName}** not found. Use \`/addservice\` first.`
    );
    return;
  }

  await addStockItem(service.id, content);
  await interaction.editReply(`✅ Stock item added to **${service.name}**.`);

  if (process.env.STOCK_LOG_CHANNEL_ID) {
    try {
      const ch = await interaction.client.channels.fetch(process.env.STOCK_LOG_CHANNEL_ID) as TextChannel;
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("📥 Stock Added — /addstock")
            .addFields(
              { name: "Admin", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
              { name: "Service", value: service.name, inline: true },
              { name: "Content", value: `\`\`\`${content}\`\`\`` }
            )
            .setTimestamp(),
        ],
      });
    } catch {}
  }
}
