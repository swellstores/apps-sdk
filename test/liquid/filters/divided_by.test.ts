import { describeFilter } from '../helpers';

describeFilter('divided_by', (render) => {
  it('should return divided value', async () => {
    const result = await render(`{{ 4 | divided_by: 2 }}`);

    expect(result).toBe('2');
  });

  it('should return divided value when divisor is a float', async () => {
    const result = await render(`{{ 20 | divided_by: 7.0 }}`);

    expect(result).toBe('2.857142857142857');
  });

  it('should return divided value with integer arithmetic', async () => {
    const result = await render(`{{ 5 | divided_by: 3, true }}`);

    expect(result).toBe('1');
  });
});
