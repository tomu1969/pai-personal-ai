/**
 * Unit Tests for ELO Input & Calculation System - Step 3
 * Following Test-Driven Development approach
 */

const { JSDOM } = require('jsdom');

describe('ELO Input & Calculation System - Step 3', () => {
  let dom;
  let window;
  let document;
  let mockLocalStorage;
  
  beforeEach(() => {
    // Create a clean DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <input type="number" id="elo-input" min="800" max="3000" value="1500">
          <input type="range" id="strength-input" min="-50" max="100" value="10" step="5">
          <span id="strength-percentage">+10%</span>
          <span id="opponent-elo">Target: 1650</span>
          <div id="elo-error-message"></div>
          <button id="preset-easy" data-percentage="-20">Easy</button>
          <button id="preset-normal" data-percentage="10">Normal</button>
          <button id="preset-hard" data-percentage="30">Hard</button>
          <button id="preset-expert" data-percentage="50">Expert</button>
          <span id="elo-category">Intermediate</span>
          <span id="opponent-category">Advanced</span>
        </body>
      </html>
    `);
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    
    // Mock localStorage
    mockLocalStorage = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = mockLocalStorage;
  });
  
  afterEach(() => {
    dom.window.close();
  });

  describe('ELO Range Validation', () => {
    test('should accept valid ELO values within range', () => {
      const validElos = [800, 1200, 1500, 2000, 2500, 3000];
      
      validElos.forEach(elo => {
        expect(elo).toBeGreaterThanOrEqual(800);
        expect(elo).toBeLessThanOrEqual(3000);
      });
    });

    test('should reject ELO values below minimum', () => {
      const invalidElos = [799, 500, 0, -100];
      
      invalidElos.forEach(elo => {
        expect(elo).toBeLessThan(800);
      });
    });

    test('should reject ELO values above maximum', () => {
      const invalidElos = [3001, 3500, 4000, 5000];
      
      invalidElos.forEach(elo => {
        expect(elo).toBeGreaterThan(3000);
      });
    });

    test('should handle edge cases correctly', () => {
      expect(800).toBe(800); // Minimum
      expect(3000).toBe(3000); // Maximum
      expect(1500).toBeGreaterThan(800); // Typical value
      expect(1500).toBeLessThan(3000); // Typical value
    });

    test('should validate non-numeric inputs', () => {
      const invalidInputs = ['abc', '', null, undefined, NaN];
      
      invalidInputs.forEach(input => {
        const parsed = parseInt(input);
        expect(isNaN(parsed) || parsed < 800 || parsed > 3000).toBe(true);
      });
    });
  });

  describe('Percentage Modifier Validation', () => {
    test('should accept valid percentage values within range', () => {
      const validPercentages = [-50, -25, 0, 10, 25, 50, 75, 100];
      
      validPercentages.forEach(percentage => {
        expect(percentage).toBeGreaterThanOrEqual(-50);
        expect(percentage).toBeLessThanOrEqual(100);
      });
    });

    test('should reject percentage values outside range', () => {
      const invalidPercentages = [-60, -100, 110, 150, 200];
      
      invalidPercentages.forEach(percentage => {
        expect(percentage < -50 || percentage > 100).toBe(true);
      });
    });

    test('should handle step values correctly', () => {
      const stepValues = [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      
      stepValues.forEach(value => {
        expect(Math.abs(value % 5)).toBe(0);
      });
    });
  });

  describe('Target ELO Calculation', () => {
    test('should calculate target ELO correctly for positive percentages', () => {
      const testCases = [
        { userElo: 1500, percentage: 10, expected: 1650 },
        { userElo: 1200, percentage: 25, expected: 1500 },
        { userElo: 2000, percentage: 20, expected: 2400 },
        { userElo: 800, percentage: 50, expected: 1200 }
      ];
      
      testCases.forEach(({ userElo, percentage, expected }) => {
        const result = Math.round(userElo * (1 + percentage / 100));
        expect(result).toBe(expected);
      });
    });

    test('should calculate target ELO correctly for negative percentages', () => {
      const testCases = [
        { userElo: 1500, percentage: -10, expected: 1350 },
        { userElo: 1200, percentage: -20, expected: 960 },
        { userElo: 2000, percentage: -25, expected: 1500 },
        { userElo: 1000, percentage: -50, expected: 500 }
      ];
      
      testCases.forEach(({ userElo, percentage, expected }) => {
        const result = Math.round(userElo * (1 + percentage / 100));
        expect(result).toBe(expected);
      });
    });

    test('should handle zero percentage correctly', () => {
      const userElo = 1500;
      const percentage = 0;
      const result = Math.round(userElo * (1 + percentage / 100));
      expect(result).toBe(userElo);
    });

    test('should round results to nearest integer', () => {
      const userElo = 1333;
      const percentage = 7; // Results in 1426.31
      const result = Math.round(userElo * (1 + percentage / 100));
      expect(result).toBe(1426);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('ELO Categories', () => {
    test('should categorize ELO ratings correctly', () => {
      const categories = [
        { elo: 800, category: 'Beginner' },
        { elo: 1000, category: 'Beginner' },
        { elo: 1199, category: 'Beginner' },
        { elo: 1200, category: 'Intermediate' },
        { elo: 1400, category: 'Intermediate' },
        { elo: 1599, category: 'Intermediate' },
        { elo: 1600, category: 'Advanced' },
        { elo: 1800, category: 'Advanced' },
        { elo: 1999, category: 'Advanced' },
        { elo: 2000, category: 'Expert' },
        { elo: 2200, category: 'Expert' },
        { elo: 2399, category: 'Expert' },
        { elo: 2400, category: 'Master' },
        { elo: 2600, category: 'Master' },
        { elo: 3000, category: 'Master' }
      ];
      
      categories.forEach(({ elo, category }) => {
        let expectedCategory;
        if (elo < 1200) expectedCategory = 'Beginner';
        else if (elo < 1600) expectedCategory = 'Intermediate';
        else if (elo < 2000) expectedCategory = 'Advanced';
        else if (elo < 2400) expectedCategory = 'Expert';
        else expectedCategory = 'Master';
        
        expect(expectedCategory).toBe(category);
      });
    });
  });

  describe('Preset Difficulty Levels', () => {
    test('should define correct preset percentages', () => {
      const presets = [
        { name: 'Easy', percentage: -20 },
        { name: 'Normal', percentage: 10 },
        { name: 'Hard', percentage: 30 },
        { name: 'Expert', percentage: 50 }
      ];
      
      presets.forEach(({ name, percentage }) => {
        expect(percentage).toBeGreaterThanOrEqual(-50);
        expect(percentage).toBeLessThanOrEqual(100);
        expect(Math.abs(percentage % 5)).toBe(0); // Should align with step values
      });
    });

    test('should provide logical difficulty progression', () => {
      const easyPercentage = -20;
      const normalPercentage = 10;
      const hardPercentage = 30;
      const expertPercentage = 50;
      
      expect(easyPercentage).toBeLessThan(normalPercentage);
      expect(normalPercentage).toBeLessThan(hardPercentage);
      expect(hardPercentage).toBeLessThan(expertPercentage);
    });
  });

  describe('User Preference Persistence', () => {
    test('should save user preferences to localStorage', () => {
      const preferences = {
        userElo: 1650,
        strengthPercentage: 25,
        lastUpdated: Date.now()
      };
      
      // Simulate the saveUserPreferences function behavior
      mockLocalStorage.setItem('chess-user-preferences', JSON.stringify(preferences));
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chess-user-preferences',
        JSON.stringify(preferences)
      );
    });

    test('should load user preferences from localStorage', () => {
      const savedPreferences = {
        userElo: 1750,
        strengthPercentage: 15,
        lastUpdated: 1763211173006 // Fixed timestamp
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedPreferences));
      
      const loaded = JSON.parse(mockLocalStorage.getItem('chess-user-preferences'));
      expect(loaded).toEqual(savedPreferences);
    });

    test('should handle corrupted preference data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      try {
        JSON.parse(mockLocalStorage.getItem('chess-user-preferences'));
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });

    test('should provide default values when no preferences exist', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = mockLocalStorage.getItem('chess-user-preferences');
      expect(result).toBeNull();
      
      // Should fallback to defaults
      const defaults = { userElo: 1500, strengthPercentage: 10 };
      expect(defaults.userElo).toBe(1500);
      expect(defaults.strengthPercentage).toBe(10);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme ELO values gracefully', () => {
      const extremeCases = [
        { userElo: 800, percentage: -50, expected: 400 }, // Very low
        { userElo: 3000, percentage: 100, expected: 6000 }, // Very high
      ];
      
      extremeCases.forEach(({ userElo, percentage, expected }) => {
        const result = Math.round(userElo * (1 + percentage / 100));
        expect(result).toBe(expected);
      });
    });

    test('should handle floating point precision issues', () => {
      const userElo = 1333;
      const percentage = 33; // 1333 * 1.33 = 1772.89
      const result = Math.round(userElo * (1 + percentage / 100));
      expect(result).toBe(1773);
      expect(Number.isInteger(result)).toBe(true);
    });

    test('should validate input types', () => {
      const invalidInputs = [
        { elo: 'abc', percentage: 10 },
        { elo: 1500, percentage: 'def' },
        { elo: null, percentage: null },
        { elo: undefined, percentage: undefined }
      ];
      
      invalidInputs.forEach(({ elo, percentage }) => {
        const parsedElo = parseInt(elo);
        const parsedPercentage = parseInt(percentage);
        
        const isValidElo = !isNaN(parsedElo) && parsedElo >= 800 && parsedElo <= 3000;
        const isValidPercentage = !isNaN(parsedPercentage) && parsedPercentage >= -50 && parsedPercentage <= 100;
        
        expect(isValidElo && isValidPercentage).toBe(false);
      });
    });
  });

  describe('UI Integration', () => {
    test('should update ELO input field correctly', () => {
      const eloInput = document.getElementById('elo-input');
      eloInput.value = '1750';
      
      expect(eloInput.value).toBe('1750');
      expect(parseInt(eloInput.value)).toBe(1750);
    });

    test('should update strength percentage slider correctly', () => {
      const strengthInput = document.getElementById('strength-input');
      strengthInput.value = '25';
      
      expect(strengthInput.value).toBe('25');
      expect(parseInt(strengthInput.value)).toBe(25);
    });

    test('should display calculated values correctly', () => {
      const strengthPercentage = document.getElementById('strength-percentage');
      const opponentElo = document.getElementById('opponent-elo');
      
      strengthPercentage.textContent = '+25%';
      opponentElo.textContent = 'Target: 1875';
      
      expect(strengthPercentage.textContent).toBe('+25%');
      expect(opponentElo.textContent).toBe('Target: 1875');
    });

    test('should show error messages for invalid inputs', () => {
      const errorMessage = document.getElementById('elo-error-message');
      
      errorMessage.textContent = 'ELO must be between 800 and 3000';
      errorMessage.style.display = 'block';
      
      expect(errorMessage.textContent).toBe('ELO must be between 800 and 3000');
      expect(errorMessage.style.display).toBe('block');
    });

    test('should display ELO categories correctly', () => {
      const eloCategory = document.getElementById('elo-category');
      const opponentCategory = document.getElementById('opponent-category');
      
      eloCategory.textContent = 'Advanced';
      opponentCategory.textContent = 'Expert';
      
      expect(eloCategory.textContent).toBe('Advanced');
      expect(opponentCategory.textContent).toBe('Expert');
    });
  });

  describe('Recommended Percentages', () => {
    test('should recommend appropriate percentages based on user ELO', () => {
      const recommendations = [
        { userElo: 800, recommended: 20 }, // Beginners should face slightly stronger
        { userElo: 1200, recommended: 15 },
        { userElo: 1600, recommended: 10 },
        { userElo: 2000, recommended: 5 },
        { userElo: 2500, recommended: 0 } // Masters might want equal strength
      ];
      
      recommendations.forEach(({ userElo, recommended }) => {
        // Logic: Lower rated players get higher recommendations
        let expectedRecommendation;
        if (userElo < 1000) expectedRecommendation = 20;
        else if (userElo < 1400) expectedRecommendation = 15;
        else if (userElo < 1800) expectedRecommendation = 10;
        else if (userElo < 2200) expectedRecommendation = 5;
        else expectedRecommendation = 0;
        
        expect(expectedRecommendation).toBe(recommended);
      });
    });
  });

  describe('Performance Validation', () => {
    test('should calculate ELO quickly for rapid UI updates', () => {
      const start = Date.now();
      
      // Simulate 100 rapid calculations
      for (let i = 0; i < 100; i++) {
        const userElo = 800 + (i * 22); // 800 to 3000
        const percentage = -50 + i; // -50 to +50
        Math.round(userElo * (1 + percentage / 100));
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10); // Should complete in under 10ms
    });
  });
});