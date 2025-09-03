#!/usr/bin/env node

/**
 * Display WhatsApp QR Code for connection
 */

const axios = require('axios');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');

const EVOLUTION_API_URL = 'http://localhost:8080';
const EVOLUTION_API_KEY = 'ai-pbx-key-2024';
const EVOLUTION_INSTANCE_ID = 'aipbx';

async function showQRCode() {
  try {
    console.log(chalk.cyan('\n==========================================='));
    console.log(chalk.cyan('WhatsApp Connection QR Code'));
    console.log(chalk.cyan('===========================================\n'));

    // Get connection status
    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_ID}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    );

    const state = statusResponse.data.instance?.state;
    
    if (state === 'open') {
      console.log(chalk.green('✓ WhatsApp is already connected!'));
      process.exit(0);
    }

    // Get QR code
    const qrResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_ID}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    );

    if (qrResponse.data.pairingCode) {
      console.log(chalk.yellow('Pairing Code:'), chalk.white.bold(qrResponse.data.pairingCode));
      console.log(chalk.gray('Enter this code in WhatsApp > Linked Devices > Link with phone number\n'));
    }

    if (qrResponse.data.code) {
      console.log(chalk.yellow('QR Code:'));
      // Display QR code in terminal
      qrcode.generate(qrResponse.data.code, { small: true });
      
      console.log(chalk.cyan('\nInstructions:'));
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings > Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan the QR code above');
      console.log('5. Wait for connection confirmation\n');
      
      // Monitor connection
      console.log(chalk.yellow('Monitoring connection status...'));
      
      let connected = false;
      let attempts = 0;
      const maxAttempts = 60; // 1 minute timeout
      
      while (!connected && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const checkStatus = await axios.get(
            `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_ID}`,
            { headers: { apikey: EVOLUTION_API_KEY } }
          );
          
          if (checkStatus.data.instance?.state === 'open') {
            connected = true;
            console.log(chalk.green('\n✓ WhatsApp connected successfully!'));
          } else {
            process.stdout.write('.');
          }
        } catch (error) {
          // Ignore errors during monitoring
        }
        
        attempts++;
      }
      
      if (!connected) {
        console.log(chalk.yellow('\n\nQR Code expired or connection timeout.'));
        console.log('Run this script again to generate a new QR code.');
      }
    } else {
      console.log(chalk.red('No QR code available. The instance might already be connecting.'));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    if (error.response) {
      console.error(chalk.red('Response:'), error.response.data);
    }
    process.exit(1);
  }
}

// Check if qrcode-terminal is installed
try {
  require.resolve('qrcode-terminal');
  showQRCode();
} catch (e) {
  console.log(chalk.yellow('Installing qrcode-terminal...'));
  require('child_process').execSync('npm install qrcode-terminal', { stdio: 'inherit' });
  showQRCode();
}