const CognitivArrayQuery = require('../../dist/CognitivArrayQuery.min');

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
              { amount: 100, ext_id: '1', ids: ['1', '2'], type: 'purchase', date: '2023-01-01' },
              { amount: 50, ext_id: '2', ids: ['3'], type: 'refund', date: '2023-01-15' }
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
      expect(result[0].role).toBe('designer');
    });

    test('should match simple numeric equality', () => {
      const result = query.query(testData, { age: 35 });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
      expect(result[0].age).toBe(35);
    });

    test('should match simple array contains', () => {
      const result = query.query(testData, { tags: { $contains: 'developer' } });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Bob', 'John']);
      expect(result.every(r => r.tags.includes('developer'))).toBe(true);
    });

    test('should match nested card number', () => {
      const result = query.query(testData, { $and: [{ 'items.card_number': { $eq: '5678' } }, { 'items.tags': { $contains: 'credit' } }] });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane');
      expect(result[0].items.some(i => i.card_number === '5678' && i.tags.includes('credit'))).toBe(true);
    });

    test('should match nested card number with array', () => {
      const result = query.query(testData, { $or: [{ $and: [{ 'items.card_number': { $in: ['5678'] } }, { 'items.tags': { $contains: 'credit' } }] }, { $and: [{ 'items.card_number': { $in: ['1234'] } }, { 'items.tags': { $contains: 'credit' } }] }] });
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name).sort()).toEqual(['Jane', 'John']);
      expect(result.every(r => r.items.some(i => ['5678', '1234'].includes(i.card_number) && i.tags.includes('credit')))).toBe(true);
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
      expect(result[0].items.some(i => i.payments?.some(p => 
        p.amount === 100 && p.type === 'purchase' && p.date === '2023-01-01'
      ))).toBe(true);
    });

    test('should match nested payments and transactions array with $in', () => {
      const result = query.query(testData, {$or: [
        { $and: [
          {'items.transactions.ext_id': { $in: ['1'] }},
          { 'items.payments.amount': { $in: [100] } }
          ]},
        { $and: [
          { 'items.transactions.ext_id': { $in: ['2'] }},
          { 'items.payments.amount': { $in: [200] } }
          ]}
      ]});
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
      expect(result[0].items.some(i => i.payments?.some(p => 
        [100, 200].includes(p.amount)
      ))).toBe(true);
    });


    test('should match nested transactions array with ids', () => {
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
      expect(result[0].items.some(i => i.transactions.some(t => t.ids?.includes('1')))).toBe(true);
    });

    test('should match nested transactions array with dot notation', () => {
      const result = query.query(testData, {
        $and: [
          { 'items.transactions.ids': { $in: ['1'] } }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
      expect(result[0].items.some(i => i.transactions.some(t => t.ids?.includes('1')))).toBe(true);
    });

    test('should match nested transactions array with dot notation', () => {
      const result = query.query(testData, {$or: [
        { $and: [
          { 'items.transactions.ext_id': { $in: ['1'] } }
        ]},
        { $and: [
          { 'items.transactions.ext_id': { $in: ['2'] } }
        ]}
      ]});
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
      expect(result[0].items.some(i => i.transactions.some(t => t.ext_id === '1'))).toBe(true);
    });

  });

  describe('Basic Field Queries', () => {
    test('should match exact string value', () => {
      const result = query.query(testData, { name: 'John' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
      expect(result[0]).toMatchObject({ name: 'John' });
    });

    test('should match numeric comparison with $gt', () => {
      const result = query.query(testData, { age: { $gt: 30 } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
      expect(result[0].age).toBeGreaterThan(30);
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
      expect(result[0].items.some(i => 
        i.card_number === '5678' && 
        i.tags.includes('credit') && 
        i.tags.includes('active') &&
        i.transactions.some(t => t.amount > 200 && t.type === 'purchase')
      )).toBe(true);
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
      expect(result.every(r => r.scores.some(arr => arr.some(score => score >= 90)))).toBe(true);
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
      expect(result[0].items.some(i => i.transactions.length > 1)).toBe(true);
      expect(result[0].tags.length >= 2).toBe(true);
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
      const r = result[0];
      expect(
        (r.nested.metadata.status.isActive || r.age > 32) &&
        !(r.role === 'designer' && r.tags.length < 2) &&
        r.items.some(i => 
          (i.card_number.startsWith('12') && i.transactions.some(t => t.amount > 150)) ||
          (i.tags.includes('credit') && i.tags.includes('active'))
        )
      ).toBe(true);
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
      expect(result.every(r => 
        (r.nested.level === 1 && 
         r.nested.metadata.status.isActive && 
         r.items.some(i => 
           i.card_number === '1234' && 
           i.transactions.some(t => t.type === 'purchase' && t.amount < 150)
         )) ||
        (r.age < 30 && 
         r.nested.metadata.created > '2023-01-15' && 
         r.scores.some(arr => arr.some(score => score > 90)))
      )).toBe(true);
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
          { 'nested.metadata.created': { $lte: '2023-01-01' } }
        ]
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
      const r = result[0];
      expect(new Date(r.joined)).toBeInstanceOf(Date);
      expect(r.items.every(i => 
        i.transactions.every(t => new Date(t.date) instanceof Date)
      )).toBe(true);
      expect(new Date(r.nested.metadata.created)).toBeInstanceOf(Date);
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
      expect(result.every(r => 
        r.nested.level <= 2 &&
        r.nested.metadata.status.isActive &&
        (r.nested.value.startsWith('te') || r.nested.value.startsWith('pr'))
      )).toBe(true);
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
      const r = result[0];
      expect(
        r.scores.some(arr => arr.some(score => score > 90)) &&
        r.items.some(i => 
          i.card_number.startsWith('56') &&
          i.tags.includes('active') &&
          i.transactions.some(t => t.amount > 250)
        )
      ).toBe(true);
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
      expect(result[0].items.some(i => 
        i.card_number === '1234' &&
        i.tags.includes('credit') &&
        i.transactions.some(t => 
          t.type === 'purchase' &&
          t.amount > 50 &&
          t.date < '2023-02-01'
        )
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid array operations gracefully', () => {
      const result = query.query(testData, {
        name: { $containsAll: ['John'] },
      });
      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
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
