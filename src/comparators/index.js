const { DateUtils, BasicUtils } = require('../utils');
const ElementMatchOperator = require('../operators/elementMatch');
const PathUtils = require('../utils/pathUtils');

class Comparators {
  constructor() {
    this.dateUtils = new DateUtils();
    this.Utils = BasicUtils;
    this.elementMatch = new ElementMatchOperator(this);
  }

  // Basic comparisons
  $eq = (a, b) => {
    if (this.dateUtils.isDateLike(a) && this.dateUtils.isDateLike(b)) {
      return this.dateUtils.compare(a, b) === 0;
    }
    return a === b;
  };
  $ne = (a, b) => !this.$eq(a, b);
  $gt = (a, b) => {
    if (this.dateUtils.isDateLike(a) && this.dateUtils.isDateLike(b)) {
      return this.dateUtils.compare(a, b) > 0;
    }
    return a > b;
  };
  $gte = (a, b) => this.$gt(a, b) || this.$eq(a, b);
  $lt = (a, b) => {
    if (this.dateUtils.isDateLike(a) && this.dateUtils.isDateLike(b)) {
      return this.dateUtils.compare(a, b) < 0;
    }
    return a < b;
  };
  $lte = (a, b) => this.$lt(a, b) || this.$eq(a, b);

  // Array operations
  $in = (a, b) => Array.isArray(b) && b.includes(a);
  $nin = (a, b) => !this.$in(a, b);
  $contains = (a, b) => Array.isArray(a) && a.includes(b);
  $containsAll = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && b.every((item) => a.includes(item));
  $containsAny = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && b.some((item) => a.includes(item));
  $size = (a, condition) => {
    if (!Array.isArray(a)) return false;
    const size = a.length;
    if (typeof condition === 'object' && condition !== null) {
      return Object.entries(condition).every(
        ([operator, operand]) => this[operator] && this[operator](size, operand)
      );
    }
    return size === condition;
  };

  // Element Match operation
  $eleMatch = (row, condition, field, getter) => this.elementMatch.evaluate(row, condition, field, getter);

  // Type checks
  $type = (a, b) => typeof a === b;
  $exists = (a, b) => (a !== undefined) === b;
  $regex = (a, b) => {
    try {
      return new RegExp(b).test(String(a));
    } catch {
      return false;
    }
  };

  // Math operations
  $mod = (a, b) => Array.isArray(b) && b.length === 2 && a % b[0] === b[1];
  $between = (a, b) => Array.isArray(b) && b.length === 2 && a >= b[0] && a <= b[1];

  // String operations
  $startsWith = (a, b) => String(a).startsWith(String(b));
  $endsWith = (a, b) => String(a).endsWith(String(b));
  $includes = (a, b) => String(a).includes(String(b));
  $length = (a, b) => String(a).length === b;

  // Custom callback
  $cb = (row, callback, field, getter) => {
    if (typeof callback !== 'function') {
      throw new Error('$cb requires a function');
    }

    try {
      // Prepare context for callback
      const context = {
        field,
        getter,
        utils: this.Utils,
        comparators: this,
        getValue: (path) => getter ? getter(row, path) : PathUtils.get(row, path)
      };

      // Call with proper context and error handling
      return callback.call(context, row, field, this, this.Utils, getter);
    } catch (error) {
      throw new Error(`Error in $cb execution: ${error.message}`);
    }
  };

  _evaluateCondition = (row, field, condition, getter) => {
    // Handle primitive values
    if (!condition || typeof condition !== 'object') {
      const value = getter ? getter(row, field) : PathUtils.get(row, field);
      return this.$eq(value, condition);
    }

    // Handle special operators
    if (this._hasSpecialOperator(condition)) {
      return this._evaluateSpecialOperator(row, field, condition, getter);
    }

    // Handle regular operators
    return Object.entries(condition).every(([operator, operand]) => {
      return this._evaluateOperator(row, field, operator, operand, getter);
    });
  };

  _hasSpecialOperator(condition) {
    return condition.$eleMatch || condition.$cb;
  }

  _evaluateSpecialOperator(row, field, condition, getter) {
    if (condition.$eleMatch) {
      return this.$eleMatch(row, condition.$eleMatch, field, getter);
    }
    if (condition.$cb) {
      return this.$cb(row, condition.$cb, field, getter);
    }
    return false;
  }

  _evaluateOperator(row, field, operator, operand, getter) {
    // Handle callback operator
    if (operator === '$cb') {
      return this.$cb(row, operand, field, getter);
    }

    // Handle nested field
    if (!operator.startsWith('$')) {
      const value = getter ? getter(row, field) : PathUtils.get(row, field);
      return this._evaluateCondition(value, operator, operand, getter);
    }

    // Handle unsupported operator
    if (!this[operator]) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    // Handle regular operator
    const value = getter ? getter(row, field) : PathUtils.get(row, field);
    return this[operator](value, operand, field, getter);
  }

  static isSupportedOperator(operator) {
    return operator.startsWith('$') && Object.hasOwnProperty.call(this.prototype, operator);
  }

  static get arrayComparators() {
    return ['$in', '$nin', '$contains', '$containsAll', '$containsAny', '$size'];
  }
}

module.exports = new Comparators();