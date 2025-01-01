class ArrayUtils {
  static flatten(arr) {
    return arr.reduce((flat, item) => 
      flat.concat(Array.isArray(item) ? ArrayUtils.flatten(item) : item), []);
  }

  static flatten(obj, useBracketsForArrays = false) {
    /**
     * Internal function to flatten the object.
     * 
     * @param {Object} obj - The object to flatten.
     * @param {String} [parentKey] - The base key for the current object (used for recursion).
     * @param {Object} [result] - The resulting flat object (used for recursion).
     * @param {Boolean} useBracketsForArrays - Whether to use square brackets for array indices.
     * @returns {Object} - A flattened object with keys in dot notation.
     */
    function _flattenObject(obj, parentKey = '', result = {}, useBracketsForArrays = true) {
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newKey = parentKey ? `${parentKey}.${key}` : key;
          
          if (Array.isArray(obj[key])) {
            // Handle arrays: iterate over elements and include indices in keys
            obj[key].forEach((item, index) => {
              const arrayKey = useBracketsForArrays ? `${newKey}[${index}]` : `${newKey}.${index}`;
              _flattenObject(item, arrayKey, result, useBracketsForArrays);
            });
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively flatten the object if it's not an array
            _flattenObject(obj[key], newKey, result, useBracketsForArrays);
          } else {
            // Assign the value to the result object with dot notation key
            result[newKey] = obj[key];
          }
        }
      }
      return result;
    }

    return _flattenObject(obj, '', {}, useBracketsForArrays);
  }

  static intersection(arr1, arr2) {
    return arr1.filter(item => arr2.includes(item));
  }

  static difference(arr1, arr2) {
    return arr1.filter(item => !arr2.includes(item));
  }

  static isArray(val) {
    return Array.isArray(val);
  }
}

module.exports = ArrayUtils;