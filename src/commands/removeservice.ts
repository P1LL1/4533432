import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getServiceByName, deleteService } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("removeservice")
  .setDescription("Remove a service and all its stock (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("Service to remove")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const serviceName = interaction.options.getString("service", true);
  const service = await getServiceByName(serviceName);

  if (!service) {
    await interaction.editReply(`❌ Service **${serviceName}** not found.`);
    return;
  }

  await deleteService(service.id);
  await interaction.editReply(
    `✅ Service **${service.name}** and all its stock have been removed.`
  );
}
