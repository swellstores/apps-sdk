const mockStorefront = {
  request: jest.fn().mockImplementation((method, url, _id, _data, opt) => {
    // Return mock data for specific endpoints
    if (url === '/settings/all') {
      return Promise.resolve({
        settings: {},
        menus: [],
        payments: [],
        subscriptions: [],
        session: {},
      });
    }
  }),
  settings: {
    get: jest.fn().mockReturnValue({}),
    set: jest.fn(),
    getState: jest.fn().mockReturnValue({}),
  },
  session: {
    getCookie: jest.fn().mockReturnValue('test-cookie'),
  },
  currency: {
    state: { code: 'USD' },
    code: 'USD',
    locale: 'en-US',
    selected: jest.fn().mockReturnValue('USD'),
  },
  locale: {
    state: { code: 'en-US' },
    code: 'en-US',
    selected: jest.fn().mockReturnValue('en-US'),
  },
  cart: {
    get: jest.fn().mockResolvedValue({
      id: 'test-cart',
      total: 0,
      items: [],
    }),
  },
};

const mockModule = {
  __esModule: true,
  default: {
    create: jest.fn().mockReturnValue(mockStorefront),
  },
};

module.exports = mockModule;
