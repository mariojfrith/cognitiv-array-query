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
            tags: ['credit', 'active'],
            transactions: [
              { amount: 100, ids: ['1', '2'], type: 'purchase', date: '2023-01-01' },
              { amount: 50, ids: ['3'], type: 'refund', date: '2023-01-15' }
            ]
          },
          {
            card_number: '0000',
            tags: ['debit', 'expired'],
            transactions: [
              { amount: 200, type: 'withdrawal', date: '2023-02-01' }
            ],
            payments: [
              { amount: 100, type: 'purchase', date: '2023-01-01' },
              { amount: 100, type: 'purchase', date: '2023-01-01' }
            ]
          }
        ],
        joined: '2023-01-15',
        nested: {
          level: 1,
          value: 'test',
          metadata: {
            created: '2023-01-01',
            status: { isActive: true }
          }
        },
        scores: [[85, 90], [75, 80]]
      },
      {
        name: 'Jane', 
        age: 25,
        role: 'designer',
        tags: ['designer'],
        items: [
          {
            card_number: '5678',
            tags: ['credit', 'active'],
            transactions: [
              { amount: 300, type: 'purchase', date: '2023-03-01' }
            ]
          },
          {
            card_number: '9999',
            tags: ['debit', 'active'],
            transactions: []
          }
        ],
        joined: '2023-02-20',
        nested: {
          level: 2,
          value: 'demo', 
          metadata: {
            created: '2023-02-01',
            status: { isActive: false }
          }
        },
        scores: [[95, 92], [88, 85]]
      },
      {
        name: 'Bob',
        age: 35,
        role: 'developer',
        tags: ['developer', 'architect'],
        items: [],
        joined: '2023-03-10',
        nested: {
          level: 1,
          value: 'prod',
          metadata: {
            created: '2023-03-01', 
            status: { isActive: true }
          }
        },
        scores: [[70, 75], [80, 85]]
      }
    ];
  });

  describe('Simple Queries', () => {
    test('should match simple string equality', () => {
      const result = query.query(testData, { role: 'designer' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
    });

    test('should match simple numeric equality', () => {
      const result = query.query(testData, { age: 35 });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    test('should match simple array contains', () => {
      const result = query.query(testData, { tags: { $contains: 'developer' } });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Bob', 'John']);
    });

    test('should match nested card number', () => {
      const result = query.query(testData, { $and: [{ 'items.card_number': { $eq: '5678' } }, { 'items.tags': { $contains: 'credit' } }] });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
    });

    test('should match nested card number with array', () => {
      const result = query.query(testData, { $or: [{ $and: [{ 'items.card_number': { $in: ['5678'] } }, { 'items.tags': { $contains: 'credit' } }] }, { $and: [{ 'items.card_number': { $in: ['1234'] } }, { 'items.tags': { $contains: 'credit' } }] }] });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Jane', 'John']);
    });

    test('should match nested payments array', () => {
      const result = query.query(testData, {
        'items.payments': {
          $eleMatch: {
            amount: 100,
            type: 'purchase',
            date: '2023-01-01'
          }
        }
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should match nested payments array with ids', () => {
      const result = query.query(testData, {
        $and: [
          { 'items.transactions': {
            $eleMatch: {
              ids: { $in: ['1'] }
            }
          }}
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should match nested payments array with dot notation', () => {
      const result = query.query(testData, {
        $and: [
          { 'items.transactions.ids': { $in: ['1'] } }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

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

  describe('Complex Array Field Queries', () => {
    test('should match nested array elements with multiple conditions', () => {
      const result = query.query(testData, {
        items: {
          $eleMatch: {
            card_number: '5678',
            tags: { $containsAll: ['credit', 'active'] },
            transactions: {
              $eleMatch: {
                amount: { $gt: 200 },
                type: 'purchase'
              }
            }
          }
        }
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
    });

    test('should match multi-dimensional array elements', () => {
      const result = query.query(testData, {
        scores: {
          $eleMatch: {
            $eleMatch: { $gte: 90 }
          }
        }
      });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Jane', 'John']);
    });

    test('should handle complex array size conditions', () => {
      const result = query.query(testData, {
        $and: [
          { 'items.transactions': { $size: { $gt: 1 } } },
          { tags: { $size: { $gte: 2 } } }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });
  });

  describe('Advanced Logical Operators', () => {
    test('should handle deeply nested logical conditions', () => {
      const result = query.query(testData, {
        $and: [
          {
            $or: [
              { 'nested.metadata.status.isActive': true },
              { age: { $gt: 32 } }
            ]
          },
          {
            $not: {
              $and: [
                { role: 'designer' },
                { tags: { $size: { $lt: 2 } } }
              ]
            }
          },
          {
            items: {
              $eleMatch: {
                $or: [
                  { 
                    card_number: { $regex: '^12' },
                    transactions: { 
                      $eleMatch: { amount: { $gt: 150 } } 
                    }
                  },
                  { tags: { $containsAll: ['credit', 'active'] } }
                ]
              }
            }
          }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should combine multiple array and nested object conditions', () => {
      const result = query.query(testData, {
        $or: [
          {
            $and: [
              { 'nested.level': 1 },
              { 'nested.metadata.status.isActive': true },
              { 
                items: { 
                  $eleMatch: { 
                    card_number: '1234',
                    transactions: { 
                      $eleMatch: { 
                        $and: [
                          { type: 'purchase' },
                          { amount: { $lt: 150 } }
                        ]
                      }
                    }
                  }
                }
              }
            ]
          },
          {
            $and: [
              { age: { $lt: 30 } },
              { 'nested.metadata.created': { $gt: '2023-01-15' } },
              { scores: { $eleMatch: { $eleMatch: { $gt: 90 } } } }
            ]
          }
        ]
      });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Jane', 'John']);
    });
  });

  describe('Date Operations', () => {
    test('should match complex date conditions across nested structures', () => {
      const result = query.query(testData, {
        $and: [
          { joined: { $gte: '2023-01-01' } },
          { 
            items: { 
              $eleMatch: { 
                card_number: { $regex: '^0' },
                transactions: { 
                  $eleMatch: { 
                    date: { $lt: '2023-02-01' } 
                  }
                }
              }
            }
          },
          { 'nested.metadata.created': { $lte: '2023-02-01' } }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });
  });

  describe('Nested Object Queries', () => {
    test('should handle complex nested object conditions', () => {
      const result = query.query(testData, {
        $and: [
          { 'nested.level': { $lte: 2 } },
          { 'nested.metadata.status.isActive': true },
          { 
            $or: [
              { 'nested.value': { $regex: '^te' } },
              { 'nested.value': { $regex: '^pr' } }
            ]
          }
        ]
      });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Bob', 'John']);
    });
  });

  describe('Callback Operator ($cb)', () => {
    test('should handle complex callback with nested data', () => {
      const callback = (row, key, comparators, Utils) => {
        const hasHighScore = row.scores.some(subArray => 
          subArray.some(score => score > 90)
        );
        const hasActiveCards = row.items.some(item => 
          item.card_number.startsWith('56') && 
          item.tags.includes('active') && 
          item.transactions.some(t => t.amount > 250)
        );
        return hasHighScore && hasActiveCards;
      };

      const result = query.query(testData, {
        $cb: callback
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
    });
  });

  describe('Element Match Operator ($eleMatch)', () => {
    test('should match deeply nested array elements with multiple conditions', () => {
      const result = query.query(testData, {
        items: {
          $eleMatch: {
            card_number: '1234',
            tags: { $contains: 'credit' },
            transactions: {
              $eleMatch: {
                $and: [
                  { type: 'purchase' },
                  { amount: { $gt: 50 } },
                  { date: { $lt: '2023-02-01' } }
                ]
              }
            }
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

    test('should handle deeply nested invalid operations', () => {
      expect(() => {
        query.query(testData, {
          $and: [
            { 
              items: { 
                $eleMatch: { 
                  card_number: '1234',
                  transactions: { 
                    $eleMatch: { 
                      amount: { $invalidOp: 100 } 
                    }
                  }
                }
              }
            }
          ]
        });
      }).toThrow();
    });
  });
});
