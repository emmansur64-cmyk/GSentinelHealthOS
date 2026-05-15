/**
 * Integration test: verifies that GROQ_API_KEY_CHAT is wired correctly
 * and that the medical-chat GroqProvider can reach the Groq API.
 *
 * This test is intentionally skipped when GROQ_API_KEY_CHAT is not set
 * (e.g. CI without secrets). Run it locally with a real key in .env:
 *
 *   GROQ_API_KEY_CHAT=gsk_... npx jest groq-chat.connection --testTimeout=15000
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { GroqProvider } from './groq.provider';

const CHAT_KEY = process.env['GROQ_API_KEY_CHAT'];

const describeOrSkip = CHAT_KEY ? describe : describe.skip;

describeOrSkip('GroqProvider – GROQ_API_KEY_CHAT live connection', () => {
  let provider: GroqProvider;

  beforeAll(() => {
    provider = new GroqProvider('GROQ_API_KEY_CHAT');
  });

  it('returns a non-empty response from the Groq API using GROQ_API_KEY_CHAT', async () => {
    const response = await provider.run(
      'You are a medical assistant test. Reply with exactly one word: OK',
    );

    expect(typeof response).toBe('string');
    expect(response.trim().length).toBeGreaterThan(0);
  }, 15_000);

  it('does NOT use GROQ_API_KEY (verifies key isolation)', () => {
    // The provider instance was constructed with GROQ_API_KEY_CHAT.
    // Accessing the private field is intentional here — only for test isolation assertion.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const usedKey = (provider as unknown as Record<string, unknown>)['apiKey'] as string;
    const generalKey = process.env['GROQ_API_KEY'];

    if (generalKey && generalKey !== 'replace_me') {
      expect(usedKey).not.toBe(generalKey);
    }

    expect(usedKey).toBe(CHAT_KEY);
  });
});
