## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   GENERAL_CHANNEL_ID=your_general_channel_id_here
   WELCOME_MESSAGE=Welcome to the server, {users}!
   WELCOME_IMAGE_URL=https://example.com/welcome-image.png
   DEFAULT_ROLE_ID=your_default_role_id_here
   ```
   - `{users}` in `WELCOME_MESSAGE` will be replaced with mentions of the selected users.
   - `DEFAULT_ROLE_ID` is the ID of the role that will be automatically assigned to new members when they join the server.
4. Start the bot:
   ```bash
   node index.js
   ```

## Docker Usage

You can run the bot using Docker and Docker Compose:

1. Build and start the bot:
   ```bash
   docker-compose up -d --build
   ```
2. To stop the bot:
   ```bash
   docker-compose down
   ```

## Adding New Commands

To add a new command:

1. Create a new file in the `commands` directory (e.g., `commands/mycommand.js`)
2. Use the following template:
   ```javascript
   const { SlashCommandBuilder } = require('discord.js');

   module.exports = {
       data: new SlashCommandBuilder()
           .setName('commandname')
           .setDescription('Command description'),
       async execute(interaction) {
           // Command logic here
           await interaction.reply('Response');
       },
   };
   ```
3. The bot will automatically deploy commands on startup.

## Available Commands

### /allowed
Removes a specified role from multiple users and posts a welcome message in your general channel.

- Requires "Manage Roles" permission
- Usage: `/allowed role:<role>`
- After running the command, a select menu will appear to choose users in the current channel.
- After role removal, a welcome message (with image) is posted in the channel specified by `GENERAL_CHANNEL_ID`.
- The message and image are customizable via `.env`.

### /unworthy
Kicks selected users from the server and sends them a rejection message.

- Requires "Kick Members" permission
- Usage: `/unworthy reason:<optional_reason>`
- After running the command, a select menu will appear to choose users in the current channel.
- Selected users will be kicked and sent a DM with the rejection reason (if possible).

## Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your bot's client ID
- `GUILD_ID`: The server (guild) ID for command registration
- `GENERAL_CHANNEL_ID`: Channel ID where welcome messages are posted
- `WELCOME_MESSAGE`: Welcome message template (use `{users}` for mentions)
- `WELCOME_IMAGE_URL`: Image URL to include in the welcome message
- `DEFAULT_ROLE_ID`: ID of the role to automatically assign to new members

## License

MIT
