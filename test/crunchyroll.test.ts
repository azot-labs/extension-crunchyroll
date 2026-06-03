import { expect, test } from 'vitest';

globalThis.Azot = {
  defineExtension: (extension: unknown) => extension,
  utils: {},
};

test('exports ExtensionV2 hooks', async () => {
  const { default: crunchyroll } = await import('../crunchyroll');

  expect(crunchyroll).toBeDefined();
  expect(crunchyroll).toHaveProperty('initialize');
  expect(crunchyroll).toHaveProperty('getEntries');
  expect(crunchyroll).toHaveProperty('resolveEntry');
  expect(crunchyroll).toHaveProperty('auth');
  expect(crunchyroll).toHaveProperty('drm');
});
