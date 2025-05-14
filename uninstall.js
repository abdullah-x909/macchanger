#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');

// Configuration paths
const CONFIG_DIR = '/etc/auto-mac-changer';
const SERVICE_FILE = '/etc/systemd/system/auto-mac-changer.service';
const SCRIPT_PATH = '/usr/local/bin/auto-mac-changer';

// Check if running as root
function checkRoot() {
  try {
    if (process.getuid() !== 0) {
      console.error(chalk.red('This script must be run as root.'));
      console.log(chalk.yellow('Please run with: sudo node uninstall.js'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Unable to check root privileges.'));
    process.exit(1);
  }
}

// Stop and disable the service
function stopService() {
  const spinner = ora('Stopping and disabling service...').start();
  
  try {
    // Check if service exists before stopping
    const serviceExists = fs.existsSync(SERVICE_FILE);
    
    if (serviceExists) {
      try {
        execSync('systemctl stop auto-mac-changer.service');
      } catch (error) {
        // Service might already be stopped, continue
      }
      
      try {
        execSync('systemctl disable auto-mac-changer.service');
      } catch (error) {
        // Service might already be disabled, continue
      }
    }
    
    spinner.succeed('Service stopped and disabled');
    return true;
  } catch (error) {
    spinner.fail(`Failed to stop service: ${error.message}`);
    return false;
  }
}

// Remove files
function removeFiles() {
  const spinner = ora('Removing files...').start();
  
  try {
    // Remove service file
    if (fs.existsSync(SERVICE_FILE)) {
      fs.unlinkSync(SERVICE_FILE);
    }
    
    // Remove executable script
    if (fs.existsSync(SCRIPT_PATH)) {
      fs.unlinkSync(SCRIPT_PATH);
    }
    
    // Remove configuration directory
    if (fs.existsSync(CONFIG_DIR)) {
      fs.removeSync(CONFIG_DIR);
    }
    
    // Reload systemd
    execSync('systemctl daemon-reload');
    
    spinner.succeed('Files removed successfully');
    return true;
  } catch (error) {
    spinner.fail(`Failed to remove files: ${error.message}`);
    return false;
  }
}

// Main uninstallation function
function uninstall() {
  console.log(chalk.blue.bold('===== Auto MAC Changer - Uninstallation ====='));
  
  // Check if running as root
  checkRoot();
  
  // Stop and disable service
  stopService();
  
  // Remove files
  removeFiles();
  
  console.log('\n' + chalk.green.bold('✓ Auto MAC Changer uninstalled successfully!'));
  console.log(chalk.yellow('Note: The macchanger package was not removed.'));
  console.log(chalk.yellow('If you want to remove it, run:'));
  console.log('  - Fedora: ' + chalk.blue('sudo dnf remove macchanger'));
  console.log('  - Kali/Parrot: ' + chalk.blue('sudo apt-get remove macchanger'));
  console.log('  - Arch: ' + chalk.blue('sudo pacman -R macchanger'));
}

// Run uninstallation
uninstall();