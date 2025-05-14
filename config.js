#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Configuration paths
const CONFIG_DIR = '/etc/auto-mac-changer';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Check if running as root
function checkRoot() {
  try {
    if (process.getuid() !== 0) {
      console.error(chalk.red('This script must be run as root.'));
      console.log(chalk.yellow('Please run with: sudo node config.js'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Unable to check root privileges.'));
    process.exit(1);
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

// Load current configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return fs.readJsonSync(CONFIG_FILE);
    }
    console.error(chalk.red('Configuration file not found.'));
    process.exit(1);
  } catch (error) {
    console.error(chalk.red(`Error loading configuration: ${error.message}`));
    process.exit(1);
  }
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
    console.log(chalk.green('Configuration saved successfully.'));
    
    // Restart service to apply changes
    console.log(chalk.blue('Restarting service to apply changes...'));
    execSync('systemctl restart auto-mac-changer.service');
    console.log(chalk.green('Service restarted.'));
  } catch (error) {
    console.error(chalk.red(`Error saving configuration: ${error.message}`));
    process.exit(1);
  }
}

// Configure the tool
async function configure() {
  console.log(chalk.blue.bold('===== Auto MAC Changer - Configuration ====='));
  
  // Check if running as root
  checkRoot();
  
  // Load current configuration
  const currentConfig = loadConfig();
  
  // Get available interfaces
  const interfaces = getNetworkInterfaces();
  
  if (interfaces.length === 0) {
    console.error(chalk.red('No network interfaces found.'));
    process.exit(1);
  }
  
  // User configuration
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'interval',
      message: 'How often do you want to change MAC addresses (in seconds)?',
      default: currentConfig.interval || 300,
      validate: (value) => value > 0 ? true : 'Please enter a positive number'
    },
    {
      type: 'checkbox',
      name: 'interfaces',
      message: 'Select network interfaces to change MAC addresses:',
      choices: interfaces,
      default: currentConfig.interfaces || [],
      validate: (value) => value.length > 0 ? true : 'Please select at least one interface'
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable auto MAC changing?',
      default: currentConfig.enabled !== undefined ? currentConfig.enabled : true
    }
  ]);
  
  // Update configuration
  const newConfig = {
    ...currentConfig,
    interval: answers.interval,
    interfaces: answers.interfaces,
    enabled: answers.enabled
  };
  
  // Save configuration
  saveConfig(newConfig);
}

// Run configuration
configure().catch(error => {
  console.error(chalk.red(`Configuration error: ${error.message}`));
  process.exit(1);
});