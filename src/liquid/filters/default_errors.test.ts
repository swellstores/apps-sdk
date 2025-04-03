import { describeFilter, removeSpaces } from '../test-helpers';

describeFilter('default_errors', (render) => {
  const errors = [{ message: 'Test error' }, { message: null }];

  it('should return errors', async () => {
    const result = await render(`{{ form.errors | default_errors }}`, {
      form: { errors },
    });

    expect(removeSpaces(result)).toBe(
      '<div class="errors"><ul><li>Test error</li><li>Unknown error</li></ul></div>',
    );
  });

  it('should return empty string if no errors', async () => {
    const result = await render(`{{ form.errors | default_errors }}`, {
      form: { errors: null },
    });

    expect(removeSpaces(result)).toBe('');
  });
});
