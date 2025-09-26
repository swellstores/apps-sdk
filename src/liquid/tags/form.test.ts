import { describeTag, removeSpaces } from '../test-helpers';

describeTag('form', (render, liquid) => {
  it('should return form', async () => {
    const result = await render(
      `{% form 'test_form' %}
        Test form content
      {% endform %}`,
    );

    expect(removeSpaces(result)).toBe(
      '<form action="/test" method="post" accept-charset="UTF-8" enctype="multipart/form-data" id="test_form_form"><input type="hidden" name="form_type" value="test_form" />Test form content</form>',
    );
    expect(liquid.theme.getFormConfig).toHaveBeenCalledWith('test_form');
  });
});
