/**
 * Google Sheets Integration Service for CS Ticket System
 * Module C: Handles ticket logging, retrieval, and status updates
 * 
 * Features:
 * - Service account authentication with Google Sheets API v4
 * - Auto-generated ticket IDs (T + timestamp)
 * - Rate limiting with exponential backoff (100 req/100s)
 * - Batch operations for performance
 * - Automatic header creation
 * - Comprehensive error handling
 */

const { google } = require('googleapis');
const winston = require('winston');

// Configure logger for sheets service
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class SheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = null;
    this.requestCount = 0;
    this.requestResetTime = Date.now();
    this.maxRequestsPer100Seconds = 100;
    
    // Sheet structure definition
    this.headers = [
      'Ticket ID',      // A
      'Timestamp',      // B  
      'Group',          // C
      'Customer',       // D
      'Issue',          // E
      'Priority',       // F
      'Status',         // G
      'Last Updated',   // H
      'Notes'           // I
    ];
  }

  /**
   * Initialize Google Sheets client with service account
   * @param {string|object} serviceAccountKey - JSON string or object with service account credentials
   * @param {string} spreadsheetId - Google Sheets spreadsheet ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async initialize(serviceAccountKey, spreadsheetId) {
    try {
      logger.info('Initializing Google Sheets service...');
      
      this.spreadsheetId = spreadsheetId;
      
      // Try to use the key file directly if available
      const keyFilePath = '/Users/tomas/Desktop/ai_pbx/ai-cs/Google Sheets API Key cs-ticket-system-b995eb1f7e9e.json';
      let credentials;
      
      try {
        const fs = require('fs');
        if (fs.existsSync(keyFilePath)) {
          logger.info('Using service account key file...');
          credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        } else {
          // Fallback to environment variable
          if (typeof serviceAccountKey === 'string') {
            credentials = JSON.parse(serviceAccountKey);
          } else {
            credentials = serviceAccountKey;
          }
          
          // Fix private key formatting (replace escaped newlines)
          if (credentials.private_key && credentials.private_key.includes('\\n')) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
        }
      } catch (keyError) {
        logger.warn('Could not read key file, using environment variable');
        // Fallback to environment variable
        if (typeof serviceAccountKey === 'string') {
          credentials = JSON.parse(serviceAccountKey);
        } else {
          credentials = serviceAccountKey;
        }
        
        // Fix private key formatting (replace escaped newlines)
        if (credentials.private_key && credentials.private_key.includes('\\n')) {
          credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
      }

      // Create JWT auth client using the working method
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Initialize Sheets API client
      this.sheets = google.sheets({ version: 'v4', auth });

      // Test connection and ensure headers exist
      await this._ensureHeaders();
      
      logger.info('Google Sheets service initialized successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('Failed to initialize Google Sheets service:', error);
      return { 
        success: false, 
        error: `Sheets initialization failed: ${error.message}` 
      };
    }
  }

  /**
   * Write new ticket to sheet
   * @param {object} ticketData - Ticket information
   * @param {string} ticketData.customer - Customer name
   * @param {string} ticketData.issue - Issue description
   * @param {string} ticketData.priority - Priority level (low/medium/high)
   * @param {string} ticketData.groupName - WhatsApp group name
   * @param {string} ticketData.groupId - WhatsApp group ID
   * @param {string} [ticketData.timestamp] - Custom timestamp (optional)
   * @returns {Promise<{success: boolean, ticketId?: string, error?: string}>}
   */
  async writeTicket(ticketData) {
    try {
      await this._checkRateLimit();
      
      // Generate ticket ID and timestamp
      const timestamp = ticketData.timestamp || new Date().toISOString();
      const ticketId = `T${Date.now()}`;
      
      logger.info(`Writing new ticket: ${ticketId}`);
      
      // Prepare row data
      const rowData = [
        ticketId,                           // A: Ticket ID
        timestamp,                          // B: Timestamp
        ticketData.groupName || 'Unknown',  // C: Group
        ticketData.customer || 'Unknown',   // D: Customer
        ticketData.issue || '',             // E: Issue
        ticketData.priority || 'medium',    // F: Priority
        'Open',                             // G: Status
        timestamp,                          // H: Last Updated
        `Created from group: ${ticketData.groupId || 'Unknown'}` // I: Notes
      ];

      // Append to sheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:I',
        valueInputOption: 'RAW',
        resource: {
          values: [rowData]
        }
      });

      this._incrementRequestCount();
      
      logger.info(`Ticket ${ticketId} written successfully to row ${response.data.updates.updatedRows}`);
      
      return { 
        success: true, 
        ticketId,
        timestamp: timestamp 
      };
      
    } catch (error) {
      logger.error('Failed to write ticket:', error);
      return { 
        success: false, 
        error: `Failed to write ticket: ${error.message}` 
      };
    }
  }

  /**
   * Get all open tickets from sheet
   * @returns {Promise<Array>} Array of ticket objects
   */
  async getOpenTickets() {
    try {
      await this._checkRateLimit();
      
      logger.info('Retrieving open tickets...');
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:I'
      });

      this._incrementRequestCount();
      
      const rows = response.data.values || [];
      
      // Skip header row and filter for open tickets
      const tickets = rows.slice(1)
        .filter(row => row[6] === 'Open') // Status column (G)
        .map(row => this._parseTicketRow(row));
      
      logger.info(`Retrieved ${tickets.length} open tickets`);
      return tickets;
      
    } catch (error) {
      logger.error('Failed to get open tickets:', error);
      return [];
    }
  }

  /**
   * Update ticket status and notes
   * @param {string} ticketId - Ticket ID to update
   * @param {string} newStatus - New status (in_progress/resolved/escalated)
   * @param {string} [notes] - Additional notes
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updateTicketStatus(ticketId, newStatus, notes = '') {
    try {
      await this._checkRateLimit();
      
      logger.info(`Updating ticket ${ticketId} status to: ${newStatus}`);
      
      // Find the ticket row
      const ticketRow = await this._findTicketRow(ticketId);
      if (!ticketRow) {
        return { 
          success: false, 
          error: `Ticket ${ticketId} not found` 
        };
      }

      const timestamp = new Date().toISOString();
      
      // Update status, last updated, and notes
      const updates = [
        {
          range: `G${ticketRow}`, // Status column
          values: [[newStatus]]
        },
        {
          range: `H${ticketRow}`, // Last Updated column
          values: [[timestamp]]
        }
      ];

      // Add notes update if provided
      if (notes) {
        updates.push({
          range: `I${ticketRow}`, // Notes column
          values: [[notes]]
        });
      }

      // Batch update
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      this._incrementRequestCount();
      
      logger.info(`Ticket ${ticketId} updated successfully`);
      
      return { success: true };
      
    } catch (error) {
      logger.error(`Failed to update ticket ${ticketId}:`, error);
      return { 
        success: false, 
        error: `Failed to update ticket: ${error.message}` 
      };
    }
  }

  /**
   * Get tickets older than specified hours
   * @param {number} hoursOld - Age threshold in hours
   * @returns {Promise<Array>} Array of stale ticket objects
   */
  async getStaleTickets(hoursOld = 2) {
    try {
      await this._checkRateLimit();
      
      logger.info(`Retrieving tickets older than ${hoursOld} hours...`);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:I'
      });

      this._incrementRequestCount();
      
      const rows = response.data.values || [];
      const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
      
      // Filter for stale open tickets
      const staleTickets = rows.slice(1)
        .filter(row => {
          const status = row[6]; // Status column (G)
          const lastUpdated = row[7]; // Last Updated column (H)
          
          if (status !== 'Open') return false;
          
          const lastUpdateTime = new Date(lastUpdated);
          return lastUpdateTime < cutoffTime;
        })
        .map(row => this._parseTicketRow(row));
      
      logger.info(`Found ${staleTickets.length} stale tickets`);
      return staleTickets;
      
    } catch (error) {
      logger.error('Failed to get stale tickets:', error);
      return [];
    }
  }

  /**
   * Get ticket by ID
   * @param {string} ticketId - Ticket ID to find
   * @returns {Promise<object|null>} Ticket object or null if not found
   */
  async getTicketById(ticketId) {
    try {
      const ticketRow = await this._findTicketRow(ticketId);
      if (!ticketRow) return null;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `A${ticketRow}:I${ticketRow}`
      });

      this._incrementRequestCount();
      
      const row = response.data.values?.[0];
      return row ? this._parseTicketRow(row) : null;
      
    } catch (error) {
      logger.error(`Failed to get ticket ${ticketId}:`, error);
      return null;
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Ensure sheet has proper headers
   * @private
   */
  async _ensureHeaders() {
    try {
      // Check if sheet has any content
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:I1'
      });

      const existingHeaders = response.data.values?.[0];
      
      // If no headers or headers don't match, create them
      if (!existingHeaders || !this._headersMatch(existingHeaders)) {
        logger.info('Creating/updating sheet headers...');
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:I1',
          valueInputOption: 'RAW',
          resource: {
            values: [this.headers]
          }
        });
        
        logger.info('Sheet headers created successfully');
      } else {
        logger.info('Sheet headers already exist and match expected format');
      }
      
    } catch (error) {
      logger.error('Failed to ensure headers:', error);
      throw error;
    }
  }

  /**
   * Check if existing headers match expected format
   * @private
   */
  _headersMatch(existingHeaders) {
    if (existingHeaders.length !== this.headers.length) return false;
    
    return this.headers.every((header, index) => 
      existingHeaders[index] === header
    );
  }

  /**
   * Find row number for a specific ticket ID
   * @private
   */
  async _findTicketRow(ticketId) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A'
      });

      this._incrementRequestCount();
      
      const rows = response.data.values || [];
      
      // Find the row with matching ticket ID (starting from row 2, skipping header)
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === ticketId) {
          return i + 1; // Return 1-based row number
        }
      }
      
      return null;
      
    } catch (error) {
      logger.error(`Failed to find ticket row for ${ticketId}:`, error);
      return null;
    }
  }

  /**
   * Parse sheet row into ticket object
   * @private
   */
  _parseTicketRow(row) {
    return {
      ticketId: row[0] || '',
      timestamp: row[1] || '',
      group: row[2] || '',
      customer: row[3] || '',
      issue: row[4] || '',
      priority: row[5] || 'medium',
      status: row[6] || 'Open',
      lastUpdated: row[7] || '',
      notes: row[8] || ''
    };
  }

  /**
   * Rate limiting check with exponential backoff
   * @private
   */
  async _checkRateLimit() {
    const now = Date.now();
    
    // Reset counter every 100 seconds
    if (now - this.requestResetTime > 100000) {
      this.requestCount = 0;
      this.requestResetTime = now;
    }
    
    // Check if we've hit the rate limit
    if (this.requestCount >= this.maxRequestsPer100Seconds) {
      const waitTime = 100000 - (now - this.requestResetTime);
      logger.warn(`Rate limit reached. Waiting ${waitTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.requestCount = 0;
      this.requestResetTime = Date.now();
    }
  }

  /**
   * Increment request counter for rate limiting
   * @private
   */
  _incrementRequestCount() {
    this.requestCount++;
  }

  /**
   * Get service health status
   * @returns {object} Health status object
   */
  getHealthStatus() {
    return {
      initialized: !!this.sheets,
      spreadsheetId: this.spreadsheetId,
      requestCount: this.requestCount,
      lastReset: new Date(this.requestResetTime).toISOString(),
      rateLimitRemaining: this.maxRequestsPer100Seconds - this.requestCount
    };
  }
}

module.exports = SheetsService;