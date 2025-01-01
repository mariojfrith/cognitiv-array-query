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
        // All conditions under the same root must match for at least one array element
        const matches = rootValue.some(element => {
          return Object.entries(conditions).every(([path, condition]) => {
            const relativePath = path.substring(root.length + 1);
            const value = this.Utils.get(element, relativePath);
            
            if (condition && typeof condition === 'object') {
              if (condition.$size !== undefined && Array.isArray(value)) {
                return this.comparators.$size(value, condition.$size);
              }
              if (condition.$contains && Array.isArray(value)) {
                return this.comparators.$contains(value, condition.$contains);
              }
              // Handle other operators
              return Object.entries(condition).every(([op, val]) => {
                if (op.startsWith('$')) {
                  const comparator = this.comparators[op];
                  if (!comparator) throw new Error(`Unsupported operator: ${op}`);
                  return comparator(value, val);
                }
                return this._evaluateCondition(element, relativePath, condition, getter);
              });
            }
            
            return this.comparators.$eq(value, condition);
          });
        });
        
        if (!matches) return false;
      } else {
        // Handle non-array nested objects
        const matches = Object.entries(conditions).every(([path, condition]) => {
          const value = this.Utils.get(row, path);
          
          if (condition && typeof condition === 'object') {
            return Object.entries(condition).every(([op, val]) => {
              if (op.startsWith('$')) {
                const comparator = this.comparators[op];
                if (!comparator) throw new Error(`Unsupported operator: ${op}`);
                return comparator(value, val);
              }
              return this._evaluateCondition(row, path, condition, getter);
            });
          }
          
          return this.comparators.$eq(value, condition);
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

      // Handle array size conditions
      if (condition && typeof condition === 'object') {
        const value = getter ? getter(row, key) : this.Utils.get(row, key);
        if (Array.isArray(value) && condition.$size !== undefined) {
          return this.comparators.$size(value, condition.$size);
        }
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
          return currentValue.some(item => {
            const value = this.Utils.get(item, remainingPath);
            if (condition.$size !== undefined && Array.isArray(value)) {
              return this.comparators.$size(value, condition.$size);
            }
            return this._evaluateCondition(item, remainingPath, condition, getter);
          });
        }
      }
      
      // Get the final value
      const finalValue = this.Utils.get(currentValue, parts[parts.length - 1]);
      
      // Handle operators
      if (condition && typeof condition === 'object') {
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
