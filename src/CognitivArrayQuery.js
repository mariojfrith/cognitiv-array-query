const comparators = require('./comparators');
const { DateUtils, BasicUtils } = require('./utils');

class CognitivArrayQuery {
  constructor(options = {}) {
    this.dateUtils = new DateUtils(options.datePatterns);
    this.comparators = comparators;
    this._evaluate = this._evaluate.bind(this);
    this._processObject = this._processObject.bind(this);
  }

  Utils = BasicUtils;

  get arrayComparators() {
    return comparators.arrayComparators;
  }

  logic = {
    $or: (row, conditions, getter) =>
      Array.isArray(conditions) ?
        conditions.some((condition) => this._evaluate(row, condition, getter)) :
        Object.entries(conditions).some(([key, condition]) => 
          this._evaluateCondition(row, key, condition, getter)
        ),
    $and: (row, conditions, getter) =>
      Array.isArray(conditions) ?
        conditions.every((condition) => this._evaluate(row, condition, getter)) :
        Object.entries(conditions).every(([key, condition]) => 
          this._evaluateCondition(row, key, condition, getter)
        ),
    $not: (row, condition, getter) => !this._evaluate(row, condition, getter),
    $nor: (row, conditions, getter) =>
      !conditions.some((condition) => this._evaluate(row, condition, getter)),
    $where: (row, condition) => {
      if (typeof condition !== 'function')
        throw new Error('$where requires a function');
      return condition.call(row);
    },
    $xor: (row, conditions, getter) => {
      const results = conditions.map((condition) =>
        this._evaluate(row, condition, getter)
      );
      return results.filter(Boolean).length === 1;
    },
  };

  _evaluate(row, constraints, getter) {
    if (!constraints || typeof constraints !== 'object') {
      return false;
    }

    if (Array.isArray(constraints)) {
      return constraints.some((constraint) =>
        this._evaluate(row, constraint, getter)
      );
    }

    // Handle special operators at top level
    if (this._hasSpecialOperator(constraints)) {
      return this._evaluateSpecialOperator(row, null, constraints, getter);
    }

    return this._processObject(row, constraints, getter);
  }

  _hasSpecialOperator(condition) {
    return condition.$eleMatch || condition.$cb;
  }

  _evaluateSpecialOperator(row, field, condition, getter) {
    if (condition.$eleMatch) {
      return this.comparators.$eleMatch(row, condition.$eleMatch, field, getter);
    }
    if (condition.$cb) {
      return this.comparators.$cb(row, condition.$cb, field, getter);
    }
    return false;
  }

  _processObject(row, constraints, getter) {
    return Object.entries(constraints).every(([key, condition]) => {
      // Handle special operators
      if (this._hasSpecialOperator(condition)) {
        return this._evaluateSpecialOperator(row, key, condition, getter);
      }

      // Handle logical operators
      if (this.logic[key]) {
        const conditions = Array.isArray(condition) ? condition : [condition];
        return this.logic[key](row, conditions, getter);
      }

      // Handle regular conditions
      return this._evaluateCondition(row, key, condition, getter);
    });
  }

  _evaluateCondition(row, field, condition, getter) {
    // Handle primitive values
    if (!condition || typeof condition !== 'object') {
      const value = getter ? getter(row, field) : this.Utils.get(row, field);
      return this.comparators.$eq(value, condition);
    }

    // Handle special operators
    if (this._hasSpecialOperator(condition)) {
      return this._evaluateSpecialOperator(row, field, condition, getter);
    }

    // Handle regular operators
    return this.comparators._evaluateCondition(row, field, condition, (r, k) =>
      this.Utils.get(r, k, getter)
    );
  }

  satisfies(row, constraints, getter) {
    return this._evaluate(row, constraints, getter);
  }

  build(constraints, getter) {
    return (row) => this._evaluate(row, constraints, getter);
  }

  query(rows, constraints, getter) {
    if (!Array.isArray(rows)) return [];
    const filter = this.build(constraints, getter);
    return rows.filter(filter);
  }
}

module.exports = CognitivArrayQuery;
