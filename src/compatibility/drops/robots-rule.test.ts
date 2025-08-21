import { describeFilter } from '../../liquid/test-helpers';

import RobotsRuleDrop from './robots-rule';

describeFilter('compatibility/drops/robots-rule', (render) => {
  it('should render robots-rule drop', async () => {
    const data = {
      test_rule: new RobotsRuleDrop('User-agent', '*'),
    };

    const result = await render('{{ test_rule }}', data);

    expect(result).toStrictEqual('User-agent: *\n');
  });
});
