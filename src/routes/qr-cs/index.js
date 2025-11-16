const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * QR Code page for CS Ticket Monitor
 * This instance monitors WhatsApp groups for customer service tickets
 */
router.get('/qr-cs', async (req, res) => {
  try {
    logger.info('CS Ticket Monitor QR page requested');
    
    // For CS Ticket Monitor, we use a dedicated Evolution instance
    const axios = require('axios');
    const evolutionApiUrl = config.evolution.apiUrl;
    const evolutionApiKey = config.evolution.apiKey;
    const instanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';

    // Get connection status
    const statusResponse = await axios.get(
      `${evolutionApiUrl}/instance/connectionState/${instanceId}`,
      {
        headers: { apikey: evolutionApiKey }
      }
    );

    const isConnected = statusResponse.data?.instance?.state === 'open';

    let qrContent = '';
    if (!isConnected) {
      // Get QR code if not connected
      try {
        const qrResponse = await axios.get(
          `${evolutionApiUrl}/instance/connect/${instanceId}`,
          {
            headers: { apikey: evolutionApiKey }
          }
        );
        
        if (qrResponse.data?.base64) {
          qrContent = `
            <div class="qr-box">
              <h3>📱 Scan this QR Code</h3>
              <img class="qr-image" src="${qrResponse.data.base64}" alt="CS Ticket Monitor QR Code">
            </div>`;
        } else if (qrResponse.data?.code) {
          qrContent = `
            <div class="qr-box">
              <h3>📱 QR Code String</h3>
              <p style="word-break: break-all; font-family: monospace; font-size: 0.8em; padding: 20px; background: white; border-radius: 8px;">
                ${qrResponse.data.code}
              </p>
              <p style="color: #666; font-size: 0.9em;">Copy and paste this code in WhatsApp Web</p>
            </div>`;
        }
      } catch (qrError) {
        logger.error('Failed to get QR code for CS Monitor', { error: qrError.message });
        qrContent = `
          <div class="error-box">
            <h3>⚠️ QR Code Not Available</h3>
            <p>Unable to generate QR code. Please check Evolution API.</p>
            <div class="troubleshoot">
              <strong>Troubleshooting:</strong>
              <ul>
                <li>Ensure Evolution API is running on port 8080</li>
                <li>Check CS_INSTANCE_ID environment variable</li>
                <li>Verify Evolution API key is correct</li>
              </ul>
            </div>
          </div>`;
      }
    } else {
      qrContent = `
        <div class="success-box">
          <h2>✅ WhatsApp Connected!</h2>
          <p>CS Ticket Monitor is active and monitoring groups.</p>
          <div class="phone-info">
            <strong>Instance:</strong> ${instanceId}<br>
            <strong>Status:</strong> ${statusResponse.data?.instance?.state || 'Connected'}<br>
            <strong>Mode:</strong> Group Monitoring Enabled
          </div>
        </div>`;
    }
    
    // Server-side render the QR code page with CS-specific styling
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>CS Ticket Monitor - QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin-top: 30px;
        }
        .title {
            color: #4caf50;
            margin-bottom: 10px;
            font-size: 2.5em;
            font-weight: bold;
        }
        .subtitle {
            color: #666;
            font-size: 1.1em;
            margin-bottom: 30px;
        }
        .qr-box {
            background: #f1f8e9;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            border: 3px solid #4caf50;
        }
        .success-box {
            background: linear-gradient(135deg, #66bb6a 0%, #81c784 100%);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            color: white;
        }
        .error-box {
            background: linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            color: #c62828;
        }
        .troubleshoot {
            text-align: left;
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.8);
            border-radius: 10px;
        }
        .troubleshoot ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .qr-image {
            max-width: 350px;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .badge {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .warning {
            background: linear-gradient(135deg, #ff9800 0%, #ffc107 100%);
            color: #e65100;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 500;
        }
        .feature-list {
            text-align: left;
            background: #f1f8e9;
            border-left: 4px solid #4caf50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .feature-list h4 {
            color: #4caf50;
            margin-bottom: 15px;
        }
        .feature-list ul, .feature-list ol {
            color: #555;
            line-height: 1.8;
        }
        .refresh-link {
            display: inline-block;
            background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 30px;
            margin: 20px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        .refresh-link:hover {
            transform: scale(1.05);
        }
        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 20px;
            background: #e8f5e8;
            color: #2e7d32;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .pulse {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #4caf50;
            animation: pulse 2s infinite;
        }
        .phone-info {
            background: rgba(255,255,255,0.9);
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            color: #333;
            font-size: 0.95em;
        }
        .monitoring-status {
            background: #e3f2fd;
            border: 2px solid #2196f3;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            color: #1976d2;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .group-management-section {
            background: #f8f9fa;
            border: 2px solid #28a745;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .group-management-section h4 {
            color: #28a745;
            margin-bottom: 15px;
            text-align: center;
        }
        
        /* Monitored Groups Section */
        .monitored-groups-section {
            background: #e8f5e9;
            border: 2px solid #4caf50;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .monitored-groups-section h4 {
            color: #2e7d32;
            margin-bottom: 15px;
            text-align: center;
            font-size: 1.2em;
        }
        .monitored-filters {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
        }
        #filterMonitored {
            flex: 1;
            min-width: 200px;
            max-width: 300px;
            padding: 10px 15px;
            border: 2px solid #81c784;
            border-radius: 8px;
            font-size: 1em;
        }
        #sortMonitored {
            padding: 10px 15px;
            border: 2px solid #81c784;
            border-radius: 8px;
            background: white;
            font-size: 1em;
            min-width: 180px;
        }
        
        /* Add Groups Section */
        .add-groups-section {
            background: #e3f2fd;
            border: 2px solid #2196f3;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .add-groups-section h4 {
            color: #1976d2;
            margin-bottom: 15px;
            text-align: center;
            font-size: 1.2em;
        }
        .search-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
        }
        #searchGroups {
            flex: 1;
            min-width: 250px;
            max-width: 400px;
            padding: 10px 15px;
            border: 2px solid #64b5f6;
            border-radius: 8px;
            font-size: 1em;
        }
        
        /* Button Styles */
        .btn-primary {
            background: #2196f3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.3s ease;
        }
        .btn-primary:hover {
            background: #1976d2;
        }
        .btn-secondary {
            background: #757575;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.3s ease;
        }
        .btn-secondary:hover {
            background: #616161;
        }
        
        /* Groups List */
        .groups-list {
            min-height: 150px;
        }
        
        /* Search Status */
        .search-status {
            text-align: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 8px;
            margin-bottom: 15px;
            font-style: italic;
            color: #666;
        }
        
        /* Load More Button */
        .load-more-btn {
            display: block;
            width: 100%;
            padding: 12px;
            background: #f5f5f5;
            border: 2px dashed #ccc;
            border-radius: 8px;
            color: #666;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 15px;
        }
        .load-more-btn:hover {
            background: #e0e0e0;
            border-color: #999;
        }
        .group-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: white;
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            transition: all 0.2s ease;
        }
        .group-item:hover {
            border-color: #28a745;
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1);
        }
        .group-info {
            flex: 1;
        }
        .group-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
        }
        .group-details {
            font-size: 0.85em;
            color: #666;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #28a745;
        }
        input:checked + .slider:before {
            transform: translateX(26px);
        }
        .loading-message {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .no-groups-message {
            text-align: center;
            padding: 40px;
            color: #666;
            background: white;
            border-radius: 8px;
            margin: 10px 0;
        }
        .bulk-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            justify-content: center;
        }
        .bulk-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background 0.2s;
        }
        .bulk-btn:hover {
            background: #218838;
        }
        .bulk-btn.secondary {
            background: #6c757d;
        }
        .bulk-btn.secondary:hover {
            background: #5a6268;
        }
        .filters-section {
            background: #f8f9fa;
            border: 2px solid #007bff;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .filters-section h4 {
            color: #007bff;
            margin-bottom: 15px;
            text-align: center;
            font-size: 1.1em;
        }
        .filter-row {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
        }
        #groupSearch {
            flex: 1;
            min-width: 200px;
            max-width: 300px;
            padding: 8px 12px;
            border: 2px solid #ced4da;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        #groupSearch:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25);
        }
        #sortOrder {
            padding: 8px 12px;
            border: 2px solid #ced4da;
            border-radius: 6px;
            background: white;
            font-size: 14px;
            cursor: pointer;
            transition: border-color 0.2s;
        }
        #sortOrder:focus {
            outline: none;
            border-color: #007bff;
        }
        .activity-filter {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 8px 12px;
            background: white;
            border: 2px solid #ced4da;
            border-radius: 6px;
            transition: all 0.2s;
            font-size: 14px;
        }
        .activity-filter:hover {
            border-color: #007bff;
            background: #f8f9fa;
        }
        .activity-filter input[type="checkbox"] {
            margin: 0;
        }
        .filter-status {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }
        @media (max-width: 768px) {
            .filter-row {
                flex-direction: column;
                align-items: stretch;
            }
            #groupSearch {
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">🎫 CS Ticket Monitor</h1>
        <p class="subtitle">WhatsApp Group Customer Service Monitoring</p>
        
        <div class="badge">Instance: ${instanceId}</div>
        <div class="status-indicator">
            <span class="pulse"></span>
            <span>Auto-refresh every 30 seconds</span>
        </div>

        <div class="warning">
            <strong>📋 GROUP MONITORING:</strong> This WhatsApp line monitors customer service groups!
            <br>CS Ticket Monitor will detect and log tickets from group conversations.
        </div>

        ${qrContent}

        <div class="feature-list">
            <h4>🎯 What CS Ticket Monitor Does:</h4>
            <ul>
                <li>👥 <strong>Monitors WhatsApp Groups</strong> for customer service tickets</li>
                <li>🤖 <strong>AI-Powered Detection</strong> identifies customer issues automatically</li>
                <li>📊 <strong>Google Sheets Integration</strong> logs all tickets with timestamps</li>
                <li>⏰ <strong>Follow-up Automation</strong> sends reminders for stale tickets</li>
                <li>🔄 <strong>Status Tracking</strong> monitors ticket resolution progress</li>
                <li>📈 <strong>Analytics Dashboard</strong> tracks team performance metrics</li>
            </ul>
        </div>

        <div class="feature-list">
            <h4>🔧 Setup Instructions:</h4>
            <ol>
                <li>Open WhatsApp on a <strong>dedicated device</strong> (phone or tablet)</li>
                <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>"Link a Device"</strong></li>
                <li>Scan the QR code above</li>
                <li>Add this device to your <strong>customer service groups</strong></li>
                <li>CS Monitor will start detecting tickets automatically!</li>
            </ol>
        </div>

        <div class="monitoring-status">
            <h4>📊 Current Monitoring Status:</h4>
            <ul>
                <li>Group Messages: <strong>${isConnected ? 'Receiving' : 'Pending Connection'}</strong></li>
                <li>Ticket Detection: <strong>${isConnected ? 'Active' : 'Waiting for Connection'}</strong></li>
                <li>Google Sheets: <strong>Ready for Integration</strong></li>
                <li>Follow-up System: <strong>Operational</strong></li>
            </ul>
        </div>

        <!-- Monitored Groups Section -->
        <div class="monitored-groups-section" style="margin-top: 30px;">
            <h4>📊 Monitored Groups (<span id="monitoredCount">0</span> active)</h4>
            
            <div class="monitored-filters">
                <input type="text" id="filterMonitored" placeholder="🔍 Filter monitored groups..." />
                <select id="sortMonitored">
                    <option value="recent">Most Recent Activity</option>
                    <option value="alphabetical">Alphabetical</option>
                </select>
            </div>
            
            <div id="monitoredGroupsList" class="groups-list">
                <div class="loading-message">
                    <span>🔄 Loading monitored groups...</span>
                    <p style="font-size: 0.9em; color: #666;">Your actively monitored groups will appear here.</p>
                </div>
            </div>
            
            <button id="loadMoreMonitored" class="load-more-btn" style="display: none;">
                Load More Monitored Groups...
            </button>
        </div>

        <!-- History Processing Section -->
        <div class="history-processing-section" style="margin-top: 30px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 20px;">
            <h4>🕒 Automatic History Processing</h4>
            <p style="color: #666; margin-bottom: 20px;">Automatically fetch and process all conversation history from monitored WhatsApp groups to extract tickets and add them to Google Sheets.</p>
            
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px; flex-wrap: wrap;">
                <button id="processHistoryBtn" class="btn-primary" style="padding: 12px 25px; font-size: 16px;">
                    💾 Process Group History
                </button>
                <button id="forceSyncBtn" class="btn btn-warning" style="padding: 12px 25px; font-size: 16px; background: #ff9800; color: white; border: none; border-radius: 4px;">
                    🔄 Force Sync from WhatsApp
                </button>
                <span id="historyStatus" style="font-weight: bold; color: #666; flex: 1;"></span>
            </div>
            
            <div style="background: #f0f8ff; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.9em;">
                <strong>💾 Process Group History:</strong> Tries database first, falls back to WhatsApp sync if no messages found.<br>
                <strong>🔄 Force Sync:</strong> Directly fetches recent messages from WhatsApp (slower but more comprehensive).
            </div>
            
            <div id="historyResults" style="display: none; margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                <h5>📊 Processing Results:</h5>
                <div id="historyResultsContent">
                    <!-- Results will appear here -->
                </div>
            </div>
        </div>

        <!-- Add Groups Section -->
        <div class="add-groups-section" style="margin-top: 30px;">
            <h4>➕ Add Groups to Monitor</h4>
            
            <div class="search-controls">
                <input type="text" id="searchGroups" placeholder="🔍 Search available groups..." />
                <button id="searchBtn" class="btn-primary">Search</button>
                <button id="syncBtn" class="btn-secondary">Sync ↻</button>
            </div>
            
            <div id="searchStatus" class="search-status">
                Type to search from <span id="totalGroups">0</span> available groups...
            </div>
            
            <div id="searchResults" class="groups-list">
                <!-- Search results will appear here -->
            </div>
        </div>

        <div class="feature-list" style="background: #fff3e0; border-left-color: #ff9800;">
            <h4>⚙️ Configuration Status:</h4>
            <ul>
                <li>Instance ID: <strong>${instanceId}</strong></li>
                <li>Group Monitoring: <strong>Enabled</strong></li>
                <li>AI Detection: <strong>Operational</strong></li>
                <li>Webhook Path: <strong>/webhook/cs-tickets</strong></li>
                <li>Auto-refresh: <strong>30 seconds</strong></li>
            </ul>
        </div>

        <div class="feature-list" style="background: #f3e5f5; border-left-color: #9c27b0;" id="moduleStatusSection">
            <h4>🚀 Module Development Status:</h4>
            <ul>
                <li>✅ <strong>Module A:</strong> Evolution Instance & QR UI (Operational)</li>
                <li>✅ <strong>Module B:</strong> OpenAI Ticket Detection (Operational)</li>
                <li>✅ <strong>Module C:</strong> Google Sheets Integration (Operational)</li>
                <li>✅ <strong>Module D:</strong> Follow-up Scheduler (Operational)</li>
            </ul>
        </div>

        <a href="/qr-cs" class="refresh-link">🔄 Refresh Status</a>
    </div>

    <script>
        // Test console log to verify JavaScript is running
        console.log('🚀 JavaScript is running! Page loaded at:', new Date().toISOString());
        console.log('🔧 Browser info:', navigator.userAgent);
        console.log('🔄 Server Version: 2025-11-09T01:04 (Post-restart fix)');
        
        // Log module status section loading
        const moduleStatusSection = document.getElementById('moduleStatusSection');
        if (moduleStatusSection) {
            console.log('✅ Module Status Section loaded:', {
                element: moduleStatusSection,
                innerHTML: moduleStatusSection.innerHTML.substring(0, 200) + '...',
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('❌ Module Status Section NOT FOUND');
        }
        
        // New Group Management Functionality
        let monitoredGroups = [];
        let searchResults = [];
        let totalGroupsCount = 0;
        let searchCache = new Map(); // Cache for search results
        
        
        // Error tracking for CSP violations
        window.addEventListener('error', function(e) {
            console.error('🚨 ALL ERRORS DETECTED:', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack,
                timestamp: new Date().toISOString(),
                isCSP: e.message && e.message.includes('Content Security Policy')
            });
        });

        // Security policy violation listener
        document.addEventListener('securitypolicyviolation', function(e) {
            console.error('🛡️ SECURITY POLICY VIOLATION:', {
                blockedURI: e.blockedURI,
                columnNumber: e.columnNumber,
                disposition: e.disposition,
                documentURI: e.documentURI,
                effectiveDirective: e.effectiveDirective,
                lineNumber: e.lineNumber,
                originalPolicy: e.originalPolicy,
                referrer: e.referrer,
                sample: e.sample,
                sourceFile: e.sourceFile,
                violatedDirective: e.violatedDirective,
                timestamp: new Date().toISOString()
            });
        });

        // Load groups on page load
        document.addEventListener('DOMContentLoaded', function() {
            console.log('📋 DOMContentLoaded event fired, starting initialization...');
            initializeCSSystemThenLoadMonitoredGroups();
            initializeNewControls();
        });
        
        function initializeNewControls() {
            console.log('🔧 Initializing new UI controls...');
            
            // Monitored groups filter
            let monitoredFilterTimeout;
            const monitoredFilter = document.getElementById('filterMonitored');
            if (monitoredFilter) {
                monitoredFilter.addEventListener('input', function(e) {
                    clearTimeout(monitoredFilterTimeout);
                    monitoredFilterTimeout = setTimeout(() => {
                        filterMonitoredGroups(e.target.value);
                    }, 300);
                });
            }
            
            // Monitored groups sort
            const monitoredSort = document.getElementById('sortMonitored');
            if (monitoredSort) {
                monitoredSort.addEventListener('change', function(e) {
                    sortMonitoredGroups(e.target.value);
                });
            }
            
            // Search groups with debouncing
            let searchTimeout;
            const searchInput = document.getElementById('searchGroups');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        if (e.target.value.trim().length >= 2) {
                            searchGroups(e.target.value.trim());
                        } else {
                            clearSearchResults();
                        }
                    }, 300);
                });
            }
            
            // Search button
            const searchBtn = document.getElementById('searchBtn');
            if (searchBtn) {
                searchBtn.addEventListener('click', function() {
                    const searchTerm = document.getElementById('searchGroups').value.trim();
                    if (searchTerm.length >= 2) {
                        searchGroups(searchTerm);
                    }
                });
            }
            
            // Sync button
            const syncBtn = document.getElementById('syncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', function() {
                    syncWhatsAppGroups();
                });
            }
            
            // Event delegation for all buttons
            document.addEventListener('click', function(e) {
                // Only log button clicks to reduce noise
                if (e.target.tagName === 'BUTTON') {
                    console.log('👆 Button clicked:', e.target.className);
                }

                // Toggle monitoring buttons
                if (e.target.classList.contains('toggle-monitoring-btn')) {
                    const groupId = e.target.dataset.groupId;
                    const isMonitored = e.target.dataset.action === 'true';
                    console.log('🔄 Toggle monitoring clicked', { groupId, isMonitored });
                    e.preventDefault();
                    toggleMonitoring(groupId, isMonitored);
                }
                // Sync groups buttons
                else if (e.target.classList.contains('sync-groups-btn')) {
                    console.log('🔄 Sync groups clicked');
                    syncWhatsAppGroups();
                }
                // Select all filtered buttons
                else if (e.target.classList.contains('select-all-filtered-btn')) {
                    console.log('✅ Select all filtered clicked');
                    selectAllFiltered();
                }
                // Select none filtered buttons
                else if (e.target.classList.contains('select-none-filtered-btn')) {
                    console.log('❌ Select none filtered clicked');
                    selectNoneFiltered();
                }
                // Select all buttons
                else if (e.target.classList.contains('select-all-btn')) {
                    console.log('✅ Select all clicked');
                    selectAll();
                }
                // Select none buttons
                else if (e.target.classList.contains('select-none-btn')) {
                    console.log('❌ Select none clicked');
                    selectNone();
                }
            });
            
            // Event delegation for toggle switches
            document.addEventListener('change', function(e) {
                if (e.target.classList.contains('group-toggle-switch')) {
                    const groupId = e.target.dataset.groupId;
                    const isMonitored = e.target.checked;
                    console.log('🔄 Toggle switch changed', { groupId, isMonitored });
                    toggleGroup(groupId, isMonitored);
                }
            });
            
            console.log('✅ New controls initialized');
        }
        
        async function initializeCSSystemThenLoadMonitoredGroups() {
            console.log('🚀 Checking CS system status...');
            
            try {
                // Check if CS system is already initialized
                const statusResponse = await fetch('/api/cs/status');
                const statusData = await statusResponse.json();
                
                console.log('📊 CS System status', {
                    ready: statusData.csTicketSystem?.ready,
                    orchestratorInit: statusData.csTicketSystem?.orchestrator?.initialized,
                    groupsManagerInit: statusData.csTicketSystem?.groupsManager?.initialized,
                    fullStatus: statusData
                });
                
                if (!statusData.csTicketSystem?.ready) {
                    console.log('⚙️ CS System not ready, initializing...');
                    
                    // Show loading message in monitored groups
                    const monitoredContainer = document.getElementById('monitoredGroupsList');
                    if (monitoredContainer) {
                        monitoredContainer.innerHTML = '<div class="loading-message"><span>Initializing CS Ticket System...</span><p style="font-size: 0.9em; color: #666;">Setting up group monitoring capabilities...</p></div>';
                    }
                    
                    // Initialize CS system
                    const initResponse = await fetch('/api/cs/initialize', { method: 'POST' });
                    const initData = await initResponse.json();
                    
                    console.log('🔧 CS System initialization result', {
                        success: initData.success,
                        services: initData.result?.services,
                        error: initData.error,
                        fullResult: initData
                    });
                    
                    if (!initData.success) {
                        console.warn('⚠️ CS system initialization failed, but will continue to load groups:', initData.error);
                        showWarning('CS system initialization failed, but group monitoring will still work: ' + initData.error);
                        // Don't return - continue to load groups anyway
                    } else {
                        console.log('✅ CS System initialized successfully');
                    }
                } else {
                    console.log('✅ CS System already ready');
                }
                
                // Load monitored groups only
                await loadMonitoredGroups();
                
                // Get total count for search status
                await updateTotalGroupsCount();
                
            } catch (error) {
                console.error('💥 Error during CS system initialization', {
                    errorMessage: error.message,
                    errorStack: error.stack
                });
                showError('Failed to initialize CS system: ' + error.message);
            }
        }
        
        async function loadGroups_OLD_DISABLED() {
            console.log('🔄 Starting to load groups...');
            
            try {
                console.log('📡 Making fetch request to /api/cs/groups');
                const response = await fetch('/api/cs/groups');
                
                console.log('📥 Fetch response received', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });
                
                console.log('🔍 Parsing response as JSON...');
                const data = await response.json();
                
                console.log('📊 Response data parsed', {
                    success: data.success,
                    groupsCount: data.groups?.length || 0,
                    error: data.error,
                    summary: data.summary,
                    fullData: data
                });
                
                if (data.success) {
                    console.log('✅ Groups loaded successfully', {
                        groupsCount: data.groups.length,
                        groups: data.groups
                    });
                    groups = data.groups;
                    console.log('⚠️ OLD loadGroups function called - this should not happen in NEW UI');
                    // applyFilters(); // DISABLED: This causes CSP violations
                } else {
                    console.error('❌ Server returned error', {
                        error: data.error,
                        debugInfo: data.debugInfo,
                        fullResponse: data
                    });
                    showError('Failed to load groups: ' + data.error);
                }
            } catch (error) {
                console.error('💥 Exception during group loading', {
                    errorMessage: error.message,
                    errorName: error.name,
                    errorStack: error.stack,
                    errorString: error.toString()
                });
                showError('Failed to connect to server: ' + error.message);
            }
        }
        
        // NEW FUNCTIONS FOR REDESIGNED UI
        async function loadMonitoredGroups() {
            console.log('🔄 Loading monitored groups only...');
            
            try {
                console.log('📡 Making fetch request to /api/cs/groups?monitored=true');
                const response = await fetch('/api/cs/groups?monitored=true');
                
                console.log('📥 Fetch response received', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
                
                const data = await response.json();
                
                console.log('📊 Monitored groups response', {
                    success: data.success,
                    groupsCount: data.groups?.length || 0,
                    summary: data.summary
                });
                
                if (data.success) {
                    monitoredGroups = data.groups;
                    renderMonitoredGroups(monitoredGroups);
                    updateMonitoredCount(monitoredGroups.length);
                    console.log('✅ Monitored groups loaded:', monitoredGroups.length);
                } else {
                    console.error('❌ Failed to load monitored groups:', data.error);
                    showMonitoredError('Failed to load monitored groups: ' + data.error);
                }
            } catch (error) {
                console.error('💥 Error loading monitored groups:', error);
                showMonitoredError('Failed to load monitored groups: ' + error.message);
            }
        }
        
        async function updateTotalGroupsCount() {
            try {
                const response = await fetch('/api/cs/groups');
                const data = await response.json();
                
                if (data.success) {
                    totalGroupsCount = data.groups.length;
                    const totalElement = document.getElementById('totalGroups');
                    if (totalElement) {
                        totalElement.textContent = totalGroupsCount;
                    }
                    console.log('📊 Total groups count updated:', totalGroupsCount);
                }
            } catch (error) {
                console.error('Error getting total groups count:', error);
            }
        }
        
        async function searchGroups(searchTerm) {
            console.log('🔍 Searching groups for:', searchTerm);
            
            // Check cache first
            if (searchCache.has(searchTerm)) {
                console.log('📋 Using cached search results for:', searchTerm);
                renderSearchResults(searchCache.get(searchTerm));
                return;
            }
            
            try {
                showSearchLoading();
                const response = await fetch('/api/cs/groups/search?q=' + encodeURIComponent(searchTerm));
                const data = await response.json();
                
                if (data.success) {
                    searchResults = data.groups;
                    searchCache.set(searchTerm, searchResults); // Cache results
                    renderSearchResults(searchResults);
                    updateSearchStatus(searchTerm, data.summary);
                    console.log('✅ Search completed:', searchResults.length, 'results');
                } else {
                    console.error('❌ Search failed:', data.error);
                    showSearchError('Search failed: ' + data.error);
                }
            } catch (error) {
                console.error('💥 Error during search:', error);
                showSearchError('Search error: ' + error.message);
            }
        }
        
        function renderMonitoredGroups(groups) {
            console.log('🎨 renderMonitoredGroups called', {
                groupsCount: groups?.length || 0,
                timestamp: new Date().toISOString()
            });
            
            const container = document.getElementById('monitoredGroupsList');
            if (!container) {
                console.warn('⚠️ monitoredGroupsList container not found');
                return;
            }
            
            if (groups.length === 0) {
                container.innerHTML = '<div class="no-groups-message"><p>🚫 No groups are currently being monitored.</p><p style="font-size: 0.9em; color: #666;">Use the search section below to find and add groups to monitor.</p></div>';
                return;
            }
            
            const html = groups.map(group => {
                const lastActivity = group.lastActivity 
                    ? new Date(group.lastActivity).toLocaleString()
                    : 'Never';
                    
                return '<div class="group-item">' +
                    '<div class="group-info">' +
                        '<div class="group-name">✅ ' + escapeHtml(group.groupName) + '</div>' +
                        '<div class="group-details">Last activity: ' + lastActivity + '</div>' +
                    '</div>' +
                    '<button class="btn-secondary toggle-monitoring-btn" data-group-id="' + escapeHtml(group.groupId) + '" data-action="false">Stop Monitoring</button>' +
                '</div>';
            }).join('');
            
            container.innerHTML = html;
        }
        
        function renderSearchResults(groups) {
            console.log('🎨 Search results rendered', { count: groups?.length || 0 });
            
            const container = document.getElementById('searchResults');
            if (!container) {
                console.warn('⚠️ searchResults container not found');
                return;
            }
            
            if (groups.length === 0) {
                container.innerHTML = '<div class="no-groups-message"><p>🔍 No groups found for your search.</p><p style="font-size: 0.9em; color: #666;">Try different keywords or check the spelling.</p></div>';
                return;
            }
            
            const html = groups.map(group => {
                const lastActivity = group.lastActivity 
                    ? new Date(group.lastActivity).toLocaleString()
                    : 'Never seen';
                    
                const statusIcon = group.isMonitored ? '✅' : '⬜';
                const statusText = group.isMonitored ? 'Already monitored' : lastActivity;
                const buttonText = group.isMonitored ? 'Stop Monitoring' : 'Start Monitoring';
                const buttonAction = group.isMonitored ? 'false' : 'true';
                
                return '<div class="group-item">' +
                    '<div class="group-info">' +
                        '<div class="group-name">' + statusIcon + ' ' + escapeHtml(group.groupName) + '</div>' +
                        '<div class="group-details">' + statusText + '</div>' +
                    '</div>' +
                    '<button class="btn-primary toggle-monitoring-btn" data-group-id="' + escapeHtml(group.groupId) + '" data-action="' + buttonAction + '">' + buttonText + '</button>' +
                '</div>';
            }).join('');
            
            container.innerHTML = html;
            console.log('✅ Search results updated successfully');
        }
        
        // REMOVED: applyFilters function - causes CSP violations with renderFilteredGroups
        
        function updateFilterStatus() {
            const statusElement = document.getElementById('filterStatus');
            if (!statusElement) return;
            
            let statusText = '';
            if (filteredGroups.length === groups.length) {
                statusText = 'Showing all ' + groups.length + ' groups';
            } else {
                statusText = 'Showing ' + filteredGroups.length + ' of ' + groups.length + ' groups';
                
                const filters = [];
                if (filterState.search) filters.push('search: "' + filterState.search + '"');
                if (filterState.hasActivity) filters.push('with activity only');
                
                if (filters.length > 0) {
                    statusText += ' (filtered by: ' + filters.join(', ') + ')';
                }
            }
            
            const sortLabels = {
                'recent_desc': 'most recent first',
                'recent_asc': 'oldest first', 
                'name_asc': 'A-Z',
                'name_desc': 'Z-A'
            };
            
            statusText += ' • Sorted: ' + (sortLabels[filterState.sort] || filterState.sort);
            
            statusElement.textContent = statusText;
        }
        
        function renderFilteredGroups_OLD_DISABLED() {
            console.log('🎨 Starting renderFilteredGroups function', {
                filteredCount: filteredGroups.length,
                totalCount: groups.length
            });
            
            const container = document.getElementById('group-management-container');
            if (!container) {
                console.error('❌ Container element group-management-container not found!');
                return;
            }
            
            if (filteredGroups.length === 0) {
                let emptyMessage = '📭 No groups found.';
                if (filterState.search || filterState.hasActivity) {
                    emptyMessage = '🔍 No groups match your filters.';
                    if (filterState.search) emptyMessage += ' Try a different search term.';
                    if (filterState.hasActivity) emptyMessage += ' Try unchecking "Only with activity".';
                }
                
                container.innerHTML = 
                    '<div class="no-groups-message">' +
                        '<p>' + emptyMessage + '</p>' +
                    '</div>';
                return;
            }
            
            const monitoredCount = filteredGroups.filter(g => g.isMonitored).length;
            const totalCount = filteredGroups.length;
            
            try {
                console.log('🔨 Generating filtered group items HTML...');
                const groupItems = filteredGroups.map(group => {
                    return renderGroupItem_OLD_DISABLED(group);
                });
                
                const html = 
                    '<div class="bulk-actions">' +
                        '<button class="bulk-btn sync-groups-btn">🔄 Sync WhatsApp Groups</button>' +
                        '<button class="bulk-btn select-all-filtered-btn">✅ Select All Visible</button>' +
                        '<button class="bulk-btn secondary select-none-filtered-btn">❌ Select None Visible</button>' +
                        '<span style="margin-left: 15px; color: #666; font-size: 0.9em;">' +
                            monitoredCount + ' of ' + totalCount + ' visible groups monitored' +
                        '</span>' +
                    '</div>' +
                    '<div class="groups-list">' +
                        groupItems.join('') +
                    '</div>';
                
                container.innerHTML = html;
                console.log('✅ Filtered groups rendered successfully');
                
            } catch (error) {
                console.error('💥 Error during filtered group rendering:', error);
                container.innerHTML = '<div class="error-message">❌ Error rendering filtered groups: ' + error.message + '</div>';
            }
        }
        
        function renderGroups_OLD_DISABLED() {
            console.log('🎨 Starting renderGroups function', {
                groupsArray: groups,
                groupsLength: groups.length,
                groupsType: typeof groups
            });
            
            const container = document.getElementById('group-management-container');
            console.log('📦 Container element found:', !!container, container);
            
            if (!container) {
                console.error('❌ Container element group-management-container not found!');
                return;
            }
            
            if (groups.length === 0) {
                console.log('📭 No groups to render, showing empty message');
                container.innerHTML = 
                    '<div class="no-groups-message">' +
                        '<p>📭 No WhatsApp groups detected yet.</p>' +
                        '<p style="font-size: 0.9em;">Once you connect WhatsApp and receive messages in groups, they will appear here for selection.</p>' +
                    '</div>';
                return;
            }
            
            const monitoredCount = groups.filter(g => g.isMonitored).length;
            const totalCount = groups.length;
            
            console.log('📊 Rendering groups', {
                totalCount,
                monitoredCount,
                groups: groups.map(g => ({ id: g.id, name: g.groupName, monitored: g.isMonitored }))
            });
            
            try {
                console.log('🔨 Generating group items HTML...');
                const groupItems = groups.map(group => {
                    console.log('🎯 Rendering individual group:', { id: group.id, name: group.groupName });
                    return renderGroupItem_OLD_DISABLED(group);
                });
                console.log('✅ Group items generated:', groupItems.length, 'items');
                
                const html = 
                    '<div class="bulk-actions">' +
                        '<button class="bulk-btn sync-groups-btn">🔄 Sync WhatsApp Groups</button>' +
                        '<button class="bulk-btn select-all-btn">✅ Select All</button>' +
                        '<button class="bulk-btn secondary select-none-btn">❌ Select None</button>' +
                        '<span style="margin-left: 15px; color: #666; font-size: 0.9em;">' +
                            monitoredCount + ' of ' + totalCount + ' groups monitored' +
                        '</span>' +
                    '</div>' +
                    '<div class="groups-list">' +
                        groupItems.join('') +
                    '</div>';
                
                console.log('📝 Setting container HTML, length:', html.length);
                container.innerHTML = html;
                console.log('✅ Container HTML set successfully');
                
            } catch (error) {
                console.error('💥 Error during group rendering:', {
                    error: error.message,
                    stack: error.stack,
                    groups: groups
                });
                container.innerHTML = '<div class="error-message">❌ Error rendering groups: ' + error.message + '</div>';
            }
        }
        
        function renderGroupItem_OLD_DISABLED(group) {
            console.log('🎨 renderGroupItem called for group:', {
                id: group.id,
                groupName: group.groupName,
                groupId: group.groupId,
                isMonitored: group.isMonitored,
                lastActivity: group.lastActivity,
                fullGroup: group
            });
            
            try {
                const lastActivity = group.lastActivity ? 
                    new Date(group.lastActivity).toLocaleDateString() : 'No recent activity';
                
                const html = 
                    '<div class="group-item">' +
                        '<div class="group-info">' +
                            '<div class="group-name">' + group.groupName + '</div>' +
                            '<div class="group-details">' +
                                'ID: ' + group.groupId.substring(0, 20) + '...' +
                                '<br>Last Activity: ' + lastActivity +
                            '</div>' +
                        '</div>' +
                        '<label class="toggle-switch">' +
                            '<input type="checkbox" class="group-toggle-switch" data-group-id="' + escapeHtml(group.groupId) + '" ' + (group.isMonitored ? 'checked' : '') + '>' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>';
                
                console.log('✅ renderGroupItem generated HTML for', group.groupName, 'length:', html.length);
                return html;
                
            } catch (error) {
                console.error('💥 Error in renderGroupItem for group:', group, 'error:', error);
                return '<div class="error-item">❌ Error rendering group ' + (group.groupName || 'Unknown') + ': ' + error.message + '</div>';
            }
        }
        
        // Helper functions for new UI
        function updateMonitoredCount(count) {
            const countElement = document.getElementById('monitoredCount');
            if (countElement) {
                countElement.textContent = count;
            }
        }
        
        function showSearchLoading() {
            const container = document.getElementById('searchResults');
            if (container) {
                container.innerHTML = '<div class="loading-message"><span>🔍 Searching groups...</span></div>';
            }
        }
        
        function showSearchError(message) {
            const container = document.getElementById('searchResults');
            if (container) {
                container.innerHTML = '<div class="no-groups-message"><p>❌ ' + escapeHtml(message) + '</p></div>';
            }
        }
        
        function showMonitoredError(message) {
            const container = document.getElementById('monitoredGroupsList');
            if (container) {
                container.innerHTML = '<div class="no-groups-message"><p>❌ ' + escapeHtml(message) + '</p></div>';
            }
        }
        
        function updateSearchStatus(searchTerm, summary) {
            const statusElement = document.getElementById('searchStatus');
            if (statusElement && summary) {
                statusElement.innerHTML = 'Found ' + summary.matchingResults + ' groups matching "' + escapeHtml(searchTerm) + '" from ' + summary.totalAvailable + ' total groups';
            }
        }
        
        function clearSearchResults() {
            const container = document.getElementById('searchResults');
            if (container) {
                container.innerHTML = '';
            }
            const statusElement = document.getElementById('searchStatus');
            if (statusElement) {
                statusElement.innerHTML = 'Type to search from <span id="totalGroups">' + totalGroupsCount + '</span> available groups...';
            }
        }
        
        function filterMonitoredGroups(filterText) {
            if (!filterText) {
                renderMonitoredGroups(monitoredGroups);
                return;
            }
            
            const filtered = monitoredGroups.filter(group => 
                group.groupName.toLowerCase().includes(filterText.toLowerCase())
            );
            renderMonitoredGroups(filtered);
        }
        
        function sortMonitoredGroups(sortType) {
            let sorted = [...monitoredGroups];
            
            if (sortType === 'recent') {
                sorted.sort((a, b) => {
                    const aDate = a.lastActivity ? new Date(a.lastActivity) : new Date(0);
                    const bDate = b.lastActivity ? new Date(b.lastActivity) : new Date(0);
                    return bDate - aDate;
                });
            } else if (sortType === 'alphabetical') {
                sorted.sort((a, b) => a.groupName.localeCompare(b.groupName));
            }
            
            renderMonitoredGroups(sorted);
        }
        
        // REMOVED: Duplicate toggleMonitoring function - using the logged version below
        
        async function syncWhatsAppGroups() {
            try {
                showSuccess('Syncing groups from WhatsApp...');
                
                const response = await fetch('/api/cs/groups/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                if (data.success) {
                    await updateTotalGroupsCount();
                    searchCache.clear(); // Clear search cache
                    showSuccess('Groups synced: ' + data.summary.discovered + ' new, ' + data.summary.updated + ' updated');
                } else {
                    showError('Sync failed: ' + data.error);
                }
            } catch (error) {
                console.error('Error syncing groups:', error);
                showError('Sync error: ' + error.message);
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Wrapper function for event delegation  
        async function toggleMonitoring(groupId, isMonitored) {
            console.log('🎯 toggleMonitoring wrapper called', {
                groupId, 
                isMonitored, 
                source: 'NEW UI event delegation',
                timestamp: new Date().toISOString()
            });
            
            try {
                await toggleGroup(groupId, isMonitored);
                console.log('✅ toggleMonitoring completed successfully');
            } catch (error) {
                console.error('💥 toggleMonitoring failed:', error);
                showError('Failed to toggle monitoring: ' + error.message);
            }
        }
        
        async function toggleGroup(groupId, isMonitored) {
            console.log('🔄 toggleGroup called', { groupId, isMonitored, timestamp: new Date().toISOString() });
            
            try {
                const response = await fetch('/api/cs/groups/' + encodeURIComponent(groupId) + '/toggle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ isMonitored })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    console.log('✅ Toggle successful, updating NEW UI sections');
                    
                    // Show success feedback
                    showSuccess('Group monitoring ' + (isMonitored ? 'enabled' : 'disabled') + ' for ' + data.group.groupName);
                    
                    // Update NEW UI sections instead of calling old filtering
                    await refreshUIAfterToggle(groupId, isMonitored, data.group.groupName);
                    
                } else {
                    console.error('❌ Toggle failed:', data.error);
                    showError('Failed to update group: ' + data.error);
                    // Refresh UI to revert changes
                    await refreshUIAfterToggle(groupId, !isMonitored);
                }
            } catch (error) {
                console.error('💥 Error toggling group:', error);
                showError('Failed to update group monitoring');
                // Refresh UI to revert changes
                await refreshUIAfterToggle(groupId, !isMonitored);
            }
        }
        
        async function refreshUIAfterToggle(groupId, isMonitored, groupName) {
            console.log('🔄 refreshUIAfterToggle called', { groupId, isMonitored, groupName });
            
            try {
                // Reload monitored groups (this uses the NEW UI)
                await loadMonitoredGroups();
                
                // Update search results if they exist
                if (searchResults && searchResults.length > 0) {
                    // Find and update the group in search results
                    const searchGroup = searchResults.find(g => g.groupId === groupId);
                    if (searchGroup) {
                        searchGroup.isMonitored = isMonitored;
                        renderSearchResults(searchResults);
                    }
                }
                
                // Update total groups count
                await updateTotalGroupsCount();
                
                console.log('✅ UI refresh completed after toggle');
            } catch (error) {
                console.error('💥 Error refreshing UI after toggle:', error);
            }
        }
        
        async function selectAll() {
            const updates = groups.filter(g => !g.isMonitored).map(g => ({
                groupId: g.groupId,
                isMonitored: true
            }));
            
            if (updates.length === 0) {
                showSuccess('All groups are already monitored');
                return;
            }
            
            await bulkUpdate(updates, 'Enabling monitoring for all groups...');
        }
        
        async function selectNone() {
            const updates = groups.filter(g => g.isMonitored).map(g => ({
                groupId: g.groupId,
                isMonitored: false
            }));
            
            if (updates.length === 0) {
                showSuccess('No groups are currently monitored');
                return;
            }
            
            await bulkUpdate(updates, 'Disabling monitoring for all groups...');
        }
        
        async function selectAllFiltered() {
            const updates = filteredGroups.filter(g => !g.isMonitored).map(g => ({
                groupId: g.groupId,
                isMonitored: true
            }));
            
            if (updates.length === 0) {
                showSuccess('All visible groups are already monitored');
                return;
            }
            
            await bulkUpdate(updates, 'Enabling monitoring for all visible groups...');
        }
        
        async function selectNoneFiltered() {
            const updates = filteredGroups.filter(g => g.isMonitored).map(g => ({
                groupId: g.groupId,
                isMonitored: false
            }));
            
            if (updates.length === 0) {
                showSuccess('No visible groups are currently monitored');
                return;
            }
            
            await bulkUpdate(updates, 'Disabling monitoring for all visible groups...');
        }
        
        async function bulkUpdate(updates, loadingMessage) {
            showLoading(loadingMessage);
            
            try {
                const response = await fetch('/api/cs/groups/bulk-update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ updates })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showSuccess('Updated ' + data.summary.successful + ' groups successfully');
                    // Update NEW UI sections instead of old filtering
                    console.log('📊 Bulk update successful, refreshing NEW UI');
                    await loadMonitoredGroups();
                    await updateTotalGroupsCount();
                    // Clear search cache since groups have changed
                    searchCache.clear();
                } else {
                    showError('Bulk update failed: ' + data.error);
                }
            } catch (error) {
                console.error('Error in bulk update:', error);
                showError('Failed to perform bulk update');
            }
        }
        
        function showSuccess(message) {
            showMessage(message, '#28a745');
        }
        
        function showError(message) {
            showMessage(message, '#dc3545');
        }
        
        function showWarning(message) {
            showMessage(message, '#ff9800');
        }
        
        function showLoading(message) {
            showMessage(message, '#007bff');
        }
        
        function showMessage(message, color) {
            // Create or update status message
            let statusDiv = document.getElementById('status-message');
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.id = 'status-message';
                statusDiv.style.cssText = \`
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 6px;
                    color: white;
                    font-weight: bold;
                    z-index: 1000;
                    max-width: 300px;
                    word-wrap: break-word;
                \`;
                document.body.appendChild(statusDiv);
            }
            
            statusDiv.style.backgroundColor = color;
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }
            }, 3000);
        }

        async function syncWhatsAppGroups() {
            console.log('🔄 Starting WhatsApp groups sync...');
            showLoading('Syncing WhatsApp groups from Evolution API...');
            
            try {
                const response = await fetch('/api/cs/groups/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('📡 Sync response received', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
                
                const data = await response.json();
                
                console.log('📊 Sync result', {
                    success: data.success,
                    syncedCount: data.syncedCount,
                    totalFromEvolution: data.totalFromEvolution,
                    error: data.error,
                    fullData: data
                });
                
                if (data.success) {
                    showSuccess('Successfully synced ' + data.syncedCount + ' groups from WhatsApp!');
                    // Update NEW UI sections to show the newly synced data
                    console.log('📊 Sync successful, refreshing NEW UI');
                    await loadMonitoredGroups();
                    await updateTotalGroupsCount();
                    // Clear search cache since new groups were added
                    searchCache.clear();
                } else {
                    console.error('❌ Sync failed', data.error);
                    showError('Failed to sync groups: ' + data.error);
                }
            } catch (error) {
                console.error('💥 Error during sync:', {
                    errorMessage: error.message,
                    errorStack: error.stack
                });
                showError('Failed to sync WhatsApp groups: ' + error.message);
            }
        }

        // History Processing Functionality
        let historyProcessingInProgress = false;

        async function initializeHistoryProcessing() {
            console.log('🚀 Initializing history processing functionality...');
            
            // Add event listeners for history processing buttons
            const processHistoryBtn = document.getElementById('processHistoryBtn');
            const forceSyncBtn = document.getElementById('forceSyncBtn');
            
            if (processHistoryBtn) {
                processHistoryBtn.addEventListener('click', () => handleHistoryProcessing(false));
                console.log('✅ Process history button event listener added');
            }
            
            if (forceSyncBtn) {
                forceSyncBtn.addEventListener('click', () => handleHistoryProcessing(true));
                console.log('✅ Force sync button event listener added');
            }
        }

        async function handleHistoryProcessing(forceSync = false) {
            if (historyProcessingInProgress) {
                showError('History processing already in progress. Please wait...');
                return;
            }

            const statusSpan = document.getElementById('historyStatus');
            const resultsDiv = document.getElementById('historyResults');

            historyProcessingInProgress = true;
            
            // Update status based on sync method
            if (forceSync) {
                statusSpan.textContent = '🔄 Force syncing messages from WhatsApp...';
            } else {
                statusSpan.textContent = '🔄 Fetching group history...';
            }
            statusSpan.style.color = '#ff9800';

            try {
                console.log('🔄 Starting history processing...', { forceSync });
                
                // Show intermediate progress
                if (forceSync) {
                    statusSpan.textContent = '🔄 Syncing live messages from WhatsApp (may take longer)...';
                }
                
                // Call the API endpoint with force sync option
                const response = await fetch('/api/cs/groups/process-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        forceSync: forceSync
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'History processing failed');
                }

                // Show results
                displayHistoryResults(result);
                
                // Enhanced status message with sync method and caching info
                let statusMessage = \`✅ Processed \${result.totalMessages || 0} messages from \${result.groupsProcessed || 0} groups\`;
                
                if (result.messagesCached && result.messagesCached > 0) {
                    statusMessage += \`, cached \${result.messagesCached} new messages\`;
                }
                
                if (result.ticketsCreated) {
                    statusMessage += \`, found \${result.ticketsCreated} tickets\`;
                }
                
                if (result.syncMethod === 'force_sync') {
                    statusMessage += ' (synced from WhatsApp)';
                }
                
                statusSpan.textContent = statusMessage;
                statusSpan.style.color = '#4caf50';

                console.log('✅ History processing completed:', result);

            } catch (error) {
                console.error('💥 History processing error:', error);
                statusSpan.textContent = \`❌ Error: \${error.message}\`;
                statusSpan.style.color = '#f44336';
                showError(\`History processing failed: \${error.message}\`);
            } finally {
                historyProcessingInProgress = false;
            }
        }

        function displayHistoryResults(result) {
            const resultsDiv = document.getElementById('historyResults');
            if (!resultsDiv) return;

            // Show sync method information
            const syncMethodIcon = result.syncMethod === 'force_sync' ? '🔄' : '💾';
            const syncMethodText = result.syncMethod === 'force_sync' ? 'WhatsApp Force Sync' : 'Database + Fallback';
            
            let html = \`
                <h5>📊 History Processing Results</h5>
                
                <div style="background: #e8f4f8; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                    <strong>\${syncMethodIcon} Sync Method: \${syncMethodText}</strong>
                    \${result.messagesCached ? \`<br><small>💾 \${result.messagesCached} new messages cached locally</small>\` : ''}
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">\${result.groupsProcessed || 0}</div>
                        <div style="color: #666; font-size: 0.9em;">Groups Processed</div>
                    </div>
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #1976d2;">\${result.totalMessages || 0}</div>
                        <div style="color: #666; font-size: 0.9em;">Messages Fetched</div>
                    </div>
                    \${result.messagesCached ? \`
                        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #1565c0;">\${result.messagesCached}</div>
                            <div style="color: #666; font-size: 0.9em;">Messages Cached</div>
                        </div>
                    \` : ''}
                    <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">\${result.ticketsCreated || 0}</div>
                        <div style="color: #666; font-size: 0.9em;">Tickets Created</div>
                    </div>
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #f57c00;">\${result.duplicatesSkipped || 0}</div>
                        <div style="color: #666; font-size: 0.9em;">Duplicates Skipped</div>
                    </div>
                </div>
            \`;

            if (result.groupResults && result.groupResults.length > 0) {
                html += \`
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h6 style="color: #495057; margin: 0 0 10px 0;">📊 Per-Group Results</h6>
                        <div style="max-height: 200px; overflow-y: auto;">
                            \${result.groupResults.map(group => \`
                                <div style="background: white; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #007bff;">
                                    <div style="font-weight: bold; color: #007bff;">\${group.groupName}</div>
                                    <div style="color: #666; font-size: 0.9em;">\${group.messagesProcessed} messages, \${group.ticketsFound} tickets</div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }

            if (result.errors && result.errors.length > 0) {
                html += \`
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h6 style="color: #c62828; margin: 0 0 10px 0;">⚠️ Processing Errors (\${result.errors.length})</h6>
                        <ul style="margin: 0; padding-left: 20px; color: #666;">
                            \${result.errors.slice(0, 5).map(error => \`<li>\${error}</li>\`).join('')}
                            \${result.errors.length > 5 ? \`<li><em>... and \${result.errors.length - 5} more</em></li>\` : ''}
                        </ul>
                    </div>
                \`;
            }

            resultsDiv.innerHTML = html;
            resultsDiv.style.display = 'block';
        }

        // Initialize history processing when page loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('📄 DOM loaded, initializing history processing...');
            setTimeout(initializeHistoryProcessing, 1000); // Small delay to ensure other init is complete
        });
    </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    logger.error('Failed to render CS Ticket Monitor QR page', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%); min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 20px; max-width: 500px; margin: 0 auto;">
            <h1 style="color: #f5576c;">Failed to Load CS Monitor Status</h1>
            <p style="color: #666;">${error.message}</p>
            <a href="/qr-cs" style="display: inline-block; background: #4caf50; color: white; text-decoration: none; padding: 12px 30px; border-radius: 30px; margin-top: 20px;">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;