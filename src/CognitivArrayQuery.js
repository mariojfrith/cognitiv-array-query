const comparators = require('./comparators');
const { DateUtils, BasicUtils } = require('./utils');
const PathUtils = require('./utils/pathUtils');

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
    return condition && typeof condition === 'object' && (condition.$elemMatch || condition.$eleMatch || condition.$cb);
  }

  _evaluateSpecialOperator(row, field, condition, getter) {
    if (condition.$elemMatch) {
      return this.comparators.$elemMatch(row, condition.$elemMatch, field, getter);
    }
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

    const elemMatchCond = condition.$elemMatch || condition.$eleMatch;
    if (elemMatchCond) {
      return value.some(item => {
        if (path.includes('.')) {
          const [first] = path.split('.');
          const nextValue = PathUtils.get(item, first);
          if (Array.isArray(nextValue)) {
            return nextValue.some(element => {
              return Object.entries(elemMatchCond).every(([key, val]) => {
                const fieldValue = PathUtils.get(element, key);
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
          const targetValue = PathUtils.get(item, path);
          if (Array.isArray(targetValue)) {
            return targetValue.some(element => {
              return Object.entries(elemMatchCond).every(([key, val]) => {
                const fieldValue = PathUtils.get(element, key);
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
        const fieldValue = PathUtils.get(item, path);
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(element => {
            return Object.entries(elemMatchCond).every(([key, val]) => {
              const elemValue = PathUtils.get(element, key);
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
        return this._evaluateElement(fieldValue, elemMatchCond);
      });
    }

    return value.some(item => {
      if (path.includes('.')) {
        const [first, ...rest] = path.split('.');
        const nextValue = PathUtils.get(item, first);
        if (Array.isArray(nextValue)) {
          return this._evaluateArrayPath(nextValue, rest.join('.'), condition);
        }
        return this._evaluateCondition(item, path, condition);
      }

      const fieldValue = PathUtils.get(item, path);
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
      const fieldValue = PathUtils.get(value, key);
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
      const rootValue = getter ? getter(row, root) : PathUtils.get(row, root);
      
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
          const value = PathUtils.get(row, path);
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

      const value = getter ? getter(row, key) : PathUtils.get(row, key);
      return this._evaluateElement(value, condition);
    });
  }

  _evaluateCondition(row, field, condition, getter) {
    // Handle primitive values
    if (!condition || typeof condition !== 'object') {
      const value = getter ? getter(row, field) : PathUtils.get(row, field);
      return this.comparators.$eq(value, condition);
    }

    // Handle special operators ($eleMatch, $cb)
    if (this._hasSpecialOperator(condition)) {
      return this._evaluateSpecialOperator(row, field, condition, getter);
    }

    // Resolve the value using PathUtils for robust dot-notation support (including arrays)
    const value = getter ? getter(row, field) : PathUtils.get(row, field);

    // If the condition contains operators (keys starting with $), evaluate each
    const operators = Object.keys(condition).filter(k => k.startsWith('$'));
    if (operators.length > 0) {
      return operators.every(op => {
        const comparator = this.comparators[op];
        if (!comparator) throw new Error(`Unsupported operator: ${op}`);
        
        // Special case for $size to ensure it works on arrays even if nested operators follow
        if (op === '$size') {
          return Array.isArray(value) && this.comparators.$size(value, condition.$size);
        }
        
        return comparator(value, condition[op], field, getter);
      });
    }

    // If no operators, it's a nested object condition
    if (typeof value === 'object' && value !== null) {
      return Object.entries(condition).every(([key, subCondition]) => {
        const subValue = PathUtils.get(value, key);
        return this._evaluateElement(subValue, subCondition);
      });
    }

    return this.comparators.$eq(value, condition);
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
