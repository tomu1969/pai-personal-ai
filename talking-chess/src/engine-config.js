/**
 * Stockfish Engine Configuration Module
 * Maps ELO ratings to Stockfish engine parameters for difficulty calibration
 */

// ELO to engine parameter mapping - improved distribution
const ENGINE_CONFIG_MAP = {
  // Beginner level (800-1000 ELO) - Time-only for weak play
  800: { skillLevel: 1, depth: 2, moveTime: 50 },
  900: { skillLevel: 2, depth: 2, moveTime: 75 },
  1000: { skillLevel: 3, depth: 3, moveTime: 100 },
  
  // Intermediate level (1000-1200 ELO) - Short time, low depth
  1100: { skillLevel: 4, depth: 3, moveTime: 125 },
  1200: { skillLevel: 5, depth: 3, moveTime: 150 },
  
  // Advanced level (1200-1400 ELO) - Gradual increase
  1300: { skillLevel: 7, depth: 4, moveTime: 200 },
  1400: { skillLevel: 8, depth: 4, moveTime: 250 },
  
  // Expert level (1400-1600 ELO) - Moderate strength
  1500: { skillLevel: 10, depth: 5, moveTime: 300 },
  1600: { skillLevel: 11, depth: 5, moveTime: 400 },
  
  // Advanced Expert level (1600-1800 ELO)
  1700: { skillLevel: 12, depth: 6, moveTime: 500 },
  1800: { skillLevel: 13, depth: 6, moveTime: 650 },
  
  // Master level (1800-2000 ELO)
  1900: { skillLevel: 14, depth: 7, moveTime: 800 },
  2000: { skillLevel: 15, depth: 7, moveTime: 1000 },
  
  // International Master level (2000-2200 ELO)
  2100: { skillLevel: 16, depth: 8, moveTime: 1200 },
  2200: { skillLevel: 17, depth: 8, moveTime: 1400 },
  
  // Grandmaster level (2200-2400 ELO)
  2300: { skillLevel: 18, depth: 9, moveTime: 1600 },
  2400: { skillLevel: 19, depth: 9, moveTime: 1800 },
  
  // Super Grandmaster level (2400+ ELO)
  2500: { skillLevel: 19, depth: 10, moveTime: 2000 },
  2600: { skillLevel: 20, depth: 10, moveTime: 2200 },
  2700: { skillLevel: 20, depth: 11, moveTime: 2400 },
  2800: { skillLevel: 20, depth: 12, moveTime: 2600 },
  2900: { skillLevel: 20, depth: 13, moveTime: 2800 },
  3000: { skillLevel: 20, depth: 14, moveTime: 3000 }
};

/**
 * Get engine configuration for a target ELO rating
 * Uses linear interpolation between defined points
 * @param {number} targetElo - Target ELO rating
 * @returns {Object} Engine configuration with skillLevel, depth, moveTime
 */
function getEngineConfig(targetElo) {
  // Clamp to supported range
  if (targetElo < 800) targetElo = 800;
  if (targetElo > 3000) targetElo = 3000;
  
  // Find exact match
  if (ENGINE_CONFIG_MAP[targetElo]) {
    return { ...ENGINE_CONFIG_MAP[targetElo] };
  }
  
  // Find interpolation points
  const eloPoints = Object.keys(ENGINE_CONFIG_MAP).map(Number).sort((a, b) => a - b);
  
  let lowerElo = 800;
  let upperElo = 3000;
  
  for (let i = 0; i < eloPoints.length - 1; i++) {
    if (targetElo >= eloPoints[i] && targetElo <= eloPoints[i + 1]) {
      lowerElo = eloPoints[i];
      upperElo = eloPoints[i + 1];
      break;
    }
  }
  
  const lowerConfig = ENGINE_CONFIG_MAP[lowerElo];
  const upperConfig = ENGINE_CONFIG_MAP[upperElo];
  
  // Linear interpolation
  const ratio = (targetElo - lowerElo) / (upperElo - lowerElo);
  
  return {
    skillLevel: Math.round(lowerConfig.skillLevel + (upperConfig.skillLevel - lowerConfig.skillLevel) * ratio),
    depth: Math.round(lowerConfig.depth + (upperConfig.depth - lowerConfig.depth) * ratio),
    moveTime: Math.round(lowerConfig.moveTime + (upperConfig.moveTime - lowerConfig.moveTime) * ratio)
  };
}

/**
 * Get engine configuration with randomization for variety
 * Adds slight random variation to prevent predictable play
 * @param {number} targetElo - Target ELO rating
 * @returns {Object} Engine configuration with slight randomization
 */
function getRandomizedEngineConfig(targetElo) {
  const baseConfig = getEngineConfig(targetElo);
  
  // Add �10% randomization to move time for variety
  const timeVariation = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
  
  return {
    skillLevel: Math.max(0, Math.min(20, baseConfig.skillLevel)),
    depth: Math.max(1, Math.min(10, baseConfig.depth)),
    moveTime: Math.max(50, Math.round(baseConfig.moveTime * timeVariation))
  };
}

/**
 * Get difficulty description for UI display
 * @param {number} targetElo - Target ELO rating
 * @returns {string} Human-readable difficulty description
 */
function getDifficultyDescription(targetElo) {
  if (targetElo < 1000) return "Beginner";
  if (targetElo < 1200) return "Casual Player";
  if (targetElo < 1400) return "Club Player";
  if (targetElo < 1600) return "Advanced Player";
  if (targetElo < 1800) return "Expert";
  if (targetElo < 2000) return "Master";
  if (targetElo < 2200) return "International Master";
  if (targetElo < 2400) return "Grandmaster";
  return "Super Grandmaster";
}

/**
 * Validate engine configuration parameters
 * @param {Object} config - Engine configuration object
 * @returns {boolean} True if configuration is valid
 */
function validateEngineConfig(config) {
  return (
    config &&
    typeof config.skillLevel === 'number' &&
    config.skillLevel >= 0 && config.skillLevel <= 20 &&
    typeof config.depth === 'number' &&
    config.depth >= 1 && config.depth <= 20 &&
    typeof config.moveTime === 'number' &&
    config.moveTime >= 50 && config.moveTime <= 10000
  );
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getEngineConfig,
    getRandomizedEngineConfig,
    getDifficultyDescription,
    validateEngineConfig,
    ENGINE_CONFIG_MAP
  };
}

// Make functions available globally for browser use
if (typeof window !== 'undefined') {
  console.log('Loading EngineConfig module...');
  window.EngineConfig = {
    getEngineConfig,
    getRandomizedEngineConfig,
    getDifficultyDescription,
    validateEngineConfig,
    ENGINE_CONFIG_MAP
  };
  console.log('EngineConfig module loaded successfully');
}