const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ButtonBuilder,
	ButtonStyle,
	GatewayRateLimitError,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Member cache with TTL to reduce rate limiting
const memberCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

const getCachedMembers = async (guild) => {
	const now = Date.now();
	const cached = memberCache.get(guild.id);

	if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
		console.log(`[CACHE] Using cached members (${cached.members.size} members, age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
		return cached.members;
	}

	console.log('[CACHE] Cache miss or expired, fetching fresh members from Discord API');
	await guild.members.fetch();
	const members = guild.members.cache.clone();
	memberCache.set(guild.id, { members, timestamp: now });
	console.log(`[CACHE] Cached ${members.size} members for ${guild.id}`);
	return members;
};

const isRateLimitError = (error) => {
	return error instanceof GatewayRateLimitError ||
		(error.name === 'GatewayRateLimitError') ||
		(error.code === 50035 && error.status === 429) ||
		error.status === 429 ||
		error.httpStatus === 429;
};

const safeReply = async (interaction, content, ephemeral, components) => {
	try {
		const payload = {
			content,
			components: components || [],
		};
		if (ephemeral) {
			payload.ephemeral = true;
		}

		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload);
		} else if (interaction.isButton() || interaction.isStringSelectMenu()) {
			// Component interactions should update the source message when possible
			await interaction.update(payload);
		} else {
			await interaction.reply(payload);
		}
	} catch (error) {
		console.error('[safeReply] Failed to send reply:', error.message);
	}
};

const getTargetChannel = (interaction) => {
	const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
	return TARGET_CHANNEL_ID
		? interaction.guild.channels.cache.get(TARGET_CHANNEL_ID)
		: interaction.channel;
};

const getEligibleMembers = (members, channel) => {
	return members.filter(m => !m.user.bot && channel.permissionsFor(m)?.has(PermissionFlagsBits.ViewChannel));
};

const buildSelectMenu = (members, currentPage, pageSize) => {
	const membersArray = Array.from(members?.values ? members.values() : members);
	const options = membersArray
		.slice((currentPage - 1) * pageSize, currentPage * pageSize)
		.map(member => ({
			label: member.displayName.slice(0, 100),
			description: (member.user.username || member.user.tag || member.id).slice(0, 100),
			value: member.id,
		}));

	return new StringSelectMenuBuilder()
		.setCustomId(`allowed-select-users-${currentPage}`)
		.setPlaceholder('Select users to remove the role from')
		.setMinValues(1)
		.setMaxValues(Math.min(options.length, 5))
		.addOptions(options);
};

const buildButtonRow = (currentPage, pages) => {
	const row = new ActionRowBuilder();

	if (currentPage > 1) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('allowed-prev-page')
				.setLabel('Previous')
				.setStyle(ButtonStyle.Primary)
		);
	}

	if (currentPage < pages) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('allowed-next-page')
				.setLabel('Next')
				.setStyle(ButtonStyle.Primary)
		);
	}

	return row;
};

const resolveWelcomeImagePath = () => {
	const configured = process.env.WELCOME_IMAGE_PATH || './resources/MIMLSSK.png';
	const absolute = path.isAbsolute(configured)
		? configured
		: path.resolve(process.cwd(), configured);
	return absolute;
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('allowed')
		.setDescription('Remove the applicant role from users (always uses the auto-added role)')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	async execute(interaction) {
		try {
			const DEFAULT_ROLE_ID = process.env.DEFAULT_ROLE_ID;
			if (!DEFAULT_ROLE_ID) {
				await safeReply(interaction, 'DEFAULT_ROLE_ID not configured in environment.', true);
				return;
			}

			const role = interaction.guild.roles.cache.get(DEFAULT_ROLE_ID);
			if (!role) {
				await safeReply(interaction, 'Role not found. Check DEFAULT_ROLE_ID configuration.', true);
				return;
			}

			let members;
			try {
				console.log('[DEBUG] Starting guild.members.fetch() - using cache to reduce API calls');
				const fetchStartTime = Date.now();
				members = await getCachedMembers(interaction.guild);
				const fetchDuration = Date.now() - fetchStartTime;
				console.log(`[DEBUG] Members ready in ${fetchDuration}ms, total available: ${members.size}`);
			} catch (fetchError) {
				if (isRateLimitError(fetchError)) {
					const retryAfter = fetchError.data?.retry_after || fetchError.retry_after || 30;
					console.error(`[RATE LIMIT] Members fetch rate limited. Retry after ${retryAfter}s`);
					await safeReply(interaction, `⚠️ Rate limited. Please wait ${Math.ceil(retryAfter)}s before trying again.`, true);
					return;
				}
				throw fetchError;
			}

			const channel = getTargetChannel(interaction);
			if (!channel) {
				await safeReply(interaction, 'Target channel not found.', true);
				return;
			}

			const filteredMembers = getEligibleMembers(members, channel);

			if (filteredMembers.size === 0) {
				await safeReply(interaction, 'No users found in this channel.', true);
				return;
			}

			const pageSize = 25;
			const pages = Math.ceil(filteredMembers.size / pageSize);
			const currentPage = 1;

			const selectMenu = buildSelectMenu(filteredMembers, currentPage, pageSize);
			const buttonRow = buildButtonRow(currentPage, pages);

			const components = [new ActionRowBuilder().addComponents(selectMenu)];
			if (buttonRow.components.length > 0) {
				components.push(buttonRow);
			}

			await safeReply(interaction, `Select users to remove the role **${role.name}** from:`, true, components);
		} catch (error) {
			console.error('[execute] Unexpected error:', error);
		}
	},

	async handleComponent(interaction) {
		try {
			if (interaction.customId.startsWith('allowed-select-users')) {
				const DEFAULT_ROLE_ID = process.env.DEFAULT_ROLE_ID;
				if (!DEFAULT_ROLE_ID) {
					await safeReply(interaction, 'DEFAULT_ROLE_ID not configured.', true, []);
					return true;
				}

				const guildRole = interaction.guild.roles.cache.get(DEFAULT_ROLE_ID);
				if (!guildRole) {
					await safeReply(interaction, 'Role not found. Check DEFAULT_ROLE_ID configuration.', true, []);
					return true;
				}

				const userIds = interaction.values;
				const results = { success: [], failed: [] };
				const mentions = [];

				for (const userId of userIds) {
					try {
						console.log(`[DEBUG] Fetching member ${userId}`);
						const member = interaction.guild.members.cache.get(userId)
							|| await interaction.guild.members.fetch({ user: userId, cache: true });
						if (!member.roles.cache.has(guildRole.id)) {
							results.failed.push(`${member.user.tag} (didn't have the role)`);
							continue;
						}
						console.log(`[DEBUG] Removing role from ${member.user.tag}`);
						await member.roles.remove(guildRole);
						results.success.push(member.user.tag);
						mentions.push(`<@${member.id}>`);

						await new Promise(resolve => setTimeout(resolve, 150));
					} catch (error) {
						if (!isRateLimitError(error)) {
							results.failed.push(`User ID: ${userId} (${error.message})`);
						} else {
							results.failed.push(`User ID: ${userId} (rate limited)`);
						}
					}
				}

				let response = `Role removal summary for **${guildRole.name}**:\n\n`;
				if (results.success.length > 0) {
					response += `✅ Successfully removed role from:\n${results.success.map(user => `- ${user}`).join('\n')}\n\n`;
				}
				if (results.failed.length > 0) {
					response += `❌ Failed to remove role from:\n${results.failed.map(user => `- ${user}`).join('\n')}`;
				}
				await safeReply(interaction, response, true, []);

				if (results.success.length > 0 && process.env.GENERAL_CHANNEL_ID) {
					const generalChannel = interaction.guild.channels.cache.get(process.env.GENERAL_CHANNEL_ID);
					if (generalChannel) {
						console.log(`[DEBUG] Sending welcome message to channel ${generalChannel.id} with ${results.success.length} successful users`);
						const welcomeMsg = (process.env.WELCOME_MESSAGE || 'Welcome to the server, {users}!')
							.replace('{users}', mentions.join(' '));

						const imageType = (process.env.WELCOME_IMAGE_TYPE || 'local').toLowerCase();
						const messageOptions = { content: welcomeMsg };

						if (imageType === 'url') {
							const imageUrl = process.env.WELCOME_IMAGE_URL;
							if (imageUrl && !imageUrl.includes('example.com')) {
								messageOptions.embeds = [{ image: { url: imageUrl } }];
								console.log('[DEBUG] Including URL image in welcome message');
							} else {
								console.warn('[DEBUG] WELCOME_IMAGE_TYPE=url but WELCOME_IMAGE_URL is missing/placeholder; sending text only');
							}
						} else {
							const imagePath = resolveWelcomeImagePath();
							if (fs.existsSync(imagePath)) {
								messageOptions.files = [imagePath];
								console.log(`[DEBUG] Including local image in welcome message: ${imagePath}`);
							} else {
								console.error(`[DEBUG] Welcome image not found at ${imagePath}; sending text only`);
							}
						}

						console.log('[DEBUG] About to send welcome message to general channel');
						await generalChannel.send(messageOptions);
						console.log('[DEBUG] Welcome message sent successfully');
					} else {
						console.error(`[DEBUG] GENERAL_CHANNEL_ID ${process.env.GENERAL_CHANNEL_ID} not found in guild cache`);
					}
				}
				return true;
			}

			if (interaction.customId === 'allowed-prev-page' || interaction.customId === 'allowed-next-page') {
				const match = interaction.message.components[0]?.components[0]?.customId?.match(/allowed-select-users-(\d+)/);
				if (!match) {
					await safeReply(interaction, 'Could not determine the current page.', true, []);
					return true;
				}

				const currentPage = parseInt(match[1], 10);
				const pageSize = 25;
				const channel = getTargetChannel(interaction);
				if (!channel) {
					await safeReply(interaction, 'Target channel not found.', true, []);
					return true;
				}

				const members = await getCachedMembers(interaction.guild);
				const filteredMembers = getEligibleMembers(members, channel);
				const pages = Math.max(1, Math.ceil(filteredMembers.size / pageSize));

				let newPage;
				if (interaction.customId === 'allowed-prev-page') {
					newPage = Math.max(1, currentPage - 1);
				} else {
					newPage = Math.min(pages, currentPage + 1);
				}

				const selectMenu = buildSelectMenu(filteredMembers, newPage, pageSize);
				const buttonRow = buildButtonRow(newPage, pages);

				const components = [new ActionRowBuilder().addComponents(selectMenu)];
				if (buttonRow.components.length > 0) {
					components.push(buttonRow);
				}

				await safeReply(interaction, 'Select users to remove the role from:', true, components);
				return true;
			}

			return false;
		} catch (error) {
			console.error('[handleComponent] Error:', error);
			return false;
		}
	},
};
