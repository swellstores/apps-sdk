import { describeTag, removeSpaces } from '../helpers';

describeTag('javascript', (render) => {
  it('should return script tag with js code', async () => {
    const result = await render(
      `{% javascript %}
        console.log('Test JS');
      {% endjavascript %}`,
    );

    expect(removeSpaces(result)).toBe(
      `<script type=\"text/javascript\" data-swell>console.log('Test JS');</script>`,
    );
  });
});
