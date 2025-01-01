const CognitivArrayQuery = require('../CognitivArrayQuery');

describe('CognitivArrayQuery', () => {
  let query;
  let testData;

  beforeEach(() => {
    query = new CognitivArrayQuery();
    testData = [
      {
        name: 'John',
        age: 30,
        role: 'developer',
        tags: ['developer', 'manager'],
        items: [
          {
            card_number: '1234',
            tags: ['credit', 'active']
          },
          {
            card_number: '0000',
            tags: ['debit', 'expired'] 
          },
        ],
        joined: '2023-01-15',
        nested: { level: 1, value: 'test' },
      },
      {
        name: 'Jane',
        age: 25,
        role: 'designer',
        tags: ['designer'],
        items: [
          {
            card_number: '5678',
            tags: ['credit', 'active']
          },
          {
            card_number: '9999',
            tags: ['debit', 'active']
          },
        ],
        joined: '2023-02-20',
        nested: { level: 2, value: 'demo' },
      },
      {
        name: 'Bob',
        age: 35,
        role: 'developer',
        tags: ['developer', 'architect'],
        items: [],
        joined: '2023-03-10',
        nested: { level: 1, value: 'prod' },
      },
    ];
  });

  describe('Basic Field Queries', () => {
    test('should match exact string value', () => {
      const result = query.query(testData, { name: 'John' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should match numeric comparison with $gt', () => {
      const result = query.query(testData, { age: { $gt: 30 } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });
  });

  describe('Array Field Queries', () => {
    test('should match array containing value', () => {
      const result = query.query(testData, {
        tags: { $contains: 'developer' },
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should match array containing all values', () => {
      const result = query.query(testData, {
        tags: { $containsAll: ['developer', 'manager'] },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should match array size', () => {
      const result = query.query(testData, {
        tags: { $size: 2 },
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'John']);
    });
  });

  describe('Logical Operators', () => {
    test('should combine conditions with $and', () => {
      const result = query.query(testData, {
        $and: [{ age: { $gte: 30 } }, { tags: { $contains: 'developer' } }],
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should combine conditions with $or', () => {
      const result = query.query(testData, {
        $or: [{ name: 'Jane' }, { age: { $gt: 30 } }],
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'Jane']);
    });

    test('should negate condition with $not', () => {
      const result = query.query(testData, {
        $not: { name: 'John' },
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'Jane']);
    });

    test('should handle complex nested logical operators', () => {
      const result = query.query(testData, {
        $and: [
          { $or: [{ name: 'John' }, { name: 'Bob' }] },
          { $not: { tags: { $contains: 'manager' } } },
        ],
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });
  });

  describe('Date Operations', () => {
    test('should match dates before specified date', () => {
      const result = query.query(testData, {
        joined: { $lte: '2023-02-01' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should match dates after specified date', () => {
      const result = query.query(testData, {
        joined: { $gte: '2023-02-01' },
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'Jane']);
    });
  });

  describe('Nested Object Queries', () => {
    test('should match on nested object fields using dot notation', () => {
      const result = query.query(testData, {
        'nested.level': 1,
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should match nested field with regex', () => {
      const result = query.query(testData, {
        'nested.value': { $regex: '^te' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });
  });

  describe('Callback Operator ($cb)', () => {
    test('should filter using custom callback function', () => {
      const callback = (row, key, comparators, Utils) => {
        const age = Utils.get(row, 'age');
        const role = Utils.get(row, 'role');
        return age > 30 && role === 'developer';
      };

      const result = query.query(testData, {
        role: { $cb: callback },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    test('should throw error for invalid callback', () => {
      expect(() => {
        query.query(testData, {
          name: { $cb: 'notAFunction' },
        });
      }).toThrow();
    });
  });

  describe('Element Match Operator ($eleMatch)', () => {
    test('should match array elements meeting criteria', () => {
      const result = query.query(testData, {
        $eleMatch: {
          'items.card_number': { $eq: '5678' },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
    });

    test('should handle $eleMatch with logical operators', () => {
      const result = query.query(testData, {
        $and: [
          { tags: { $eleMatch: { $eq: 'developer' } } },
          { age: { $gte: 30 } },
        ],
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should match array elements meeting $and criteria', () => {
      const result = query.query(testData, {
        $and: [
          { tags: { $eleMatch: { $eq: 'developer' } } },
          { age: { $gte: 29 } },
        ],
      });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should match items with credit and active tags', () => {
      const result = query.query(testData, {
        items: {
          $eleMatch: {
            tags: { $containsAll: ['credit', 'active'] }
          }
        }
      });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Jane', 'John']);
    });

    test('should match items with debit and expired tags', () => {
      const result = query.query(testData, {
        items: {
          $eleMatch: {
            tags: { $containsAll: ['debit', 'expired'] }
          }
        }
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid array operations gracefully', () => {
      const result = query.query(testData, {
        name: { $containsAll: ['John'] },
      });
      expect(result).toHaveLength(0);
    });

    test('should throw error for unsupported operators', () => {
      expect(() => {
        query.query(testData, {
          age: { $invalidOperator: 30 },
        });
      }).toThrow();
    });
  });
});
