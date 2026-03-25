import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { addService, ServiceTier } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("addservice")
  .setDescription("Add a new service to the bot (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Service name (e.g. Netflix, Spotify)")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("tier")
      .setDescription("Service tier")
      .setRequired(true)
      .addChoices(
        { name: "free — available on /fgen", value: "free" },
        { name: "basic — available on /bgen", value: "basic" },
        { name: "exclusive — available on /xgen", value: "exclusive" }
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const name = interaction.options.getString("name", true);
  const tier = interaction.options.getString("tier", true) as ServiceTier;

  const tierLabel: Record<ServiceTier, string> = {
    free: "Free 🆓",
    basic: "Basic 💎",
    exclusive: "Exclusive 👑",
  };

  try {
    const service = await addService(name, tier);
    await interaction.editReply(
      `✅ Service **${service.name}** added as **${tierLabel[tier]}**.`
    );
  } catch (err) {
    console.error(err);
    await interaction.editReply("❌ Failed to add service. It may already exist.");
  }
}
