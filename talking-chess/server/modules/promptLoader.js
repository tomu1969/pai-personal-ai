/**
 * Prompt Loader Module - Talking Chess Chat Mentor
 * Loads and processes external prompt templates with variable substitution
 */

const fs = require('fs');
const path = require('path');

/**
 * Cache for loaded prompt templates to avoid repeated file reads
 */
const promptCache = new Map();

/**
 * Loads a prompt template from the prompts directory
 * @param {string} promptName - Name of the prompt file (without .md extension)
 * @returns {string} - Raw prompt template content
 * @throws {Error} If prompt file cannot be loaded
 */
function loadPromptTemplate(promptName) {
  // Check cache first
  if (promptCache.has(promptName)) {
    return promptCache.get(promptName);
  }

  try {
    const promptsDir = path.join(__dirname, '../../prompts');
    const promptPath = path.join(promptsDir, `${promptName}.md`);
    
    if (!fs.existsSync(promptPath)) {
      throw new Error(`Prompt template not found: ${promptPath}`);
    }

    const template = fs.readFileSync(promptPath, 'utf8');
    
    // Cache the template for future use
    promptCache.set(promptName, template);
    
    console.log(`Loaded prompt template: ${promptName}`);
    return template;
    
  } catch (error) {
    console.error(`Failed to load prompt template '${promptName}':`, error.message);
    throw new Error(`Failed to load prompt template '${promptName}': ${error.message}`);
  }
}

/**
 * Fills template variables in mustache-style format {{variable}}
 * @param {string} template - Prompt template with {{variable}} placeholders
 * @param {Object} variables - Key-value pairs for variable substitution
 * @returns {string} - Template with variables replaced
 */
function fillPromptTemplate(template, variables = {}) {
  if (!template || typeof template !== 'string') {
    throw new Error('Template must be a non-empty string');
  }

  if (typeof variables !== 'object' || variables === null) {
    throw new Error('Variables must be an object');
  }

  let filledTemplate = template;

  // Replace all {{variable}} patterns
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key];
    
    // Convert value to string, handling null/undefined
    const stringValue = (value !== null && value !== undefined) ? String(value) : '';
    
    // Replace all occurrences of this placeholder
    filledTemplate = filledTemplate.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
  });

  // Check for unfilled placeholders and warn about them
  const unfilledPlaceholders = filledTemplate.match(/\{\{[^}]+\}\}/g);
  if (unfilledPlaceholders) {
    console.warn('Unfilled template variables found:', unfilledPlaceholders);
  }

  return filledTemplate;
}

/**
 * Loads and fills a prompt template in one operation
 * @param {string} promptName - Name of the prompt file (without .md extension)
 * @param {Object} variables - Key-value pairs for variable substitution
 * @returns {string} - Complete prompt with variables filled
 */
function loadAndFillPrompt(promptName, variables = {}) {
  const template = loadPromptTemplate(promptName);
  return fillPromptTemplate(template, variables);
}

/**
 * Clears the prompt cache (useful for development/testing)
 * @param {string} [promptName] - Optional specific prompt to clear, or clear all if not provided
 */
function clearPromptCache(promptName = null) {
  if (promptName) {
    promptCache.delete(promptName);
    console.log(`Cleared cache for prompt: ${promptName}`);
  } else {
    promptCache.clear();
    console.log('Cleared all prompt cache');
  }
}

/**
 * Validates that all required variables are present in the template
 * @param {string} template - Prompt template to validate
 * @param {Object} variables - Variables that will be provided
 * @returns {Object} - Validation result with missing variables
 */
function validatePromptVariables(template, variables = {}) {
  const placeholders = template.match(/\{\{([^}]+)\}\}/g) || [];
  const requiredVars = placeholders.map(p => p.replace(/\{\{|\}\}/g, ''));
  const missingVars = requiredVars.filter(varName => !(varName in variables));
  
  return {
    isValid: missingVars.length === 0,
    requiredVariables: [...new Set(requiredVars)], // Remove duplicates
    missingVariables: missingVars,
    providedVariables: Object.keys(variables)
  };
}

module.exports = {
  loadPromptTemplate,
  fillPromptTemplate,
  loadAndFillPrompt,
  clearPromptCache,
  validatePromptVariables
};