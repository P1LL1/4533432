import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getServiceByName, setServiceCooldown } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("setcooldown")
  .setDescription("Set the cooldown for a specific service (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("The service to set the cooldown for")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("minutes")
      .setDescription("Cooldown in minutes (0 = use global default from env)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(1440)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const serviceName = interaction.options.getString("service", true);
  const minutes = interaction.options.getInteger("minutes", true);

  const service = await getServiceByName(serviceName);
  if (!service) {
    await interaction.reply({ content: `❌ Service **${serviceName}** not found.`, flags: 64 });
    return;
  }

  const prev = service.cooldown_minutes !== null ? `${service.cooldown_minutes}m` : "global default";
  const newVal = minutes === 0 ? null : minutes;
  await setServiceCooldown(service.id, newVal);
  const next = newVal !== null ? `${newVal}m` : "global default";

  await interaction.reply({
    content: `✅ **${service.name}** cooldown: **${prev} → ${next}**.`,
    flags: 64,
  });
}
