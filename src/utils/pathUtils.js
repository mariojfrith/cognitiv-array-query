class PathUtils {
  static get(obj, path) {
    if (obj === null || obj === undefined || !path) {
      return undefined;
    }

    // Handle array indexing and dot notation
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');

    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array index access
      if (/^\d+$/.test(part) && Array.isArray(current)) {
        current = current[parseInt(part, 10)];
        continue;
      }
      
      // Handle nested array of objects with dot notation
      if (Array.isArray(current)) {
        const results = current.map(item => this.get(item, part));
        if (results.every(r => r === undefined)) {
          return undefined;
        }
        current = results.flat();
        continue;
      }
      
      current = current[part];
    }
    
    return current;
  }

  static getArrayValue(array, field) {
    if (!Array.isArray(array)) {
      return undefined;
    }
    
    const results = array.map(item => this.get(item, field)).filter(Boolean);
    return results.length ? results : undefined;
  }

  static set(obj, path, value) {
    if (!obj || !path) return false;
    
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return true;
  }
}

module.exports = PathUtils;