import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { resetUserCooldown } from "../cooldown.js";

export const data = new SlashCommandBuilder()
  .setName("resetcooldown")
  .setDescription("Reset a user's gen cooldown (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user whose cooldown to reset")
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const target = interaction.options.getUser("user", true);
  resetUserCooldown(target.id);
  await interaction.reply({
    content: `✅ Cooldown reset for ${target}.`,
    flags: 64,
  });
}
