# Cognitiv Array Query

A powerful JavaScript library for performing MongoDB-style queries on arrays of objects, with enhanced features for offline data filtering. Perfect for working with MongoDB collections locally while maintaining familiar query syntax.

## Features

- MongoDB-compatible query syntax with additional enhancements
- Complex nested object and array querying
- Rich set of comparison operators
- Support for logical operators ($and, $or, $not)
- Array operations (contains, size, element matching)
- Regular expression support
- Date comparison operations
- Custom callback queries
- Deep object traversal with dot notation
- Robust error handling
- Ideal for offline MongoDB collection filtering

## Installation

```bash
npm install cognitiv-array-query
```

## Usage

```javascript
const CognitivArrayQuery = require('cognitiv-array-query');
const query = new CognitivArrayQuery();

// Your data array
const data = [
  {
    name: 'John',
    age: 30,
    tags: ['developer', 'manager'],
    items: [
      {
        card_number: '1234',
        transactions: [
          { amount: 100, type: 'purchase' }
        ]
      }
    ]
  }
  // ... more data
];

// Simple query
const result = query.query(data, { role: 'developer' });

// Complex nested query
const result = query.query(data, {
  $and: [
    { age: { $gt: 25 } },
    { 'items.transactions': {
      $eleMatch: {
        amount: { $gt: 50 },
        type: 'purchase'
      }
    }}
  ]
});
```

## Query Operators

### Comparison Operators

- `$eq`: Equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal to
- `$lt`: Less than
- `$lte`: Less than or equal to
- `$in`: Value exists in array
- `$regex`: Regular expression match

### Logical Operators

- `$and`: Logical AND
- `$or`: Logical OR
- `$not`: Logical NOT

### Array Operators

- `$contains`: Array contains value
- `$containsAll`: Array contains all values
- `$size`: Array size comparison
- `$eleMatch`: Match array elements

### Custom Operators

- `$cb`: Custom callback function for complex conditions

## Examples

### Simple Field Query
```javascript
query.query(data, { name: 'John' });
```

### Numeric Comparison
```javascript
query.query(data, { age: { $gt: 30 } });
```

### Array Contains
```javascript
query.query(data, { tags: { $contains: 'developer' } });
```

### Nested Object Query
```javascript
query.query(data, {
  'nested.metadata.status.isActive': true
});
```

### Complex Array Element Match
```javascript
query.query(data, {
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
```

### Custom Callback
```javascript
query.query(data, {
  $cb: (row, key, comparators, Utils) => {
    return row.scores.some(subArray => 
      subArray.some(score => score > 90)
    );
  }
});
```

## Error Handling

The library includes robust error handling for:
- Invalid operators
- Malformed queries
- Type mismatches
- Unsupported operations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2024 Mario Frith

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Author

Mario Frith
- Cognitiv Traits
- https://cognitivtriats.us
- https://github.com/cognitivtraits