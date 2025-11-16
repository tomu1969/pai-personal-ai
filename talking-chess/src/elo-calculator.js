/**
 * ELO Calculator Module
 * Handles all ELO-related calculations and validation
 */

// Constants
const ELO_RANGE = {
  MIN: 800,
  MAX: 3000
};

const PERCENTAGE_RANGE = {
  MIN: -50,
  MAX: 100,
  STEP: 5
};

const ELO_CATEGORIES = {
  BEGINNER: { min: 800, max: 1199, name: 'Beginner' },
  INTERMEDIATE: { min: 1200, max: 1599, name: 'Intermediate' },
  ADVANCED: { min: 1600, max: 1999, name: 'Advanced' },
  EXPERT: { min: 2000, max: 2399, name: 'Expert' },
  MASTER: { min: 2400, max: 3000, name: 'Master' }
};

const PRESET_DIFFICULTIES = {
  EASY: { name: 'Easy', percentage: -20, description: 'Easier opponent' },
  NORMAL: { name: 'Normal', percentage: 10, description: 'Slightly stronger opponent' },
  HARD: { name: 'Hard', percentage: 30, description: 'Much stronger opponent' },
  EXPERT: { name: 'Expert', percentage: 50, description: 'Expert level opponent' }
};

/**
 * Calculate opponent ELO based on user ELO and strength percentage
 * @param {number} userElo - User's current ELO rating
 * @param {number} strengthPercentage - Strength modifier percentage (-50 to +100)
 * @returns {number} Calculated opponent ELO (rounded to nearest integer)
 */
function calculateOpponentElo(userElo, strengthPercentage) {
  if (!validateEloRange(userElo)) {
    throw new Error(`Invalid user ELO: ${userElo}. Must be between ${ELO_RANGE.MIN} and ${ELO_RANGE.MAX}`);
  }
  
  if (!validatePercentageRange(strengthPercentage)) {
    throw new Error(`Invalid percentage: ${strengthPercentage}. Must be between ${PERCENTAGE_RANGE.MIN}% and ${PERCENTAGE_RANGE.MAX}%`);
  }
  
  const multiplier = 1 + (strengthPercentage / 100);
  return Math.round(userElo * multiplier);
}

/**
 * Validate ELO rating is within acceptable range
 * @param {number} elo - ELO rating to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateEloRange(elo) {
  const numElo = parseInt(elo);
  return !isNaN(numElo) && numElo >= ELO_RANGE.MIN && numElo <= ELO_RANGE.MAX;
}

/**
 * Validate strength percentage is within acceptable range
 * @param {number} percentage - Percentage to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validatePercentageRange(percentage) {
  const numPercentage = parseInt(percentage);
  return !isNaN(numPercentage) && numPercentage >= PERCENTAGE_RANGE.MIN && numPercentage <= PERCENTAGE_RANGE.MAX;
}

/**
 * Get ELO category based on rating
 * @param {number} elo - ELO rating
 * @returns {string} Category name (Beginner, Intermediate, Advanced, Expert, Master)
 */
function getEloCategory(elo) {
  const numElo = parseInt(elo);
  
  if (numElo < ELO_CATEGORIES.INTERMEDIATE.min) return ELO_CATEGORIES.BEGINNER.name;
  if (numElo < ELO_CATEGORIES.ADVANCED.min) return ELO_CATEGORIES.INTERMEDIATE.name;
  if (numElo < ELO_CATEGORIES.EXPERT.min) return ELO_CATEGORIES.ADVANCED.name;
  if (numElo < ELO_CATEGORIES.MASTER.min) return ELO_CATEGORIES.EXPERT.name;
  return ELO_CATEGORIES.MASTER.name;
}

/**
 * Get recommended percentage based on user ELO
 * Lower rated players get higher recommendations to encourage improvement
 * @param {number} userElo - User's ELO rating
 * @returns {number} Recommended strength percentage
 */
function getRecommendedPercentage(userElo) {
  const numElo = parseInt(userElo);
  
  if (numElo < 1000) return 20;  // Beginners should face stronger opponents
  if (numElo < 1400) return 15;
  if (numElo < 1800) return 10;
  if (numElo < 2200) return 5;
  return 0; // Masters might want equal strength
}

/**
 * Get display name for ELO with category
 * @param {number} elo - ELO rating
 * @returns {string} Formatted display string (e.g., "1500 (Intermediate)")
 */
function getEloDisplayName(elo) {
  const category = getEloCategory(elo);
  return `${elo} (${category})`;
}

/**
 * Save user preferences to localStorage
 * @param {number} userElo - User's ELO rating
 * @param {number} strengthPercentage - Strength percentage
 * @returns {boolean} True if saved successfully, false otherwise
 */
function saveUserPreferences(userElo, strengthPercentage) {
  try {
    const preferences = {
      userElo: parseInt(userElo),
      strengthPercentage: parseInt(strengthPercentage),
      lastUpdated: Date.now(),
      version: '1.0'
    };
    
    localStorage.setItem('chess-user-preferences', JSON.stringify(preferences));
    return true;
  } catch (error) {
    console.warn('Failed to save user preferences:', error);
    return false;
  }
}

/**
 * Load user preferences from localStorage
 * @returns {Object|null} User preferences object or null if not found/invalid
 */
function loadUserPreferences() {
  try {
    const saved = localStorage.getItem('chess-user-preferences');
    if (!saved) return null;
    
    const preferences = JSON.parse(saved);
    
    // Validate loaded preferences
    if (!validateEloRange(preferences.userElo) || !validatePercentageRange(preferences.strengthPercentage)) {
      console.warn('Invalid preferences found, removing...');
      localStorage.removeItem('chess-user-preferences');
      return null;
    }
    
    return preferences;
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
    localStorage.removeItem('chess-user-preferences');
    return null;
  }
}

/**
 * Get default user preferences
 * @returns {Object} Default preferences object
 */
function getDefaultPreferences() {
  return {
    userElo: 1500,
    strengthPercentage: 10,
    lastUpdated: Date.now(),
    version: '1.0'
  };
}

/**
 * Validate and sanitize ELO input
 * @param {any} input - Input value to validate
 * @returns {Object} Validation result with value and error message
 */
function validateEloInput(input) {
  const value = parseInt(input);
  
  if (isNaN(value)) {
    return {
      isValid: false,
      value: null,
      error: 'Please enter a valid number'
    };
  }
  
  if (value < ELO_RANGE.MIN) {
    return {
      isValid: false,
      value: value,
      error: `ELO must be at least ${ELO_RANGE.MIN}`
    };
  }
  
  if (value > ELO_RANGE.MAX) {
    return {
      isValid: false,
      value: value,
      error: `ELO must be no more than ${ELO_RANGE.MAX}`
    };
  }
  
  return {
    isValid: true,
    value: value,
    error: null
  };
}

/**
 * Validate and sanitize percentage input
 * @param {any} input - Input value to validate
 * @returns {Object} Validation result with value and error message
 */
function validatePercentageInput(input) {
  const value = parseInt(input);
  
  if (isNaN(value)) {
    return {
      isValid: false,
      value: null,
      error: 'Please enter a valid number'
    };
  }
  
  if (value < PERCENTAGE_RANGE.MIN) {
    return {
      isValid: false,
      value: value,
      error: `Percentage must be at least ${PERCENTAGE_RANGE.MIN}%`
    };
  }
  
  if (value > PERCENTAGE_RANGE.MAX) {
    return {
      isValid: false,
      value: value,
      error: `Percentage must be no more than ${PERCENTAGE_RANGE.MAX}%`
    };
  }
  
  return {
    isValid: true,
    value: value,
    error: null
  };
}

/**
 * Get all preset difficulty configurations
 * @returns {Object} All preset difficulties
 */
function getPresetDifficulties() {
  return PRESET_DIFFICULTIES;
}

/**
 * Format percentage for display
 * @param {number} percentage - Percentage value
 * @returns {string} Formatted percentage string (e.g., "+10%" or "-20%")
 */
function formatPercentage(percentage) {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage}%`;
}

/**
 * Calculate statistics for a given ELO and percentage combination
 * @param {number} userElo - User's ELO rating
 * @param {number} strengthPercentage - Strength percentage
 * @returns {Object} Statistics object with various calculated values
 */
function calculateEloStats(userElo, strengthPercentage) {
  const opponentElo = calculateOpponentElo(userElo, strengthPercentage);
  const userCategory = getEloCategory(userElo);
  const opponentCategory = getEloCategory(opponentElo);
  const recommended = getRecommendedPercentage(userElo);
  const eloDifference = opponentElo - userElo;
  
  return {
    userElo,
    opponentElo,
    strengthPercentage,
    userCategory,
    opponentCategory,
    eloDifference,
    recommendedPercentage: recommended,
    isRecommended: Math.abs(strengthPercentage - recommended) <= 5,
    difficultyLevel: getDifficultyLevel(strengthPercentage),
    formattedPercentage: formatPercentage(strengthPercentage)
  };
}

/**
 * Get difficulty level description based on percentage
 * @param {number} percentage - Strength percentage
 * @returns {string} Difficulty description
 */
function getDifficultyLevel(percentage) {
  if (percentage <= -30) return 'Very Easy';
  if (percentage <= -10) return 'Easy';
  if (percentage <= 10) return 'Normal';
  if (percentage <= 30) return 'Hard';
  if (percentage <= 50) return 'Very Hard';
  return 'Extreme';
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateOpponentElo,
    validateEloRange,
    validatePercentageRange,
    getEloCategory,
    getRecommendedPercentage,
    getEloDisplayName,
    saveUserPreferences,
    loadUserPreferences,
    getDefaultPreferences,
    validateEloInput,
    validatePercentageInput,
    getPresetDifficulties,
    formatPercentage,
    calculateEloStats,
    getDifficultyLevel,
    ELO_RANGE,
    PERCENTAGE_RANGE,
    ELO_CATEGORIES,
    PRESET_DIFFICULTIES
  };
}

// Make functions available globally for browser use
if (typeof window !== 'undefined') {
  window.EloCalculator = {
    calculateOpponentElo,
    validateEloRange,
    validatePercentageRange,
    getEloCategory,
    getRecommendedPercentage,
    getEloDisplayName,
    saveUserPreferences,
    loadUserPreferences,
    getDefaultPreferences,
    validateEloInput,
    validatePercentageInput,
    getPresetDifficulties,
    formatPercentage,
    calculateEloStats,
    getDifficultyLevel,
    ELO_RANGE,
    PERCENTAGE_RANGE,
    ELO_CATEGORIES,
    PRESET_DIFFICULTIES
  };
}