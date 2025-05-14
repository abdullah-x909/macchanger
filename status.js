#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Configuration paths
const CONFIG_DIR = '/etc/auto-mac-changer';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOG_FILE = path.join(CONFIG_DIR, 'mac-changer.log');

// Check service status
function checkServiceStatus() {
  try {
    const status = execSync('systemctl is-active auto-mac-changer.service').toString().trim();
    return status === 'active';
  } catch (error) {
    return false;
  }
}

// Get current MAC addresses
function getCurrentMacs(interfaces) {
  const macs = {};
  
  for (const interface of interfaces) {
    try {
      const output = execSync(`macchanger -s ${interface}`).toString();
      const macMatch = output.match(/Current MAC:\s+([0-9a-f:]+)/i);
      
      if (macMatch) {
        macs[interface] = macMatch[1];
      } else {
        macs[interface] = 'Unknown';
      }
    } catch (error) {
      macs[interface] = 'Error';
    }
  }
  
  return macs;
}

// Get recent log entries
function getRecentLogs(count = 10) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const logs = execSync(`tail -n ${count} ${LOG_FILE}`).toString().trim().split('\n');
      return logs;
    }
    return [];
  } catch (error) {
    console.error(chalk.red(`Error reading logs: ${error.message}`));
    return [];
  }
}

// Load configuration
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

// Display status
function showStatus() {
  console.log(chalk.blue.bold('===== Auto MAC Changer - Status =====\n'));
  
  // Check if running as root
  try {
    if (process.getuid() !== 0) {
      console.warn(chalk.yellow('Warning: Not running as root. Some information may be limited.'));
    }
  } catch (error) {
    // Ignore if we can't check
  }
  
  // Check service status
  const isActive = checkServiceStatus();
  console.log(`Service status: ${isActive ? chalk.green('RUNNING') : chalk.red('STOPPED')}`);
  
  // Load configuration
  try {
    const config = loadConfig();
    console.log(`\nConfiguration:`);
    console.log(`- Change interval: ${chalk.blue(config.interval)} seconds`);
    console.log(`- Service enabled: ${config.enabled ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`- Configured interfaces: ${chalk.blue(config.interfaces.join(', '))}`);
    
    // Show current MAC addresses
    if (config.interfaces.length > 0) {
      console.log(`\nCurrent MAC addresses:`);
      const macs = getCurrentMacs(config.interfaces);
      
      for (const [interface, mac] of Object.entries(macs)) {
        console.log(`- ${interface}: ${chalk.blue(mac)}`);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error loading status: ${error.message}`));
  }
  
  // Show recent logs
  const logs = getRecentLogs();
  if (logs.length > 0) {
    console.log(`\nRecent activity (last ${logs.length} log entries):`);
    logs.forEach(log => console.log(`- ${log}`));
  }
  
  console.log('\nCommands:');
  console.log('- Start service: ' + chalk.yellow('sudo systemctl start auto-mac-changer'));
  console.log('- Stop service: ' + chalk.yellow('sudo systemctl stop auto-mac-changer'));
  console.log('- Configure settings: ' + chalk.yellow('sudo node config.js'));
}

// Run status check
showStatus();