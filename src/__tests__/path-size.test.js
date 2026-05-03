const CognitivArrayQuery = require('../CognitivArrayQuery');

describe('CognitivArrayQuery - Path Size', () => {
  let query;

  beforeEach(() => {
    query = new CognitivArrayQuery();
  });

  test('should match array size with dot notation', () => {
    const data = [
      { extensions: { items: [1, 2] } },
      { extensions: { items: [] } },
      { extensions: {} },
      {}
    ];

    const condition = {
      "$and": [
        {
          "extensions.items": {
            "$size": { "$gte": 1 }
          }
        }
      ]
    };

    const result = query.query(data, condition);
    expect(result).toHaveLength(1);
    expect(result[0].extensions.items).toEqual([1, 2]);
  });
});
