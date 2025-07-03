import svgs from './index';

describe('placeholder-svgs', () => {
  it('should have src', () => {
    for (const image of Object.values(svgs)) {
      expect(image).toHaveProperty('src');
    }
  });
});
