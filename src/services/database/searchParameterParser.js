const logger = require('../utils/logger');

class SearchParameterParser {
  constructor() {
    this.dateKeywords = ['today', 'yesterday', 'now'];
    this.timeFormat = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    this.dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  }

  /**
   * Validate and normalize search parameters
   * @param {object} params - Raw search parameters
   * @returns {object} Validation result with normalized parameters
   */
  validateAndNormalize(params) {
    const errors = [];
    const warnings = [];
    const normalized = {};

    try {
      // Validate required parameters
      if (!params.start_date) {
        errors.push('start_date is required');
      } else {
        normalized.start_date = this.validateDate(params.start_date);
        if (!normalized.start_date.valid) {
          errors.push(`Invalid start_date: ${normalized.start_date.error}`);
        }
      }

      if (!params.end_date) {
        errors.push('end_date is required');  
      } else {
        normalized.end_date = this.validateDate(params.end_date);
        if (!normalized.end_date.valid) {
          errors.push(`Invalid end_date: ${normalized.end_date.error}`);
        }
      }

      // Validate optional time parameters
      normalized.start_time = this.validateTime(params.start_time || '00:00');
      if (!normalized.start_time.valid) {
        errors.push(`Invalid start_time: ${normalized.start_time.error}`);
      }

      normalized.end_time = this.validateTime(params.end_time || '23:59');
      if (!normalized.end_time.valid) {
        errors.push(`Invalid end_time: ${normalized.end_time.error}`);
      }

      // Validate sender
      normalized.sender = this.validateSender(params.sender);
      if (!normalized.sender.valid) {
        warnings.push(`Sender warning: ${normalized.sender.warning}`);
      }

      // Validate keywords
      normalized.keywords = this.validateKeywords(params.keywords);
      if (!normalized.keywords.valid) {
        warnings.push(`Keywords warning: ${normalized.keywords.warning}`);
      }

      // Validate limit
      normalized.limit = this.validateLimit(params.limit);
      if (!normalized.limit.valid) {
        warnings.push(`Limit warning: ${normalized.limit.warning}`);
      }

      // Logical validations
      if (normalized.start_date.valid && normalized.end_date.valid) {
        const logicalCheck = this.validateDateRange(
          normalized.start_date.value,
          normalized.end_date.value,
          normalized.start_time.value,
          normalized.end_time.value
        );
        
        if (!logicalCheck.valid) {
          errors.push(logicalCheck.error);
        } else if (logicalCheck.warning) {
          warnings.push(logicalCheck.warning);
        }
      }

      const result = {
        valid: errors.length === 0,
        errors,
        warnings,
        normalized: errors.length === 0 ? {
          start_date: normalized.start_date.value,
          end_date: normalized.end_date.value,
          start_time: normalized.start_time.value,
          end_time: normalized.end_time.value,
          sender: normalized.sender.value,
          keywords: normalized.keywords.value,
          limit: normalized.limit.value,
        } : null,
      };

      logger.debug('Search parameter validation completed', {
        inputParams: params,
        result: result,
      });

      return result;

    } catch (error) {
      logger.error('Search parameter validation failed', {
        params,
        error: error.message,
      });

      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        normalized: null,
      };
    }
  }

  /**
   * Validate date parameter
   */
  validateDate(date) {
    if (typeof date !== 'string') {
      return { valid: false, error: 'Date must be a string' };
    }

    const lowerDate = date.toLowerCase().trim();

    // Check for keywords
    if (this.dateKeywords.includes(lowerDate)) {
      return { valid: true, value: lowerDate };
    }

    // Check for YYYY-MM-DD format
    if (this.dateFormat.test(date)) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return { valid: false, error: 'Invalid date value' };
      }
      return { valid: true, value: date };
    }

    return {
      valid: false,
      error: 'Date must be in YYYY-MM-DD format or keywords: today, yesterday',
    };
  }

  /**
   * Validate time parameter
   */
  validateTime(time) {
    if (typeof time !== 'string') {
      return { valid: false, error: 'Time must be a string' };
    }

    const trimmedTime = time.trim();

    if (!this.timeFormat.test(trimmedTime)) {
      return {
        valid: false,
        error: 'Time must be in HH:MM format (24-hour)',
      };
    }

    return { valid: true, value: trimmedTime };
  }

  /**
   * Validate sender parameter
   */
  validateSender(sender) {
    if (sender === undefined || sender === null) {
      return { valid: true, value: 'all' };
    }

    if (typeof sender !== 'string') {
      return { 
        valid: true, 
        value: 'all',
        warning: 'Sender must be a string, defaulting to "all"',
      };
    }

    const trimmedSender = sender.trim();
    if (!trimmedSender) {
      return { valid: true, value: 'all' };
    }

    // Basic sanitization
    const cleanSender = trimmedSender.replace(/[<>\"']/g, '');
    
    return { valid: true, value: cleanSender };
  }

  /**
   * Validate keywords parameter
   */
  validateKeywords(keywords) {
    if (keywords === undefined || keywords === null) {
      return { valid: true, value: [] };
    }

    if (!Array.isArray(keywords)) {
      return {
        valid: true,
        value: [],
        warning: 'Keywords must be an array, defaulting to empty array',
      };
    }

    // Filter and sanitize keywords
    const validKeywords = keywords
      .filter(keyword => typeof keyword === 'string' && keyword.trim())
      .map(keyword => keyword.trim().replace(/[<>\"']/g, ''))
      .filter(keyword => keyword.length > 0)
      .slice(0, 10); // Limit to 10 keywords

    if (validKeywords.length !== keywords.length) {
      return {
        valid: true,
        value: validKeywords,
        warning: `Some keywords were filtered out, using ${validKeywords.length} valid keywords`,
      };
    }

    return { valid: true, value: validKeywords };
  }

  /**
   * Validate limit parameter
   */
  validateLimit(limit) {
    if (limit === undefined || limit === null) {
      return { valid: true, value: 50 };
    }

    const numLimit = Number(limit);
    if (isNaN(numLimit) || numLimit < 1) {
      return {
        valid: true,
        value: 50,
        warning: 'Limit must be a positive number, defaulting to 50',
      };
    }

    if (numLimit > 200) {
      return {
        valid: true,
        value: 200,
        warning: 'Limit cannot exceed 200, using maximum value',
      };
    }

    return { valid: true, value: Math.floor(numLimit) };
  }

  /**
   * Validate date range logic
   */
  validateDateRange(startDate, endDate, startTime, endTime) {
    try {
      // Parse dates
      const start = this.parseDateTime(startDate, startTime);
      const end = this.parseDateTime(endDate, endTime);

      if (start > end) {
        return {
          valid: false,
          error: 'Start date/time cannot be after end date/time',
        };
      }

      // Check for very large ranges (more than 30 days)
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > 30) {
        return {
          valid: true,
          warning: 'Large date range (>30 days) may return limited results',
        };
      }

      // Check for future dates
      const now = new Date();
      if (start > now) {
        return {
          valid: false,
          error: 'Start date cannot be in the future',
        };
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Date range validation error: ${error.message}`,
      };
    }
  }

  /**
   * Parse date and time into Date object
   */
  parseDateTime(dateStr, timeStr) {
    const now = new Date();
    
    let baseDate;
    switch (dateStr.toLowerCase()) {
      case 'today':
        baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        baseDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        break;
      default:
        baseDate = new Date(dateStr);
    }

    if (isNaN(baseDate.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    // Add time
    const [hours, minutes] = timeStr.split(':').map(Number);
    baseDate.setHours(hours, minutes, 0, 0);

    return baseDate;
  }

  /**
   * Generate example parameters for testing
   */
  generateExamples() {
    return [
      {
        description: 'Today\'s messages',
        params: {
          start_date: 'today',
          end_date: 'today',
        },
      },
      {
        description: 'Yesterday\'s messages from Laura',
        params: {
          start_date: 'yesterday', 
          end_date: 'yesterday',
          sender: 'Laura',
        },
      },
      {
        description: 'This morning\'s messages with "meeting"',
        params: {
          start_date: 'today',
          end_date: 'today',
          end_time: '12:00',
          keywords: ['meeting'],
        },
      },
      {
        description: 'Last week\'s urgent messages',
        params: {
          start_date: '2024-08-25',
          end_date: '2024-09-01',
          keywords: ['urgent', 'important'],
          limit: 100,
        },
      },
    ];
  }
}

module.exports = new SearchParameterParser();