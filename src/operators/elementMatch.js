const PathUtils = require('../utils/pathUtils');
const { BasicUtils } = require('../utils');

class ElementMatchOperator {
  constructor(comparators) {
    this.comparators = comparators;
  }

  evaluate(row, condition, field, getter) {
    const array = this._getArrayToEvaluate(row, field, getter);
    
    if (!Array.isArray(array)) {
      return this._handleNonArrayInput(array, condition, getter);
    }

    if (typeof condition !== 'object' || condition === null) {
      return array.some(element => element === condition);
    }

    // Handle size conditions first
    if (this._hasSizeCondition(condition)) {
      return this._evaluateSizeCondition(array, condition);
    }

    // Handle logical operators next
    if (this._hasLogicalOperator(condition)) {
      return this._evaluateLogicalOperator(array, condition, getter);
    }

    // Handle different condition types in order
    return (
      this._handleDotNotation(array, condition, getter) ||
      this._handleArrayOperations(array, condition, getter) ||
      this._handleNestedConditions(array, condition, getter) ||
      this._evaluateArrayElements(array, condition)
    );
  }

  _hasSizeCondition(condition) {
    if (!condition || typeof condition !== 'object') return false;
    
    return condition.$size !== undefined || 
           Object.entries(condition).some(([key, value]) => {
             if (!key.includes('.')) return false;
             if (!value || typeof value !== 'object') return false;
             return value.$size !== undefined || 
                    Object.entries(value).some(([k, v]) => 
                      k.includes('.') && v && typeof v === 'object' && v.$size !== undefined
                    );
           });
  }

  _evaluateSizeCondition(array, condition) {
    if (condition.$size !== undefined) {
      return this.comparators.$size(array, condition.$size);
    }

    return array.some(element => {
      return Object.entries(condition).every(([key, value]) => {
        if (key.includes('.')) {
          const fieldValue = PathUtils.get(element, key);
          if (value && typeof value === 'object') {
            if (value.$size !== undefined) {
              return Array.isArray(fieldValue) && this.comparators.$size(fieldValue, value.$size);
            }
            if (Object.keys(value).some(k => k.includes('.'))) {
              return Object.entries(value).every(([k, v]) => {
                if (k.includes('.')) {
                  const nestedValue = PathUtils.get(fieldValue, k);
                  if (v && typeof v === 'object' && v.$size !== undefined) {
                    return Array.isArray(nestedValue) && this.comparators.$size(nestedValue, v.$size);
                  }
                }
                return this._evaluateElement(fieldValue, { [k]: v });
              });
            }
          }
        }
        return this._evaluateElement(element, { [key]: value });
      });
    });
  }

  _hasLogicalOperator(condition) {
    return Object.keys(condition).some(key => ['$and', '$or', '$not', '$nor'].includes(key));
  }

  _evaluateLogicalOperator(array, condition, getter) {
    const [operator, value] = Object.entries(condition)[0];
    
    switch (operator) {
      case '$and':
        return array.some(element => 
          Array.isArray(value) ? 
            value.every(cond => this._evaluateElement(element, cond)) :
            Object.entries(value).every(([k, v]) => this._evaluateElement(element, { [k]: v }))
        );
      case '$or':
        return array.some(element => 
          Array.isArray(value) ? 
            value.some(cond => this._evaluateElement(element, cond)) :
            Object.entries(value).some(([k, v]) => this._evaluateElement(element, { [k]: v }))
        );
      case '$not':
        return array.some(element => !this._evaluateElement(element, value));
      case '$nor':
        return array.some(element => 
          !Array.isArray(value) ? 
            !this._evaluateElement(element, value) :
            !value.some(cond => this._evaluateElement(element, cond))
        );
      default:
        return false;
    }
  }

  _getArrayToEvaluate(row, field, getter) {
    if (!field) return row;
    return getter ? getter(row, field) : PathUtils.get(row, field);
  }

  _handleNonArrayInput(value, condition, getter) {
    if (typeof condition !== 'object' || condition === null) {
      return false;
    }

    const dotNotationKey = Object.keys(condition).find(key => key.includes('.'));
    if (!dotNotationKey) return false;

    const [arrayField, ...subFields] = dotNotationKey.split('.');
    const arrayValue = PathUtils.get(value, arrayField);

    if (!Array.isArray(arrayValue)) return false;

    return arrayValue.some(element => {
      const subValue = subFields.length ? PathUtils.get(element, subFields.join('.')) : element;
      const subCondition = condition[dotNotationKey];

      if (this._isEleMatchCondition(subCondition)) {
        return Array.isArray(subValue) ? 
          subValue.some(item => this._evaluateElement(item, subCondition.$eleMatch)) :
          this._evaluateElement(subValue, subCondition.$eleMatch);
      }

      return this._evaluateElement(
        { [subFields.join('.')]: subValue },
        { [subFields.join('.')]: subCondition }
      );
    });
  }

  _handleDotNotation(array, condition, getter) {
    const dotNotationKey = Object.keys(condition).find(key => key.includes('.'));
    if (!dotNotationKey) return false;

    return array.some(element => {
      if (!element || typeof element !== 'object') return false;

      const [firstField, ...restFields] = dotNotationKey.split('.');
      const fieldValue = PathUtils.get(element, firstField);
      const subCondition = condition[dotNotationKey];
      const restPath = restFields.join('.');

      if (Array.isArray(fieldValue)) {
        return this._handleNestedArrayField(fieldValue, restPath, subCondition);
      }

      const value = PathUtils.get(element, dotNotationKey);
      if (Array.isArray(value)) {
        if (this._isEleMatchCondition(subCondition)) {
          return value.some(v => this._evaluateElement(v, subCondition.$eleMatch));
        }
        if (subCondition && typeof subCondition === 'object' && subCondition.$size) {
          return this.comparators.$size(value, subCondition.$size);
        }
      }

      return this._evaluateElement(
        { [dotNotationKey]: value },
        { [dotNotationKey]: subCondition }
      );
    });
  }

  _handleNestedArrayField(array, path, condition) {
    if (this._isEleMatchCondition(condition)) {
      return array.some(item => {
        const itemValue = path ? PathUtils.get(item, path) : item;
        return this._evaluateElement(itemValue, condition.$eleMatch);
      });
    }

    if (condition && typeof condition === 'object' && condition.$size) {
      return this.comparators.$size(array, condition.$size);
    }

    return array.some(item => {
      const itemValue = path ? PathUtils.get(item, path) : item;
      return this._evaluateElement(
        { [path]: itemValue },
        { [path]: condition }
      );
    });
  }

  _handleArrayOperations(array, condition, getter) {
    for (const [key, value] of Object.entries(condition)) {
      if (this._isEleMatchCondition(value)) {
        return array.some(element => {
          const elementArray = PathUtils.get(element, key);
          if (!Array.isArray(elementArray)) return false;
          return elementArray.some(item => this._evaluateElement(item, value.$eleMatch));
        });
      }
    }

    if (Object.keys(condition).length === 1) {
      const [key, value] = Object.entries(condition)[0];
      if (typeof value === 'object' && value !== null && !key.startsWith('$')) {
        return array.some(element => {
          const elementValue = PathUtils.get(element, key);
          if (Array.isArray(elementValue)) {
            if (value.$containsAll) {
              return this.comparators.$containsAll(elementValue, value.$containsAll);
            }
            if (value.$size) {
              return this.comparators.$size(elementValue, value.$size);
            }
            return elementValue.some(item => this._evaluateElement(item, value));
          }
          return this._evaluateElement(elementValue, value);
        });
      }
    }

    return false;
  }

  _handleNestedConditions(array, condition, getter) {
    const hasNestedCondition = Object.entries(condition).some(([key, value]) => {
      const fieldValue = array.length > 0 ? PathUtils.get(array[0], key) : undefined;
      return Array.isArray(fieldValue) || (typeof value === 'object' && value !== null);
    });

    if (!hasNestedCondition) return false;

    return array.some(element => {
      return Object.entries(condition).every(([key, value]) => {
        const fieldValue = PathUtils.get(element, key);
        return this._evaluateFieldValue(fieldValue, value);
      });
    });
  }

  _evaluateFieldValue(fieldValue, value) {
    if (Array.isArray(fieldValue)) {
      if (typeof value === 'object' && value !== null) {
        if (value.$containsAll) {
          return this.comparators.$containsAll(fieldValue, value.$containsAll);
        }
        if (value.$size) {
          return this.comparators.$size(fieldValue, value.$size);
        }
        return fieldValue.some(item => this._evaluateElement(item, value));
      }
      return fieldValue.includes(value);
    }

    if (typeof value === 'object' && value !== null) {
      return this._evaluateElement(fieldValue, value);
    }

    return this._evaluateElement(fieldValue, value);
  }

  _evaluateArrayElements(array, condition) {
    return array.some(element => this._evaluateElement(element, condition));
  }

  _isEleMatchCondition(value) {
    return value && typeof value === 'object' && value.$eleMatch;
  }

  _evaluateElement(element, condition) {
    if (!element || !condition) return false;

    return Object.entries(condition).every(([key, value]) => {
      if (key.startsWith('$')) {
        if (['$and', '$or', '$not', '$nor'].includes(key)) {
          return this._evaluateLogicalOperator([element], { [key]: value });
        }
        const comparator = this.comparators[key];
        if (!comparator) throw new Error(`Unsupported operator: ${key}`);
        return comparator(element, value);
      }

      const fieldValue = PathUtils.get(element, key);

      if (Array.isArray(fieldValue)) {
        if (typeof value === 'object' && value !== null) {
          if (value.$eleMatch) {
            return fieldValue.some(item => this._evaluateElement(item, value.$eleMatch));
          }
          if (value.$containsAll) {
            return this.comparators.$containsAll(fieldValue, value.$containsAll);
          }
          if (value.$size !== undefined) {
            return this.comparators.$size(fieldValue, value.$size);
          }
          if (Object.keys(value).some(k => k.includes('.'))) {
            return fieldValue.some(item => 
              Object.entries(value).every(([k, v]) => {
                if (k.includes('.')) {
                  const nestedValue = PathUtils.get(item, k);
                  if (v && typeof v === 'object' && v.$size !== undefined) {
                    return Array.isArray(nestedValue) && this.comparators.$size(nestedValue, v.$size);
                  }
                }
                return this._evaluateElement(item, { [k]: v });
              })
            );
          }
          return fieldValue.some(item => this._evaluateElement(item, value));
        }
        return fieldValue.includes(value);
      }

      if (typeof value === 'object' && value !== null) {
        if (value.$eleMatch) {
          const arrayValue = Array.isArray(fieldValue) ? fieldValue : [fieldValue].filter(Boolean);
          return arrayValue.some(item => this._evaluateElement(item, value.$eleMatch));
        }
        return Object.entries(value).every(([op, val]) => {
          if (op.startsWith('$')) {
            const comparator = this.comparators[op];
            if (!comparator) throw new Error(`Unsupported operator: ${op}`);
            return comparator(fieldValue, val);
          }
          return fieldValue && fieldValue[op] === val;
        });
      }

      return this.comparators.$eq(fieldValue, value);
    });
  }
}

module.exports = ElementMatchOperator;