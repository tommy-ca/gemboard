import { bannedChannels, StarboardChannelId } from '#utils/constants';
import { resolveOnErrorCodes } from '#utils/functions/helpers';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { isNullish } from '@sapphire/utilities';
import { envParseString } from '@skyra/env-utilities';
import { Message, RESTJSONErrorCodes } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.MessageDelete
})
export class UserListener extends Listener<typeof Events.MessageDelete> {
	public async run(message: Message) {
		if (message.guildId === envParseString('COMMAND_GUILD_ID')) return;
		if (bannedChannels.has(message.channelId)) return;

		const starboardMessage = await this.container.prisma.starboardBoardMessage.findFirst({
			where: {
				channelId: BigInt(message.channelId),
				guildId: BigInt(message.guildId!),
				messageId: BigInt(message.id)
			}
		});

		if (isNullish(starboardMessage)) return;

		const deletedStarboardMessageEntry = await this.container.prisma.starboardBoardMessage.delete({
			where: {
				snowflake_channelId_guildId_messageId: starboardMessage
			}
		});

		const starboardChannel = await resolveOnErrorCodes(message.guild!.channels.fetch(StarboardChannelId), RESTJSONErrorCodes.MissingAccess);

		if (!starboardChannel?.isTextBased()) return;

		const discordMessage = await resolveOnErrorCodes(
			starboardChannel.messages.fetch(deletedStarboardMessageEntry.snowflake.toString()),
			RESTJSONErrorCodes.UnknownMessage,
			RESTJSONErrorCodes.MissingAccess
		);

		if (isNullish(discordMessage)) return;

		discordMessage.delete();
	}
}
