import { describeFilter } from '../test-helpers';

/** @see {@link https://shopify.dev/docs/api/liquid/basics#modifying-handles} */

describeFilter('handleize', (render) => {
  it('should transform to lowercase', async () => {
    const obj = { title: 'TestProduct' };
    const result = await render('{{ obj.title | handleize }}', { obj });

    expect(result).toStrictEqual('test-product');
  });

  it('should replace whitespace and special characters with a hyphen', async () => {
    const obj = { title: 'Test _%^&*_ Product' };
    const result = await render('{{ obj.title | handleize }}', { obj });

    expect(result).toStrictEqual('test-product');
  });

  it('should remove whitespace or special characters at the beginning', async () => {
    const obj = { title: '__Test Product__' };
    const result = await render('{{ obj.title | handleize }}', { obj });

    expect(result).toStrictEqual('test-product');
  });
});
