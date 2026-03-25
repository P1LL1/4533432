import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { getServiceByName } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("bulkstock")
  .setDescription("Add multiple stock items at once via a form (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("Service to add stock to")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const serviceName = interaction.options.getString("service", true);
  const service = await getServiceByName(serviceName);

  if (!service) {
    await interaction.reply({
      content: `❌ Service **${serviceName}** not found. Use \`/addservice\` first.`,
      flags: 64,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`bulkstock_${service.id}`)
    .setTitle(`Add Stock — ${service.name}`);

  const input = new TextInputBuilder()
    .setCustomId("accounts")
    .setLabel("Accounts (one per line: user:pass)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "email1@gmail.com:password1\nemail2@gmail.com:password2\nemail3@gmail.com:password3"
    )
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input)
  );

  await interaction.showModal(modal);
}
