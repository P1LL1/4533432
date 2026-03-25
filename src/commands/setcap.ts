import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getServiceByName, setServiceDailyCap } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("setcap")
  .setDescription("Set the daily gen cap for a specific service (admin only, admins bypass cap)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("The service to set the daily cap for")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("cap")
      .setDescription("Max gens per user per day (0 = no cap)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(100)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const serviceName = interaction.options.getString("service", true);
  const cap = interaction.options.getInteger("cap", true);

  const service = await getServiceByName(serviceName);
  if (!service) {
    await interaction.reply({ content: `❌ Service **${serviceName}** not found.`, flags: 64 });
    return;
  }

  const prev = service.daily_cap !== null ? `${service.daily_cap}/day` : "unlimited";
  const newVal = cap === 0 ? null : cap;
  await setServiceDailyCap(service.id, newVal);
  const next = newVal !== null ? `${newVal}/day` : "unlimited";

  await interaction.reply({
    content: `✅ **${service.name}** daily cap: **${prev} → ${next}**.${newVal !== null ? "\nAdmins are exempt and always have unlimited access." : ""}`,
    flags: 64,
  });
}
