const logger = require('../utils/logger');

class MessageFilterService {
  constructor() {
    // Predefined keywords for different categories
    this.keywords = {
      urgent: [
        'urgent', 'emergency', 'asap', 'immediately', 'help', 'problem', 'issue', 'broken',
        'error', 'bug', 'crash', 'down', 'not working', 'critical', 'important',
        'urgente', 'emergencia', 'ayuda', 'problema',
      ],
      business: [
        'meeting', 'project', 'deadline', 'proposal', 'contract', 'invoice', 'payment',
        'budget', 'quote', 'business', 'work', 'office', 'schedule', 'appointment',
        'conference', 'presentation', 'report', 'analysis', 'strategy',
        'reunión', 'proyecto', 'contrato', 'factura', 'pago', 'presupuesto',
      ],
      sales: [
        'buy', 'purchase', 'order', 'price', 'cost', 'discount', 'offer', 'deal',
        'product', 'service', 'package', 'plan', 'subscription', 'demo',
        'trial', 'pricing', 'quote', 'estimate',
        'comprar', 'precio', 'descuento', 'oferta', 'producto', 'servicio',
      ],
      support: [
        'help', 'support', 'how to', 'tutorial', 'guide', 'question', 'issue',
        'problem', 'error', 'bug', 'troubleshoot', 'fix', 'broken', 'not working',
        'manual', 'documentation', 'setup', 'install', 'configure',
        'ayuda', 'soporte', 'como', 'pregunta', 'error', 'problema',
      ],
      personal: [
        'hi', 'hello', 'hey', 'thanks', 'thank you', 'birthday', 'congratulations',
        'family', 'friend', 'personal', 'private', 'chat', 'talk', 'catch up',
        'hola', 'gracias', 'cumpleaños', 'felicidades', 'familia', 'amigo',
      ],
      spam: [
        'winner', 'congratulations you won', 'free money', 'click here', 'limited time',
        'offer expires', 'act now', 'guaranteed', 'risk free', 'no obligation',
        'make money fast', 'work from home', 'lose weight', 'miracle', 'bitcoin',
        'cryptocurrency', 'investment opportunity', 'lottery', 'prize',
      ],
    };

    // Priority indicators
    this.priorityKeywords = {
      urgent: ['urgent', 'emergency', 'asap', 'critical', 'immediately', 'help', 'urgente', 'emergencia'],
      high: ['important', 'deadline', 'meeting', 'business', 'contract', 'importante', 'reunión'],
      medium: ['question', 'support', 'help', 'issue', 'pregunta', 'soporte'],
      low: ['hi', 'hello', 'thanks', 'chat', 'hola', 'gracias'],
    };

    // Spam indicators
    this.spamIndicators = [
      /\b(free|gratis)\s+(money|dinero)/i,
      /\b(click|hace\s+click)\s+(here|aquí)/i,
      /\b(winner|ganador)\b/i,
      /\b(congratulations|felicitaciones)\s+you\s+won/i,
      /\b(act\s+now|actúa\s+ahora)/i,
      /\b(limited\s+time|tiempo\s+limitado)/i,
      /\b(make\s+money\s+fast|dinero\s+rápido)/i,
      /\b(guaranteed|garantizado)\b/i,
      /\$\d+.*\b(hour|hora|day|día)\b/i,
      /\b(bitcoin|btc|crypto)/i,
    ];
  }

  /**
   * Analyze message content and return categorization
   * @param {string} content - Message content to analyze
   * @param {object} metadata - Additional metadata (sender info, time, etc.)
   * @returns {object} Analysis results
   */
  analyzeMessage(content, metadata = {}) {
    try {
      const normalizedContent = content.toLowerCase().trim();

      const analysis = {
        content: content.substring(0, 200), // Store preview for logging
        category: this.determineCategory(normalizedContent),
        priority: this.determinePriority(normalizedContent, metadata),
        sentiment: this.analyzeSentiment(normalizedContent),
        isSpam: this.detectSpam(normalizedContent),
        containsUrgentKeywords: this.containsUrgentKeywords(normalizedContent),
        messageType: this.classifyMessageType(normalizedContent),
        language: this.detectLanguage(normalizedContent),
        wordCount: content.split(/\s+/).length,
        confidence: 0.7, // Base confidence, will be enhanced with AI
        extractedInfo: this.extractInformation(normalizedContent),
        flags: [],
      };

      // Add contextual flags
      this.addContextualFlags(analysis, metadata);

      logger.debug('Message analyzed', {
        category: analysis.category,
        priority: analysis.priority,
        isSpam: analysis.isSpam,
        confidence: analysis.confidence,
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze message', {
        error: error.message,
        contentLength: content.length,
      });

      return {
        content: content.substring(0, 200),
        category: 'other',
        priority: 'medium',
        sentiment: 'neutral',
        isSpam: false,
        containsUrgentKeywords: false,
        messageType: 'text',
        language: 'unknown',
        wordCount: content.split(/\s+/).length,
        confidence: 0.1,
        extractedInfo: {},
        flags: ['analysis_failed'],
      };
    }
  }

  /**
   * Determine message category based on content
   */
  determineCategory(content) {
    const scores = {};

    // Calculate scores for each category
    Object.entries(this.keywords).forEach(([category, keywords]) => {
      scores[category] = 0;
      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(content)) {
          scores[category] += 1;
        }
      });
    });

    // Find category with highest score
    const maxScore = Math.max(...Object.values(scores));
    const bestCategory = Object.keys(scores).find((cat) => scores[cat] === maxScore);

    // Return 'other' if no clear category or score is too low
    return maxScore > 0 ? bestCategory : 'other';
  }

  /**
   * Determine message priority
   */
  determinePriority(content, metadata = {}) {
    // Check for urgent keywords first
    if (this.containsUrgentKeywords(content)) {
      return 'urgent';
    }

    // Check priority keywords
    for (const [priority, keywords] of Object.entries(this.priorityKeywords)) {
      for (const keyword of keywords) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(content)) {
          return priority;
        }
      }
    }

    // Consider message characteristics
    const wordCount = content.split(/\s+/).length;
    const hasExclamation = (content.match(/!/g) || []).length > 1;
    const hasAllCaps = content.split(/\s+/).some((word) => word.length > 3 && word === word.toUpperCase());

    // Contextual priority adjustments
    if (hasAllCaps || hasExclamation) {
      return 'high';
    }

    if (wordCount > 50) {
      return 'medium';
    }

    return 'medium';
  }

  /**
   * Analyze sentiment (basic implementation)
   */
  analyzeSentiment(content) {
    const positiveWords = [
      'good', 'great', 'excellent', 'awesome', 'amazing', 'perfect', 'love',
      'happy', 'pleased', 'satisfied', 'wonderful', 'fantastic', 'brilliant',
      'bueno', 'excelente', 'increíble', 'perfecto', 'feliz', 'contento',
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'frustrated',
      'disappointed', 'annoyed', 'upset', 'problem', 'issue', 'broken',
      'malo', 'terrible', 'horrible', 'odio', 'enojado', 'frustrado',
    ];

    let positiveScore = 0;
    let negativeScore = 0;

    positiveWords.forEach((word) => {
      if (new RegExp(`\\b${word}\\b`, 'i').test(content)) {
        positiveScore++;
      }
    });

    negativeWords.forEach((word) => {
      if (new RegExp(`\\b${word}\\b`, 'i').test(content)) {
        negativeScore++;
      }
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Detect spam content
   */
  detectSpam(content) {
    // Check spam patterns
    for (const pattern of this.spamIndicators) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Check for excessive links
    const linkCount = (content.match(/https?:\/\/\S+/g) || []).length;
    if (linkCount > 2) {
      return true;
    }

    // Check for excessive capital letters
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5 && content.length > 20) {
      return true;
    }

    // Check for excessive punctuation
    const punctuationCount = (content.match(/[!?]{2,}/g) || []).length;
    if (punctuationCount > 3) {
      return true;
    }

    return false;
  }

  /**
   * Check for urgent keywords
   */
  containsUrgentKeywords(content) {
    return this.priorityKeywords.urgent.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(content));
  }

  /**
   * Classify message type beyond just text/media
   */
  classifyMessageType(content) {
    if (/\?\s*$/.test(content) || /^(what|how|when|where|why|who)/i.test(content)) {
      return 'question';
    }

    if (/^(hi|hello|hey)/i.test(content)) {
      return 'greeting';
    }

    if (/^(thanks|thank you|thx)/i.test(content)) {
      return 'gratitude';
    }

    if (/^(ok|okay|yes|no|sure)/i.test(content)) {
      return 'confirmation';
    }

    if (/(please|could you|can you)/i.test(content)) {
      return 'request';
    }

    return 'statement';
  }

  /**
   * Basic language detection
   */
  detectLanguage(content) {
    const spanishWords = [
      'hola', 'gracias', 'por favor', 'como', 'que', 'cuando', 'donde',
      'ayuda', 'problema', 'necesito', 'quiero', 'tengo', 'estoy',
    ];

    const englishWords = [
      'hello', 'thanks', 'please', 'how', 'what', 'when', 'where',
      'help', 'problem', 'need', 'want', 'have', 'am', 'is', 'are',
    ];

    let spanishScore = 0;
    let englishScore = 0;

    spanishWords.forEach((word) => {
      if (new RegExp(`\\b${word}\\b`, 'i').test(content)) {
        spanishScore++;
      }
    });

    englishWords.forEach((word) => {
      if (new RegExp(`\\b${word}\\b`, 'i').test(content)) {
        englishScore++;
      }
    });

    if (spanishScore > englishScore) return 'spanish';
    if (englishScore > spanishScore) return 'english';
    return 'unknown';
  }

  /**
   * Extract useful information from message
   */
  extractInformation(content) {
    const info = {};

    // Extract phone numbers
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d\s.-]{7,}/g;
    const phones = content.match(phoneRegex);
    if (phones) {
      info.phoneNumbers = phones.map((p) => p.trim());
    }

    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex);
    if (emails) {
      info.emails = emails;
    }

    // Extract URLs
    const urlRegex = /https?:\/\/\S+/g;
    const urls = content.match(urlRegex);
    if (urls) {
      info.urls = urls;
    }

    // Extract dates (basic patterns)
    const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g;
    const dates = content.match(dateRegex);
    if (dates) {
      info.dates = dates;
    }

    // Extract times
    const timeRegex = /\b(\d{1,2}:\d{2}(?:\s?[APap][Mm])?)\b/g;
    const times = content.match(timeRegex);
    if (times) {
      info.times = times;
    }

    // Extract prices/money amounts
    const moneyRegex = /\$\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s?(?:dollars?|usd|€|euros?)/gi;
    const prices = content.match(moneyRegex);
    if (prices) {
      info.prices = prices;
    }

    return info;
  }

  /**
   * Add contextual flags based on metadata
   */
  addContextualFlags(analysis, metadata) {
    // Time-based flags
    const now = new Date();
    const hour = now.getHours();

    if (hour < 6 || hour > 22) {
      analysis.flags.push('sent_outside_hours');
    }

    // Sender-based flags
    if (metadata.isFirstMessage) {
      analysis.flags.push('first_contact');
    }

    if (metadata.senderName && metadata.senderName.includes('bot')) {
      analysis.flags.push('potential_bot');
      analysis.isSpam = true;
    }

    // Content-based flags
    if (analysis.wordCount < 3) {
      analysis.flags.push('very_short');
    }

    if (analysis.wordCount > 100) {
      analysis.flags.push('very_long');
    }

    if (analysis.extractedInfo.urls && analysis.extractedInfo.urls.length > 0) {
      analysis.flags.push('contains_links');
    }

    if (analysis.extractedInfo.phoneNumbers && analysis.extractedInfo.phoneNumbers.length > 0) {
      analysis.flags.push('contains_phone');
    }

    // Spam confidence adjustment
    if (analysis.flags.includes('potential_bot')
        || analysis.flags.includes('sent_outside_hours') && analysis.containsUrgentKeywords) {
      analysis.confidence *= 0.5;
    }
  }

  /**
   * Get filter statistics
   */
  getFilterStatistics() {
    return {
      totalKeywords: Object.values(this.keywords).flat().length,
      categories: Object.keys(this.keywords),
      priorities: Object.keys(this.priorityKeywords),
      spamPatterns: this.spamIndicators.length,
      version: '1.0.0',
    };
  }

  /**
   * Update filter keywords (for future admin interface)
   */
  updateKeywords(category, keywords) {
    if (this.keywords[category]) {
      this.keywords[category] = [...new Set([...this.keywords[category], ...keywords])];
      logger.info('Filter keywords updated', {
        category,
        newKeywordCount: keywords.length,
        totalKeywords: this.keywords[category].length,
      });
      return true;
    }
    return false;
  }
}

// Export singleton instance
module.exports = new MessageFilterService();
