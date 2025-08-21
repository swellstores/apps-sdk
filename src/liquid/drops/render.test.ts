import { Drop } from 'liquidjs';

import { describeFilter } from '../test-helpers';

import RenderDrop from './render';

describeFilter('liquid/drops/render', (render) => {
  it('should render drop', async () => {
    const handler = jest.fn(() => {
      return 'value1';
    });

    const data = {
      test_value: new RenderDrop(handler),
    };

    let result = await render('{{ test_value }}', data);
    expect(result).toStrictEqual('value1');
    expect(handler).toHaveBeenCalledTimes(1);

    result = await render('{{ test_value }}', data);
    expect(result).toStrictEqual('value1');
    // the handler should only be called once
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should render drop as index', async () => {
    class ObjectDrop extends Drop {
      liquidMethodMissing(key: unknown): unknown {
        if (key === 'value1') {
          return { title: 'Value 1' };
        }

        return null;
      }
    }

    const handler = jest.fn(() => {
      return 'value1';
    });

    const data = {
      object: new ObjectDrop(),
      handle: new RenderDrop(handler),
    };

    const result = await render('{{ object[handle].title }}', data);
    expect(result).toStrictEqual('Value 1');
  });
});
