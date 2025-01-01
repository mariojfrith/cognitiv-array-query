const PathUtils = require('../utils/pathUtils');
const { BasicUtils } = require('../utils');

class ElementMatchOperator {
  constructor(comparators) {
    this.comparators = comparators;
  }

  evaluate(row, condition, field, getter) {
    // Handle direct array matching
    if (Array.isArray(row)) {
      return this._evaluateArrayElements(row, condition);
    }

    // Handle field path
    if (field) {
      const value = getter ? getter(row, field) : PathUtils.get(row, field);
      
      // Handle nested arrays
      if (Array.isArray(value)) {
        return this._evaluateArrayElements(value, condition);
      }
      
      // Handle dot notation
      if (field.includes('.')) {
        const [arrayField, ...subFields] = field.split('.');
        const arrayValue = getter ? getter(row, arrayField) : PathUtils.get(row, arrayField);
        
        if (Array.isArray(arrayValue)) {
          return arrayValue.some(element => {
            const subValue = subFields.length ? PathUtils.get(element, subFields.join('.')) : element;
            return this._evaluateElement(subValue, condition);
          });
        }
      }
    }

    // Handle object with nested arrays
    const array = this._getArrayToEvaluate(row, field, getter);
    
    if (!Array.isArray(array)) {
      return this._handleNonArrayInput(array, condition, getter);
    }

    if (typeof condition !== 'object' || condition === null) {
      return array.some(element => element === condition);
    }

    // Handle different condition types in order
    return (
      this._handleDotNotation(array, condition, getter) ||
      this._handleArrayOperations(array, condition, getter) ||
      this._handleNestedConditions(array, condition, getter) ||
      this._evaluateArrayElements(array, condition)
    );
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
        return Array.isArray(subValue) 
          ? subValue.some(item => this._evaluateElement(item, subCondition.$eleMatch))
          : this._evaluateElement(subValue, subCondition.$eleMatch);
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
      if (Array.isArray(value) && this._isEleMatchCondition(subCondition)) {
        return value.some(v => this._evaluateElement(v, subCondition.$eleMatch));
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
        const comparator = this.comparators[key];
        if (!comparator) throw new Error(`Unsupported operator: ${key}`);
        return comparator(element, value);
      }

      const fieldValue = PathUtils.get(element, key);

      if (Array.isArray(fieldValue) && typeof value === 'object' && value !== null) {
        if (value.$eleMatch) {
          return fieldValue.some(item => this._evaluateElement(item, value.$eleMatch));
        }
        if (value.$containsAll) {
          return this.comparators.$containsAll(fieldValue, value.$containsAll);
        }
        return fieldValue.some(item => this._evaluateElement(item, value));
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