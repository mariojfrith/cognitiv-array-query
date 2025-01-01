const DateUtils = require('./dateUtils');
const ArrayUtils = require('./arrayUtils');
const ObjectUtils = require('./objectUtils');

const BasicUtils = {
  isNA: (val) => val === '' || val === undefined || val === null,
  notNA: (val) => !this.Utils.isNA(val),
  get: (row, key, getter) => {
    if (typeof key === 'number') return key;
    if (getter) return getter(row, key);
    return key.split('.').reduce((obj, path) => obj && obj[path], row);
  },
  deepEqual: (a, b) => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (key) => keysB.includes(key) && this.Utils.deepEqual(a[key], b[key])
    );
  },
  getType: (val) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') return 'object';
    return typeof val; // handles string, number, etc
  },
  isDateLike: (val) => this.dateUtils.isDateLike(val),
  toMoment: (val) => this.dateUtils.toMoment(val),
  isObject: (val) =>
    val !== null && typeof val === 'object' && !Array.isArray(val),
  flatten: ObjectUtils.flatten,
  intersection: ArrayUtils.intersection,
  difference: ArrayUtils.difference,
  isArray: ArrayUtils.isArray,
};

export { DateUtils, ArrayUtils, ObjectUtils, BasicUtils };