// Los *fakes* viven en src/ porque la API los elige en tiempo de ejecución con
// NODE_ENV=test (también en e2e). Se reexportan aquí para los tests.
export { DEFAULT_AI_FIXTURES_DIR, defaultFixtureName, FakeGeminiClient, type AiFixture, type GeminiCall } from '../../src/ai/fake-gemini.client.js';
export { extractLinks, FakeEmailSender, type SentEmail } from '../../src/email/fake-email-sender.js';
export { FakePushSender, FakeWebPushSender, type RecordedPush } from '../../src/push/fake-push-sender.js';
