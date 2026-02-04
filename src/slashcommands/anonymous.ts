import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";
import { TEXT_COMMAND_PREFIX } from "../constants";

/**
 * Toggle the anonymous state of the staff members in a modmail thread.
 * @param interaction The interaction for the command invocation.
 */
export default async function anonymousSlashCommand(interaction: ChatInputCommandInteraction) {
    const activeThread = (await mongoDatabase.collection("active_threads").findOne<ActiveThread>({ receivingThreadId: interaction.channel!.id }))!;
    const newValue = interaction.options.getBoolean("state");

    // If no new state was provided, simply reply with the current state.
    if (newValue === null) {
        await interaction.reply({
            content: `Moderator identities are currently ${activeThread.areModeratorsHidden ? "hidden" : "visible"}. Use ${TEXT_COMMAND_PREFIX}identity to selectively ${activeThread.areModeratorsHidden ? "reveal" : "hide"} your identity.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Update the thread's moderator visibility setting.
    await mongoDatabase.collection("active_threads").updateOne({ receivingThreadId: interaction.channel!.id }, { $set: { areModeratorsHidden: newValue } });
    await interaction.reply({
        content: `Moderator identities are now ${newValue ? "hidden" : "revealed"}. To ${newValue ? "reveal" : "hide"} your identity for a specific message, prepend your message with \`${TEXT_COMMAND_PREFIX}identity\`.`
    });
}
