const filterService = require('../../src/services/utils/filters');

describe('MessageFilterService', () => {
  describe('analyzeMessage', () => {
    it('should analyze business message correctly', () => {
      const content = 'I need to schedule a meeting for the project deadline next week';
      const result = filterService.analyzeMessage(content);

      expect(result.category).toBe('business');
      expect(result.priority).toBe('high');
      expect(result.messageType).toBe('request');
      expect(result.language).toBe('english');
      expect(result.isSpam).toBe(false);
      expect(result.containsUrgentKeywords).toBe(false);
      expect(result.sentiment).toBe('neutral');
      expect(result.wordCount).toBeGreaterThan(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect urgent messages', () => {
      const content = 'URGENT! The server is down and we need immediate help!';
      const result = filterService.analyzeMessage(content);

      expect(result.priority).toBe('urgent');
      expect(result.containsUrgentKeywords).toBe(true);
      expect(result.category).toBe('urgent');
    });

    it('should classify personal messages', () => {
      const content = 'Hi John! Thanks for the birthday wishes yesterday';
      const result = filterService.analyzeMessage(content);

      expect(result.category).toBe('personal');
      expect(result.messageType).toBe('gratitude');
      expect(result.sentiment).toBe('positive');
      expect(result.priority).toBe('low');
    });

    it('should detect spam messages', () => {
      const content = 'Congratulations! You won $1000! Click here to claim your free money now!';
      const result = filterService.analyzeMessage(content);

      expect(result.isSpam).toBe(true);
      expect(result.category).toBe('spam');
      expect(result.flags).toContain('contains_links');
    });

    it('should detect Spanish messages', () => {
      const content = 'Hola, necesito ayuda con un problema urgente por favor';
      const result = filterService.analyzeMessage(content);

      expect(result.language).toBe('spanish');
      expect(result.category).toBe('support');
      expect(result.priority).toBe('urgent');
    });

    it('should handle questions correctly', () => {
      const content = 'How do I reset my password?';
      const result = filterService.analyzeMessage(content);

      expect(result.messageType).toBe('question');
      expect(result.category).toBe('support');
      expect(result.priority).toBe('medium');
    });

    it('should handle greetings', () => {
      const content = 'Hello there!';
      const result = filterService.analyzeMessage(content);

      expect(result.messageType).toBe('greeting');
      expect(result.category).toBe('personal');
      expect(result.priority).toBe('low');
    });

    it('should extract information from message', () => {
      const content = 'Call me at +1-555-123-4567 or email john@example.com. Meeting at 2:30 PM on 12/25/2024';
      const result = filterService.analyzeMessage(content);

      expect(result.extractedInfo.phoneNumbers).toContain('+1-555-123-4567');
      expect(result.extractedInfo.emails).toContain('john@example.com');
      expect(result.extractedInfo.times).toContain('2:30 PM');
      expect(result.extractedInfo.dates).toContain('12/25/2024');
      expect(result.flags).toContain('contains_phone');
    });

    it('should handle analysis errors gracefully', () => {
      // Simulate error by passing non-string content
      const result = filterService.analyzeMessage(null);

      expect(result.category).toBe('other');
      expect(result.priority).toBe('medium');
      expect(result.confidence).toBe(0.1);
      expect(result.flags).toContain('analysis_failed');
    });
  });

  describe('determineCategory', () => {
    it('should return "other" for unmatched content', () => {
      const result = filterService.determineCategory('random text with no keywords');
      expect(result).toBe('other');
    });

    it('should prioritize category with highest score', () => {
      const content = 'urgent business meeting help support';
      const result = filterService.determineCategory(content);
      // Should match multiple categories but return the one with highest score
      expect(['urgent', 'business', 'support']).toContain(result);
    });
  });

  describe('determinePriority', () => {
    it('should return urgent for urgent keywords', () => {
      expect(filterService.determinePriority('this is an emergency')).toBe('urgent');
      expect(filterService.determinePriority('need help asap')).toBe('urgent');
    });

    it('should return high for important keywords', () => {
      expect(filterService.determinePriority('important meeting deadline')).toBe('high');
    });

    it('should return high for messages with excessive caps or exclamation', () => {
      expect(filterService.determinePriority('THIS IS VERY IMPORTANT!!')).toBe('high');
    });

    it('should return medium for longer messages', () => {
      const longMessage = 'This is a relatively long message that contains more than fifty words to test the word count logic and ensure that longer messages get medium priority by default when they do not contain specific priority keywords or indicators.';
      expect(filterService.determinePriority(longMessage)).toBe('medium');
    });

    it('should return medium for normal messages', () => {
      expect(filterService.determinePriority('just a normal message')).toBe('medium');
    });
  });

  describe('analyzeSentiment', () => {
    it('should detect positive sentiment', () => {
      expect(filterService.analyzeSentiment('great excellent awesome')).toBe('positive');
      expect(filterService.analyzeSentiment('i love this')).toBe('positive');
    });

    it('should detect negative sentiment', () => {
      expect(filterService.analyzeSentiment('terrible awful hate')).toBe('negative');
      expect(filterService.analyzeSentiment('this is broken and bad')).toBe('negative');
    });

    it('should return neutral for balanced or no sentiment words', () => {
      expect(filterService.analyzeSentiment('just some normal text')).toBe('neutral');
      expect(filterService.analyzeSentiment('good and bad mixed')).toBe('neutral');
    });
  });

  describe('detectSpam', () => {
    it('should detect spam patterns', () => {
      expect(filterService.detectSpam('winner congratulations you won')).toBe(true);
      expect(filterService.detectSpam('free money click here')).toBe(true);
      expect(filterService.detectSpam('act now limited time')).toBe(true);
      expect(filterService.detectSpam('guaranteed make money fast')).toBe(true);
      expect(filterService.detectSpam('bitcoin investment opportunity')).toBe(true);
    });

    it('should detect excessive links as spam', () => {
      const content = 'Check https://link1.com and https://link2.com and https://link3.com';
      expect(filterService.detectSpam(content)).toBe(true);
    });

    it('should detect excessive capitals as spam', () => {
      const content = 'THIS IS ALL CAPITALS AND LOOKS LIKE SPAM MESSAGE';
      expect(filterService.detectSpam(content)).toBe(true);
    });

    it('should detect excessive punctuation as spam', () => {
      const content = 'Wow!!! Amazing!!! Incredible!!! Great!!!';
      expect(filterService.detectSpam(content)).toBe(true);
    });

    it('should not flag normal messages as spam', () => {
      expect(filterService.detectSpam('Hi, how are you doing today?')).toBe(false);
      expect(filterService.detectSpam('Can we schedule a meeting?')).toBe(false);
    });
  });

  describe('classifyMessageType', () => {
    it('should classify questions', () => {
      expect(filterService.classifyMessageType('What time is it?')).toBe('question');
      expect(filterService.classifyMessageType('How do I do this?')).toBe('question');
      expect(filterService.classifyMessageType('When is the meeting?')).toBe('question');
    });

    it('should classify greetings', () => {
      expect(filterService.classifyMessageType('Hi there')).toBe('greeting');
      expect(filterService.classifyMessageType('Hello John')).toBe('greeting');
      expect(filterService.classifyMessageType('Hey!')).toBe('greeting');
    });

    it('should classify gratitude', () => {
      expect(filterService.classifyMessageType('Thanks for your help')).toBe('gratitude');
      expect(filterService.classifyMessageType('Thank you so much')).toBe('gratitude');
    });

    it('should classify confirmations', () => {
      expect(filterService.classifyMessageType('Ok sounds good')).toBe('confirmation');
      expect(filterService.classifyMessageType('Yes, that works')).toBe('confirmation');
      expect(filterService.classifyMessageType('Sure!')).toBe('confirmation');
    });

    it('should classify requests', () => {
      expect(filterService.classifyMessageType('Please help me with this')).toBe('request');
      expect(filterService.classifyMessageType('Could you send me the file?')).toBe('request');
      expect(filterService.classifyMessageType('Can you call me back?')).toBe('request');
    });

    it('should default to statement', () => {
      expect(filterService.classifyMessageType('Just letting you know')).toBe('statement');
      expect(filterService.classifyMessageType('The weather is nice')).toBe('statement');
    });
  });

  describe('detectLanguage', () => {
    it('should detect Spanish', () => {
      expect(filterService.detectLanguage('hola como estas')).toBe('spanish');
      expect(filterService.detectLanguage('gracias por favor')).toBe('spanish');
      expect(filterService.detectLanguage('necesito ayuda')).toBe('spanish');
    });

    it('should detect English', () => {
      expect(filterService.detectLanguage('hello how are you')).toBe('english');
      expect(filterService.detectLanguage('thanks please help')).toBe('english');
      expect(filterService.detectLanguage('what do you need')).toBe('english');
    });

    it('should return unknown for unmatched languages', () => {
      expect(filterService.detectLanguage('random text no keywords')).toBe('unknown');
      expect(filterService.detectLanguage('123 456 789')).toBe('unknown');
    });
  });

  describe('extractInformation', () => {
    it('should extract phone numbers', () => {
      const content = 'Call me at +1-555-123-4567 or (555) 987-6543';
      const result = filterService.extractInformation(content);

      expect(result.phoneNumbers).toContain('+1-555-123-4567');
      expect(result.phoneNumbers).toContain('(555) 987-6543');
    });

    it('should extract email addresses', () => {
      const content = 'Contact john@example.com or jane.doe@company.org';
      const result = filterService.extractInformation(content);

      expect(result.emails).toContain('john@example.com');
      expect(result.emails).toContain('jane.doe@company.org');
    });

    it('should extract URLs', () => {
      const content = 'Check https://example.com and http://test.org';
      const result = filterService.extractInformation(content);

      expect(result.urls).toContain('https://example.com');
      expect(result.urls).toContain('http://test.org');
    });

    it('should extract dates', () => {
      const content = 'Meeting on 12/25/2024 or 2024-01-15';
      const result = filterService.extractInformation(content);

      expect(result.dates).toContain('12/25/2024');
      expect(result.dates).toContain('2024-01-15');
    });

    it('should extract times', () => {
      const content = 'Call at 2:30 PM or 14:45';
      const result = filterService.extractInformation(content);

      expect(result.times).toContain('2:30 PM');
      expect(result.times).toContain('14:45');
    });

    it('should extract prices', () => {
      const content = 'Costs $1,500.00 or 50 dollars';
      const result = filterService.extractInformation(content);

      expect(result.prices).toContain('$1,500.00');
      expect(result.prices).toContain('50 dollars');
    });
  });

  describe('addContextualFlags', () => {
    it('should add time-based flags', () => {
      const analysis = { flags: [] };
      const originalHour = new Date().getHours;
      
      // Mock time to be outside hours
      Date.prototype.getHours = jest.fn().mockReturnValue(23);
      
      filterService.addContextualFlags(analysis, {});

      expect(analysis.flags).toContain('sent_outside_hours');
      
      // Restore original function
      Date.prototype.getHours = originalHour;
    });

    it('should add first contact flag', () => {
      const analysis = { flags: [] };
      
      filterService.addContextualFlags(analysis, { isFirstMessage: true });

      expect(analysis.flags).toContain('first_contact');
    });

    it('should detect potential bots', () => {
      const analysis = { flags: [], isSpam: false };
      
      filterService.addContextualFlags(analysis, { senderName: 'chatbot' });

      expect(analysis.flags).toContain('potential_bot');
      expect(analysis.isSpam).toBe(true);
    });

    it('should flag message length', () => {
      const analysis = { flags: [], wordCount: 2 };
      
      filterService.addContextualFlags(analysis, {});
      
      expect(analysis.flags).toContain('very_short');

      analysis.flags = [];
      analysis.wordCount = 150;
      
      filterService.addContextualFlags(analysis, {});
      
      expect(analysis.flags).toContain('very_long');
    });

    it('should flag content with extracted info', () => {
      const analysis = {
        flags: [],
        extractedInfo: {
          urls: ['http://example.com'],
          phoneNumbers: ['+1-555-123-4567'],
        },
      };
      
      filterService.addContextualFlags(analysis, {});

      expect(analysis.flags).toContain('contains_links');
      expect(analysis.flags).toContain('contains_phone');
    });
  });

  describe('getFilterStatistics', () => {
    it('should return filter statistics', () => {
      const stats = filterService.getFilterStatistics();

      expect(stats).toHaveProperty('totalKeywords');
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('priorities');
      expect(stats).toHaveProperty('spamPatterns');
      expect(stats).toHaveProperty('version');
      expect(stats.totalKeywords).toBeGreaterThan(0);
      expect(Array.isArray(stats.categories)).toBe(true);
      expect(Array.isArray(stats.priorities)).toBe(true);
    });
  });

  describe('updateKeywords', () => {
    it('should update existing category keywords', () => {
      const result = filterService.updateKeywords('business', ['corporate', 'enterprise']);

      expect(result).toBe(true);
      expect(filterService.keywords.business).toContain('corporate');
      expect(filterService.keywords.business).toContain('enterprise');
    });

    it('should return false for non-existent category', () => {
      const result = filterService.updateKeywords('nonexistent', ['test']);

      expect(result).toBe(false);
    });

    it('should deduplicate keywords', () => {
      const originalLength = filterService.keywords.business.length;
      filterService.updateKeywords('business', ['meeting', 'project']); // Existing keywords

      // Length should not increase since these are duplicates
      expect(filterService.keywords.business.length).toBe(originalLength);
    });
  });
});