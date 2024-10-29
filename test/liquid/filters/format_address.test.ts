import { describeFilter } from '../helpers';

describeFilter('format_address', (render) => {
  const address = {
    name: 'Test address',
    company: 'Swell',
    address1: 'Test Str 1',
    address2: 'Test Str 2',
    city: 'Test',
    state: 'AL',
    country: 'US',
    zip: '12345',
  };

  it('should format address', async () => {
    const result = await render(`{{ address | format_address }}`, {
      address,
    });

    expect(result.trim()).toBe(
      `<p>Test address<br />Swell<br />Test Str 1<br />Test Str 2<br />Test<br />AL<br />US<br />12345</p>`,
    );
  });
});
