# macchanger
a tool for linux disros changing mac in every min






# Auto MAC Changer

A Linux utility that automatically changes your network interfaces' MAC addresses at regular intervals for enhanced privacy and security.

## Features

- **Automatic MAC Rotation**: Changes MAC addresses at user-defined intervals
- **Multi-Interface Support**: Works with multiple network interfaces simultaneously
- **Persistent Service**: Automatically starts on system boot
- **Distribution Support**: Works on Fedora, Kali, Parrot, and Arch Linux
- **Easy Configuration**: Simple interactive setup and configuration
- **Detailed Logging**: Maintains logs of all MAC address changes

## Installation

### Prerequisites

This tool requires:
- A supported Linux distribution (Fedora, Kali, Parrot, or Arch Linux)
- Root privileges (sudo)
- Node.js

### Install Steps

1. Clone or download this repository
2. Install the tool:

```bash
cd auto-mac-changer
sudo npm run install
```

The installation script will:
- Detect your Linux distribution
- Install the required `macchanger` package
- Prompt you to select network interfaces and change interval
- Create and enable a systemd service for automatic startup

## Usage

### Check Status

To check the current status of the MAC changer service:

```bash
sudo node status.js
```

This will show:
- Service status (running/stopped)
- Current configuration
- Current MAC addresses
- Recent log entries

### Configure Settings

To change configuration settings:

```bash
sudo node config.js
```

This allows you to:
- Change the MAC address rotation interval
- Select different network interfaces
- Enable/disable the service

### Manual Control

To manually control the service:

```bash
# Start the service
sudo systemctl start auto-mac-changer

# Stop the service
sudo systemctl stop auto-mac-changer

# Enable automatic startup
sudo systemctl enable auto-mac-changer

# Disable automatic startup
sudo systemctl disable auto-mac-changer
```

## Files and Locations

- Configuration: `/etc/auto-mac-changer/config.json`
- Log file: `/etc/auto-mac-changer/mac-changer.log`
- Service definition: `/etc/systemd/system/auto-mac-changer.service`

## Troubleshooting

If you encounter issues:

1. Check the service status: `sudo systemctl status auto-mac-changer`
2. View logs: `sudo cat /etc/auto-mac-changer/mac-changer.log`
3. Ensure macchanger is installed: `which macchanger`

## License

MIT

## Security Considerations

This tool is designed for privacy and security testing. Use responsibly and only on networks you have permission to use.

Changing MAC addresses may temporarily disconnect your network interfaces and require reconnection to wireless networks.
