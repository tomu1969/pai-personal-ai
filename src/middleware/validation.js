const Joi = require('joi'); // Used for creating validation schemas

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return next(validationError);
  }
  return next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.query);
  if (error) {
    const validationError = new Error('Query validation failed');
    validationError.name = 'ValidationError';
    validationError.details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return next(validationError);
  }
  return next();
};

const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params);
  if (error) {
    const validationError = new Error('Parameter validation failed');
    validationError.name = 'ValidationError';
    validationError.details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return next(validationError);
  }
  return next();
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
  Joi, // Export Joi for creating schemas
};
