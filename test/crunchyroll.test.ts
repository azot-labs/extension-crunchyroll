import { expect, test } from 'vitest';
import crunchyroll from '../crunchyroll';

test('exports ExtensionV2 hooks', () => {
  expect(crunchyroll).toBeDefined();
  expect(crunchyroll).toHaveProperty('setup');
  expect(crunchyroll).toHaveProperty('resolveEntries');
  expect(crunchyroll).toHaveProperty('resolveMedia');
  expect(crunchyroll).toHaveProperty('auth');
  expect(crunchyroll).toHaveProperty('drm');
});
