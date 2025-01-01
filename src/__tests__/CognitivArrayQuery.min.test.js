// src/__tests__/CognitivArrayQuery.min.test.js

// Mock window object for jsdom
global.window = global.window || {};
window.CognitivArrayQuery = require('../../dist/CognitivArrayQuery.min');

describe('CognitivArrayQuery minified file', () => {
  test('CognitivArrayQuery is available on window', () => {
    expect(window.CognitivArrayQuery).toBeDefined();
  });

  test('CognitivArrayQuery is a function or class', () => {
    expect(typeof window.CognitivArrayQuery).toBe('function');
  });

  // Check if Moment.js is available within the module
  /*test('Moment.js is bundled inside CognitivArrayQuery', () => {
    // Check if Moment is a property of CognitivArrayQuery
    expect(window.CognitivArrayQuery.moment).toBeDefined();

    // Optionally, check if it's a function (Moment.js should be a function)
    expect(typeof window.CognitivArrayQuery.moment).toBe('function');

    // Check if Moment.js is working (use any simple test, such as creating a moment object)
    const testMoment = window.CognitivArrayQuery.moment();
    expect(testMoment.isValid()).toBe(true); // Check if the created moment is valid
  });*/
});
