#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

// Configuration paths
const CONFIG_DIR = '/etc/auto-mac-changer';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SERVICE_FILE = '/etc/systemd/system/auto-mac-changer.service';
const SCRIPT_PATH = '/usr/local/bin/auto-mac-changer';

// Check if running as root
function checkRoot() {
  try {
    if (process.getuid() !== 0) {
      console.error(chalk.red('This script must be run as root.'));
      console.log(chalk.yellow('Please run with: sudo npm run install'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Unable to check root privileges.'));
    process.exit(1);
  }
}

// Detect Linux distribution
function detectDistribution() {
  try {
    // Try to read os-release file
    if (fs.existsSync('/etc/os-release')) {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      
      if (osRelease.includes('ID=fedora')) return 'fedora';
      if (osRelease.includes('ID=kali')) return 'kali';
      if (osRelease.includes('ID=parrot')) return 'parrot';
      if (osRelease.includes('ID=arch')) return 'arch';
    }
    
    // Try to run lsb_release command
    try {
      const lsb = execSync('lsb_release -i').toString().toLowerCase();
      if (lsb.includes('fedora')) return 'fedora';
      if (lsb.includes('kali')) return 'kali';
      if (lsb.includes('parrot')) return 'parrot';
      if (lsb.includes('arch')) return 'arch';
    } catch (e) {
      // lsb_release not available, continue with other methods
    }
    
    // Try checking for specific distribution files
    if (fs.existsSync('/etc/fedora-release')) return 'fedora';
    if (fs.existsSync('/etc/arch-release')) return 'arch';
    
    return null;
  } catch (error) {
    console.error(chalk.red(`Error detecting distribution: ${error.message}`));
    return null;
  }
}

// Install macchanger package
function installMacchanger(distro) {
  const spinner = ora('Installing macchanger package...').start();
  
  try {
    let command;
    
    switch (distro) {
      case 'fedora':
        command = 'dnf install -y macchanger';
        break;
      case 'kali':
      case 'parrot':
        command = 'apt-get update && apt-get install -y macchanger';
        break;
      case 'arch':
        command = 'pacman -Sy --noconfirm macchanger';
        break;
      default:
        spinner.fail('Unsupported distribution');
        process.exit(1);
    }
    
    execSync(command, { stdio: 'ignore' });
    spinner.succeed('Macchanger installed successfully');
    return true;
  } catch (error) {
    spinner.fail(`Failed to install macchanger: ${error.message}`);
    return false;
  }
}

// Get available network interfaces
function getNetworkInterfaces() {
  try {
    const interfacesOutput = execSync('ip link show').toString();
    const interfaces = [];
    const lines = interfacesOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\d+:\s+([^:@\s]+)/);
      if (match && match[1] !== 'lo') {
        interfaces.push(match[1]);
      }
    }
    
    return interfaces;
  } catch (error) {
    console.error(chalk.red(`Error getting network interfaces: ${error.message}`));
    return [];
  }
}

// Create systemd service
function createSystemdService(config) {
  const spinner = ora('Creating systemd service...').start();
  
  try {
    const serviceContent = `[Unit]
Description=Auto MAC Changer Service
After=network.target

[Service]
ExecStart=${SCRIPT_PATH}
Restart=on-failure
RestartSec=30
User=root
Group=root

[Install]
WantedBy=multi-user.target
`;

    fs.writeFileSync(SERVICE_FILE, serviceContent);
    
    // Create executable script
    const scriptContent = `#!/bin/sh
node ${path.resolve(__dirname, 'index.js')}
`;
    
    fs.writeFileSync(SCRIPT_PATH, scriptContent);
    fs.chmodSync(SCRIPT_PATH, '755');
    
    // Enable and start the service
    execSync('systemctl daemon-reload');
    execSync('systemctl enable auto-mac-changer.service');
    execSync('systemctl start auto-mac-changer.service');
    
    spinner.succeed('Systemd service created and started');
    return true;
  } catch (error) {
    spinner.fail(`Failed to create systemd service: ${error.message}`);
    return false;
  }
}

// Main installation function
async function install() {
  console.log(chalk.blue.bold('===== Auto MAC Changer - Installation ====='));
  
  // Check if running as root
  checkRoot();
  
  // Detect distribution
  const spinner = ora('Detecting Linux distribution...').start();
  const distro = detectDistribution();
  
  if (!distro) {
    spinner.fail('Unsupported Linux distribution');
    console.log(chalk.yellow('This tool only supports Fedora, Kali, Parrot, and Arch Linux.'));
    process.exit(1);
  }
  
  spinner.succeed(`Detected ${distro.charAt(0).toUpperCase() + distro.slice(1)} Linux`);
  
  // Install macchanger
  if (!installMacchanger(distro)) {
    console.error(chalk.red('Failed to install macchanger. Installation aborted.'));
    process.exit(1);
  }
  
  // Get available interfaces
  const interfaces = getNetworkInterfaces();
  
  if (interfaces.length === 0) {
    console.error(chalk.red('No network interfaces found. Installation aborted.'));
    process.exit(1);
  }
  
  // User configuration
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'interval',
      message: 'How often do you want to change MAC addresses (in seconds)?',
      default: 300,
      validate: (value) => value > 0 ? true : 'Please enter a positive number'
    },
    {
      type: 'checkbox',
      name: 'interfaces',
      message: 'Select network interfaces to change MAC addresses:',
      choices: interfaces,
      validate: (value) => value.length > 0 ? true : 'Please select at least one interface'
    }
  ]);
  
  // Create configuration directory and file
  const configSpinner = ora('Creating configuration...').start();
  
  try {
    fs.ensureDirSync(CONFIG_DIR);
    
    const config = {
      interval: answers.interval,
      interfaces: answers.interfaces,
      randomize: true,
      enabled: true
    };
    
    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
    configSpinner.succeed('Configuration created successfully');
  } catch (error) {
    configSpinner.fail(`Failed to create configuration: ${error.message}`);
    process.exit(1);
  }
  
  // Create and start systemd service
  if (!createSystemdService()) {
    console.error(chalk.red('Failed to create systemd service. Installation not complete.'));
    process.exit(1);
  }
  
  console.log('\n' + chalk.green.bold('✓ Auto MAC Changer installed successfully!'));
  console.log(chalk.blue(`MAC addresses will change every ${chalk.bold(answers.interval)} seconds`));
  console.log(chalk.blue(`Service status: ${chalk.bold('RUNNING')}`));
  console.log(chalk.blue(`Configuration file: ${chalk.bold(CONFIG_FILE)}`));
  console.log('\nTo check service status: ' + chalk.yellow('systemctl status auto-mac-changer'));
  console.log('To stop the service: ' + chalk.yellow('systemctl stop auto-mac-changer'));
  console.log('To disable on boot: ' + chalk.yellow('systemctl disable auto-mac-changer'));
}

// Run installation
install().catch(error => {
  console.error(chalk.red(`Installation error: ${error.message}`));
  process.exit(1);
});