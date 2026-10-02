import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

import { Swell, SwellBackendAPI } from './api';

describe('Swell', () => {
  describe('concerning headers', () => {
    it('sets headers from serverHeaders (SwellData)', () => {
      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'foo': 'bar',
        },
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'swell-public-key': 'publickey',
        'swell-store-id': 'test',
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });

    it('sets headers from serverHeaders (Headers)', () => {
      const swell = new Swell({
        serverHeaders: new Headers({
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'foo': 'bar',
        }),
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'swell-public-key': 'publickey',
        'swell-store-id': 'test',
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });

    it('sets headers from headers and swellHeaders', () => {
      const swell = new Swell({
        headers: {
          'foo': 'bar',
        },
        swellHeaders: {
          'public-key': 'publickey',
          'store-id': 'test',
        },
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });
  }); // concerning headers

  describe('concerning storefrontContext', () => {
    it('sets empty storefront context by default', () => {
      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
        },
        url: new URL('https://storefront.app'),
      });

      expect(swell.storefrontContext).toEqual({});
    });

    it('sets storefront context from swellHeaders', () => {
      const context = {
        cart: {
          id: 'cartid',
          total: 9.99,
        },
        account: null,
      };

      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'swell-storefront-context': encodeURIComponent(
            JSON.stringify(context),
          ),
        },
        url: new URL('https://storefront.app'),
      });

      expect(swell.storefrontContext).toEqual(context);
    });
  }); // concerning storefrontContext
});

describe('SwellBackendAPI', () => {
  let server: http.Server;
  let apiHost: string;
  let received: { method?: string; contentLength?: string; body: string };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received = {
          method: req.method,
          contentLength: req.headers['content-length'],
          body: Buffer.concat(chunks).toString('utf8'),
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(received.body || '{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    apiHost = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const api = () =>
    new SwellBackendAPI({ storeId: 'test', accessToken: 'token', apiHost });

  it('sends a body with non-ASCII characters intact', async () => {
    const data = {
      $set: { values: { heading: 'People’s favorites — printed in Montréal' } },
    };

    const result = await api().put('/:storefronts/sf/configs/settings', data);

    expect(received.method).toBe('PUT');
    expect(JSON.parse(received.body)).toEqual(data);
    expect(Number(received.contentLength)).toBe(
      Buffer.byteLength(received.body, 'utf8'),
    );
    expect(result).toEqual(data);
  });

  it('sends an ASCII body as before', async () => {
    const data = { data: { $base64: 'iVBORw0KGgo=' }, filename: 'logo.png' };

    await api().post('/:files', data);

    expect(received.method).toBe('POST');
    expect(JSON.parse(received.body)).toEqual(data);
  });
});
