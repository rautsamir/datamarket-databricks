import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEndpointName, askAiEndpoint, askAiRequest, DEFAULT_ASK_AI_ENDPOINT } from '../routes/ask-catalog.js';

test('accepts real Databricks serving endpoint names', () => {
  for (const name of [
    'databricks-meta-llama-3-3-70b-instruct',
    'my_gateway_endpoint',
    'team.gpt-4o',
    'a',
  ]) {
    assert.equal(sanitizeEndpointName(name), name, `expected ${name} to be accepted`);
  }
});

test('trims surrounding whitespace', () => {
  assert.equal(sanitizeEndpointName('  my-endpoint  '), 'my-endpoint');
});

// The name is interpolated into a URL path, so anything that could escape the
// path segment or address a different API must be rejected.
test('rejects names that could escape the URL path segment', () => {
  for (const name of [
    '',
    '   ',
    null,
    undefined,
    'foo/bar',
    '../../api/2.0/clusters/list',
    'foo/invocations?x=1',
    'foo bar',
    'foo%2Fbar',
    'foo#frag',
    '-leading-hyphen',
    'a'.repeat(128),
  ]) {
    assert.equal(sanitizeEndpointName(name), null, `expected ${JSON.stringify(name)} to be rejected`);
  }
});

test('falls back to the default when nothing is configured', () => {
  delete process.env.ASK_AI_ENDPOINT;
  assert.equal(askAiEndpoint(), DEFAULT_ASK_AI_ENDPOINT);
});

test('env var overrides the built-in default', () => {
  process.env.ASK_AI_ENDPOINT = 'governed-gateway-endpoint';
  assert.equal(askAiEndpoint(), 'governed-gateway-endpoint');
  delete process.env.ASK_AI_ENDPOINT;
});

test('serving endpoint names use the invocations path', () => {
  const payload = { messages: [], max_tokens: 1 };
  for (const name of ['databricks-meta-llama-3-3-70b-instruct', 'team.gpt-4o']) {
    const { path, body } = askAiRequest(name, payload);
    assert.equal(path, `/serving-endpoints/${name}/invocations`);
    assert.deepEqual(body, payload);
  }
});

test('catalog.schema.service names go through AI Gateway with the name as the model', () => {
  const { path, body } = askAiRequest('main.ops.ask_ai', { messages: [], max_tokens: 1 });
  assert.equal(path, '/ai-gateway/mlflow/v1/chat/completions');
  assert.deepEqual(body, { model: 'main.ops.ask_ai', messages: [], max_tokens: 1 });
});

test('the built-in default is itself a valid endpoint name', () => {
  assert.equal(sanitizeEndpointName(DEFAULT_ASK_AI_ENDPOINT), DEFAULT_ASK_AI_ENDPOINT);
});
