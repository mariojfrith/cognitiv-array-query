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
    return condition && typeof condition === 'object' && (condition.$eleMatch || condition.$cb);
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

  _evaluateArrayPath(value, path, condition) {
    if (!Array.isArray(value)) return false;

    if (condition.$eleMatch) {
      return value.some(item => {
        if (path.includes('.')) {
          const [first, ...rest] = path.split('.');
          const nextValue = this.Utils.get(item, first);
          if (Array.isArray(nextValue)) {
            return nextValue.some(element => {
              return Object.entries(condition.$eleMatch).every(([key, val]) => {
                const fieldValue = this.Utils.get(element, key);
                if (typeof val === 'object' && val !== null) {
                  if (val.$in && Array.isArray(fieldValue)) {
                    return fieldValue.some(v => val.$in.includes(v));
                  }
                  return this._evaluateElement(fieldValue, val);
                }
                return this.comparators.$eq(fieldValue, val);
              });
            });
          }
          const targetValue = this.Utils.get(item, path);
          if (Array.isArray(targetValue)) {
            return targetValue.some(element => {
              return Object.entries(condition.$eleMatch).every(([key, val]) => {
                const fieldValue = this.Utils.get(element, key);
                if (typeof val === 'object' && val !== null) {
                  if (val.$in && Array.isArray(fieldValue)) {
                    return fieldValue.some(v => val.$in.includes(v));
                  }
                  return this._evaluateElement(fieldValue, val);
                }
                return this.comparators.$eq(fieldValue, val);
              });
            });
          }
        }
        const fieldValue = this.Utils.get(item, path);
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(element => {
            return Object.entries(condition.$eleMatch).every(([key, val]) => {
              const elemValue = this.Utils.get(element, key);
              if (typeof val === 'object' && val !== null) {
                if (val.$in && Array.isArray(elemValue)) {
                  return elemValue.some(v => val.$in.includes(v));
                }
                return this._evaluateElement(elemValue, val);
              }
              return this.comparators.$eq(elemValue, val);
            });
          });
        }
        return this._evaluateElement(fieldValue, condition.$eleMatch);
      });
    }

    return value.some(item => {
      if (path.includes('.')) {
        const [first, ...rest] = path.split('.');
        const nextValue = this.Utils.get(item, first);
        if (Array.isArray(nextValue)) {
          return this._evaluateArrayPath(nextValue, rest.join('.'), condition);
        }
        return this._evaluateCondition(item, path, condition);
      }

      const fieldValue = this.Utils.get(item, path);
      if (Array.isArray(fieldValue)) {
        if (condition.$in) {
          return fieldValue.some(val => condition.$in.includes(val));
        }
        if (condition.$contains) {
          return this.comparators.$contains(fieldValue, condition.$contains);
        }
        if (condition.$size) {
          return this.comparators.$size(fieldValue, condition.$size);
        }
        return fieldValue.some(val => this._evaluateCondition({ value: val }, 'value', condition));
      }

      return this._evaluateElement(fieldValue, condition);
    });
  }

  _evaluateElement(value, condition) {
    if (!condition || typeof condition !== 'object') {
      return this.comparators.$eq(value, condition);
    }

    return Object.entries(condition).every(([key, val]) => {
      if (key.startsWith('$')) {
        const comparator = this.comparators[key];
        if (!comparator) throw new Error(`Unsupported operator: ${key}`);
        return comparator(value, val);
      }
      const fieldValue = this.Utils.get(value, key);
      if (typeof val === 'object' && val !== null) {
        return this._evaluateElement(fieldValue, val);
      }
      return this.comparators.$eq(fieldValue, val);
    });
  }

  _processObject(row, constraints, getter) {
    // Group dot notation paths by their root
    const dotPaths = {};
    const regularPaths = {};

    Object.entries(constraints).forEach(([key, condition]) => {
      if (key.includes('.')) {
        const [root] = key.split('.');
        if (!dotPaths[root]) dotPaths[root] = {};
        dotPaths[root][key] = condition;
      } else if (this.logic[key]) {
        regularPaths[key] = condition;
      } else {
        regularPaths[key] = condition;
      }
    });

    // Process dot notation paths first
    for (const [root, conditions] of Object.entries(dotPaths)) {
      const rootValue = getter ? getter(row, root) : this.Utils.get(row, root);
      
      if (Array.isArray(rootValue)) {
        // Handle array paths
        const matches = Object.entries(conditions).every(([path, condition]) => {
          const relativePath = path.substring(root.length + 1);
          return this._evaluateArrayPath(rootValue, relativePath, condition);
        });
        
        if (!matches) return false;
      } else {
        // Handle non-array nested objects
        const matches = Object.entries(conditions).every(([path, condition]) => {
          const value = this.Utils.get(row, path);
          return this._evaluateElement(value, condition);
        });
        
        if (!matches) return false;
      }
    }

    // Process regular paths
    return Object.entries(regularPaths).every(([key, condition]) => {
      // Handle special operators
      if (this._hasSpecialOperator(condition)) {
        return this._evaluateSpecialOperator(row, key, condition, getter);
      }

      // Handle logical operators
      if (this.logic[key]) {
        const conditions = Array.isArray(condition) ? condition : [condition];
        return this.logic[key](row, conditions, getter);
      }

      // Get the value
      const value = getter ? getter(row, key) : this.Utils.get(row, key);
      return this._evaluateElement(value, condition);
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

    // Handle array size conditions
    if (condition.$size !== undefined) {
      const value = getter ? getter(row, field) : this.Utils.get(row, field);
      if (Array.isArray(value)) {
        return this.comparators.$size(value, condition.$size);
      }
      return false;
    }

    // Handle nested size conditions
    if (field.includes('.')) {
      const parts = field.split('.');
      let currentValue = row;
      
      // Navigate through the path
      for (let i = 0; i < parts.length - 1; i++) {
        currentValue = this.Utils.get(currentValue, parts[i]);
        if (!currentValue) return false;
        
        // If we encounter an array in the path, we need to check each element
        if (Array.isArray(currentValue)) {
          const remainingPath = parts.slice(i + 1).join('.');
          return this._evaluateArrayPath(currentValue, remainingPath, condition);
        }
      }
      
      // Get the final value
      const finalValue = this.Utils.get(currentValue, parts[parts.length - 1]);
      
      // Handle operators
      if (condition && typeof condition === 'object') {
        if (Array.isArray(finalValue)) {
          if (condition.$contains) {
            return this.comparators.$contains(finalValue, condition.$contains);
          }
          if (condition.$in) {
            return this.comparators.$in(finalValue, condition.$in);
          }
        }
        return Object.entries(condition).every(([op, val]) => {
          if (op.startsWith('$')) {
            const comparator = this.comparators[op];
            if (!comparator) throw new Error(`Unsupported operator: ${op}`);
            return comparator(finalValue, val);
          }
          return this.comparators.$eq(finalValue[op], val);
        });
      }
      
      return this.comparators.$eq(finalValue, condition);
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
