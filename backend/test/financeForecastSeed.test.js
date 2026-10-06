const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const fixture = require('../fixtures/financeForecast');
const { serializeForecast } = require('../services/financeForecastResolver');

// Exercise the CLI with in-memory doubles only: never connect to a database.
function loadSeed(env = {}) {
  const calls = [];
  const mongoose = {
    isValidObjectId: (value) => /^[a-f0-9]{24}$/.test(value),
    Types: { ObjectId: class { constructor(value) { this.value = value; } } },
    connect: async (uri) => calls.push(['connect', uri]),
    disconnect: async () => calls.push(['disconnect']),
  };
  const model = {
    findOneAndUpdate: async (...args) => {
      calls.push(['upsert', ...args]);
      return { _id: 'synthetic-test-id' };
    },
  };
  const dependencies = {
    mongoose,
    dotenv: { config() {} },
    '../models/FinanceForecast': model,
    '../fixtures/financeForecast': fixture,
  };
  const sandbox = {
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module: { exports: {} },
    process: { env },
    console: { log() {}, error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/seedFinanceForecast.js'), 'utf8'), sandbox);
  return { run: sandbox.module.exports.run, calls };
}

test('synthetic forecast covers income, expenses, grouped dates and optional financing fields', () => {
  assert.match(fixture.name, /Synthetic/);
  assert.match(fixture.account_name, /fictional/);
  assert.equal(fixture.items.length, 8);
  assert.equal(fixture.financing.length, 2);
  for (const item of fixture.items) {
    assert.match(item.label, /Example/);
    assert.ok(Number.isFinite(item.amount) && item.amount >= 0);
    assert.ok(!Number.isNaN(item.date_start.getTime()));
    if (item.date_end) assert.ok(item.date_end >= item.date_start);
  }
  assert.ok(fixture.items.some((item) => item.is_group));
  assert.equal(fixture.financing[1].remaining_balance, undefined);
  const result = serializeForecast(structuredClone(fixture), new Date('2030-01-01T00:00:00Z'));
  assert.equal(result.summary.ending_balance, 6150);
});

test('synthetic fixture satisfies the forecast schema without a database', () => {
  const FinanceForecast = require('../models/FinanceForecast');
  const document = new FinanceForecast({ ...fixture, user_id: '000000000000000000000001' });
  assert.equal(document.validateSync(), undefined);
  assert.equal(document.items[0].status, 'planned');
});

test('importing the seed never connects or writes', () => {
  assert.deepEqual(loadSeed().calls, []);
});

test('seed rejects a missing or invalid test account before connecting', async () => {
  for (const FORECAST_USER_ID of [undefined, 'invalid']) {
    const seed = loadSeed({ FORECAST_USER_ID, MONGO_URI: 'mongodb://example.invalid/test' });
    await assert.rejects(seed.run(), /FORECAST_USER_ID/);
    assert.deepEqual(seed.calls, []);
  }
});

test('seed requires an explicit database instead of defaulting to the private app database', async () => {
  const seed = loadSeed({ FORECAST_USER_ID: '000000000000000000000001' });
  await assert.rejects(seed.run(), /MONGO_URI/);
  assert.deepEqual(seed.calls, []);
});

test('seed scopes its repeatable upsert to the synthetic name and selected test user', async () => {
  const seed = loadSeed({ FORECAST_USER_ID: '000000000000000000000001', MONGO_URI: 'mongodb://example.invalid/test' });
  await seed.run();
  assert.equal(seed.calls.length, 3);
  assert.deepEqual(seed.calls[0], ['connect', 'mongodb://example.invalid/test']);
  const [, filter, update, options] = seed.calls[1];
  assert.equal(filter.name, fixture.name);
  assert.equal(filter.user_id.value, '000000000000000000000001');
  assert.equal(update.$set, fixture);
  assert.equal(options.upsert, true);
  assert.equal(options.setDefaultsOnInsert, true);
  assert.deepEqual(seed.calls[2], ['disconnect']);
});
