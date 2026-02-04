import { Message } from "discord.js";
import { mongoDatabase } from "../db/mongoInstance";
import ActiveThread from "../types/ActiveThread";
import splitMessage from "../util/splitMessage";
import { TEXT_COMMAND_PREFIX } from "../constants";

/**
 * Handle a message sent in a modmail thread by a staff member.
 * @param message The message in question.
 */
export default async function handleThreadMessage(message: Message) {
    // Fetch the active thread associated with this channel.
    const activeThread = await mongoDatabase.collection<ActiveThread>("active_threads").findOne({ receivingThreadId: message.channel.id });

    if (!activeThread) {
        return;
    }

    // Collect any attached files that are under 25MB, and append any over that limit to the message content via their CDN URLs.
    const files = message.attachments.filter(attachment => attachment.size <= 25000000).map(attachment => attachment.url);
    const leftoverFiles = [...message.attachments.values()].filter(attachment => attachment.size > 25000000);

    // Append any leftover files to the message content as their URLs.
    let messageContent = message.content.replace(/<:(\w+):\d+>/g, ":$1:");
    if (leftoverFiles.length > 0) {
        messageContent += '\n';

        leftoverFiles.forEach(attachment => {
            messageContent += `\n${attachment.url}`;
        });
    }

    /*
     * Determine if the current message should be sent anonymously.
     * By default, this is determined by the thread's moderator visibility setting
     * but can be toggled on a per-message basis using the identity command.
     */
    let isCurrentMessageAnonymous = activeThread.areModeratorsHidden;

    if (messageContent.startsWith(`${TEXT_COMMAND_PREFIX}identity `)) {
        messageContent = messageContent.replace(`${TEXT_COMMAND_PREFIX}identity `, "");
        isCurrentMessageAnonymous = !isCurrentMessageAnonymous;
    }

    // If the message is anonymous, log it in the database. This is necessary for transcript generation once the thread is closed.
    if (isCurrentMessageAnonymous) {
        await mongoDatabase.collection<ActiveThread>("active_threads").updateOne({ receivingThreadId: message.channel.id }, { $push: { anonymousMessages: message.id } });
    }

    // Split the message into chunks in order to avoid exceeding Discord's message length limits.
    const user = await message.client.users.fetch(activeThread.userId);
    const userDMChannel = await user.createDM();
    const messageContentSplit = splitMessage(messageContent);


    // Send each chunk to the user's DM.
    for (let i = 0; i < messageContentSplit.length; i++) {
        await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContentSplit[i],
            files: i === messageContentSplit.length - 1 ? files : []
        });
    }

    if (messageContentSplit.length === 0) {
        await userDMChannel.send({
            content: (isCurrentMessageAnonymous ? `**Staff Member**: ` : `**@${message.author.username}**: `) + messageContent,
            files: files
        });
    }
}
