#!/usr/bin/env node

const fs = require('fs-extra');
const { execSync, exec } = require('child_process');
const path = require('path');
const winston = require('winston');
const cron = require('node-cron');
const chalk = require('chalk');

// Configuration paths
const CONFIG_DIR = '/etc/auto-mac-changer';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOG_FILE = path.join(CONFIG_DIR, 'mac-changer.log');

// Set up logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: LOG_FILE }),
    new winston.transports.Console()
  ]
});

// Default configuration
const defaultConfig = {
  interval: 300, // seconds
  interfaces: [],
  randomize: true,
  enabled: true
};

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = fs.readJsonSync(CONFIG_FILE);
      return { ...defaultConfig, ...config };
    }
    logger.error('Configuration file not found. Please run installation.');
    process.exit(1);
  } catch (error) {
    logger.error(`Error loading configuration: ${error.message}`);
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
    logger.error(`Error getting network interfaces: ${error.message}`);
    return [];
  }
}

// Change MAC address for a specific interface
async function changeMac(interface) {
  try {
    logger.info(`Changing MAC address for ${interface}`);
    
    // Take down the interface
    execSync(`ip link set dev ${interface} down`);
    
    // Change the MAC address
    execSync(`macchanger -r ${interface}`);
    
    // Bring the interface back up
    execSync(`ip link set dev ${interface} up`);
    
    // Get the new MAC address
    const newMacOutput = execSync(`macchanger -s ${interface}`).toString();
    const macMatch = newMacOutput.match(/Current MAC:\s+([0-9a-f:]+)/i);
    
    if (macMatch) {
      const newMac = macMatch[1];
      logger.info(`Successfully changed MAC address for ${interface} to ${newMac}`);
      console.log(chalk.green(`✓ MAC address for ${interface} changed to ${chalk.bold(newMac)}`));
      return true;
    } else {
      throw new Error('Failed to retrieve new MAC address');
    }
  } catch (error) {
    logger.error(`Error changing MAC for ${interface}: ${error.message}`);
    console.log(chalk.red(`✗ Failed to change MAC address for ${interface}: ${error.message}`));
    return false;
  }
}

// Change MAC addresses for all configured interfaces
async function changeAllMacs() {
  const config = loadConfig();
  
  // If no interfaces are configured, try to use all available interfaces
  const interfaces = config.interfaces.length > 0 
    ? config.interfaces 
    : getNetworkInterfaces();
  
  if (interfaces.length === 0) {
    logger.error('No network interfaces available');
    return;
  }
  
  console.log(chalk.blue('Changing MAC addresses...'));
  
  for (const interface of interfaces) {
    await changeMac(interface);
  }
}

// Main function
async function main() {
  try {
    console.log(chalk.blue.bold('Auto MAC Changer - Starting service'));
    
    const config = loadConfig();
    logger.info('Service started with configuration: ' + JSON.stringify(config));
    
    if (!config.enabled) {
      logger.info('Service is disabled in configuration');
      console.log(chalk.yellow('Service is currently disabled in configuration. Exiting.'));
      process.exit(0);
    }
    
    // Immediate first change
    await changeAllMacs();
    
    // Convert seconds to cron expression
    // For testing, use seconds: `*/${config.interval} * * * * *`
    // For production, use minutes: `*/${Math.ceil(config.interval / 60)} * * * *`
    const cronExpression = `*/${Math.ceil(config.interval / 60)} * * * *`;
    
    logger.info(`Scheduling MAC changes with interval: ${config.interval} seconds (cron: ${cronExpression})`);
    console.log(chalk.blue(`MAC addresses will change every ${chalk.bold(config.interval)} seconds`));
    
    // Schedule regular changes
    cron.schedule(cronExpression, async () => {
      logger.info('Running scheduled MAC address change');
      await changeAllMacs();
    });
    
    console.log(chalk.green.bold('Auto MAC Changer service is running'));
  } catch (error) {
    logger.error(`Service error: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Handle signals for graceful shutdown
process.on('SIGINT', () => {
  logger.info('Service stopped by user');
  console.log(chalk.yellow('\nStopping Auto MAC Changer service'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Service terminated');
  console.log(chalk.yellow('\nAuto MAC Changer service terminated'));
  process.exit(0);
});

// Start the service
main();