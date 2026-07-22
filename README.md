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
    WELCOME_IMAGE_TYPE=local
    WELCOME_IMAGE_PATH=./resources/MIMLSSK.png
    WELCOME_IMAGE_URL=https://example.com/welcome-image.png
    DEFAULT_ROLE_ID=your_default_role_id_here
    ```
    - `{users}` in `WELCOME_MESSAGE` will be replaced with mentions of the selected users.
    - `DEFAULT_ROLE_ID` is the ID of the role automatically assigned to new members, and the role removed by `/allowed`.
    - Optional: `TARGET_CHANNEL_ID` limits the selectable member list to people who can view that channel. If unset, the current channel is used.
    - See [Welcome Image Configuration](#welcome-image-configuration) for details on image options.
4. In the [Discord Developer Portal](https://discord.com/developers/applications), enable the **Server Members Intent** for the bot.
5. Start the bot:
   ```bash
   npm start
   ```

## Docker Usage

Published images are built by GitHub Actions and pushed to GHCR:

`ghcr.io/crowquillx/lgu-enforcer:latest`

Pushes to `master` (and manual `workflow_dispatch`) build and publish the image.

### Pull and run (production)

1. Create a `.env` file (see Setup above).
2. Start the bot from the published image:
   ```bash
   docker compose pull
   docker compose up -d
   ```
3. To stop the bot:
   ```bash
   docker compose down
   ```

### Local image build (optional)

```bash
docker build -t ghcr.io/crowquillx/lgu-enforcer:local .
docker run --env-file .env --rm ghcr.io/crowquillx/lgu-enforcer:local
```

## Welcome Image Configuration

The welcome message supports flexible image configuration through three environment variables:

### Configuration Options

- `WELCOME_IMAGE_TYPE`: Specifies the image source type
  - Values: `"local"` or `"url"`
  - Default: `"local"`

- `WELCOME_IMAGE_PATH`: Local file path for local image type
  - Default: `./resources/MIMLSSK.png`
  - Used when `WELCOME_IMAGE_TYPE=local`
  - The Docker image includes `resources/`; keep this path relative to the app root.

- `WELCOME_IMAGE_URL`: URL for URL image type
  - Used when `WELCOME_IMAGE_TYPE=url`
  - Must be a publicly accessible image URL (not a placeholder)

### Usage Examples

**Local Image Configuration:**
```
WELCOME_IMAGE_TYPE=local
WELCOME_IMAGE_PATH=./resources/MIMLSSK.png
```

**URL Image Configuration:**
```
WELCOME_IMAGE_TYPE=url
WELCOME_IMAGE_URL=https://example.com/welcome-image.png
```

### Backward Compatibility

If no image configuration is provided, the bot defaults to the local image at `./resources/MIMLSSK.png`. If that file is missing, the welcome text is still sent.

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
Removes the configured applicant role (`DEFAULT_ROLE_ID`) from selected users and posts a welcome message in `GENERAL_CHANNEL_ID`.

- Requires "Manage Roles" permission
- Usage: `/allowed`
- After running the command, a select menu appears to choose users.
- After role removal, a welcome message (with image when available) is posted in the channel specified by `GENERAL_CHANNEL_ID`.

### /unworthy
Kicks selected users from the server and sends them a rejection message.

- Requires "Kick Members" permission
- Usage: `/unworthy reason:<optional_reason>`
- After running the command, a select menu appears to choose users.
- Selected users are kicked and sent a DM with the rejection reason when possible.

## Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your bot's client ID
- `GUILD_ID`: The server (guild) ID for command registration
- `GENERAL_CHANNEL_ID`: Channel ID where welcome messages are posted
- `WELCOME_MESSAGE`: Welcome message template (use `{users}` for mentions)
- `WELCOME_IMAGE_TYPE`: Image source type (`"local"` or `"url"`, default: `"local"`)
- `WELCOME_IMAGE_PATH`: Local file path for welcome image (default: `./resources/MIMLSSK.png`)
- `WELCOME_IMAGE_URL`: URL for welcome image (used when `WELCOME_IMAGE_TYPE=url`)
- `DEFAULT_ROLE_ID`: ID of the role to automatically assign to new members / remove via `/allowed`
- `TARGET_CHANNEL_ID` (optional): Limit selectable users to members who can view this channel

## License

MIT
