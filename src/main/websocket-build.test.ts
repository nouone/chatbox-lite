import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { MAIN_WEBSOCKET_DEFINES } from './websocket-build'

const require = createRequire(import.meta.url)
async function bundledReceiver(define: Record<string, string>) {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `const {Receiver} = require('ws');
module.exports = () => new Promise((resolve, reject) => {
  const receiver = new Receiver({isServer: true});
  receiver.on('message', data => resolve(data.toString()));
  receiver.on('error', reject);
  const data = Buffer.from('browser subscribe '.repeat(6));
  const mask = Buffer.from([1, 2, 3, 4]);
  const frame = Buffer.alloc(6 + data.length);
  frame[0] = 0x81; frame[1] = 0x80 | data.length; mask.copy(frame, 2);
  for(let i=0;i<data.length;i++) frame[6+i] = data[i] ^ mask[i%4];
  receiver.write(frame);
});`,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    define,
    plugins: [{
      name: 'reproduce-packaged-empty-native-module',
      setup(builder) {
        builder.onResolve({filter: /^bufferutil$/}, () => ({path: 'bufferutil', namespace: 'empty-native'}))
        builder.onLoad({filter: /.*/, namespace: 'empty-native'}, () => ({contents: 'module.exports = {}'}))
      },
    }],
  })
  const module = {exports: undefined as unknown}
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports as () => Promise<string>
}

it('reproduces the packaged unmask failure and decodes the same masked browser frame with the production flags', async () => {
  const broken = await bundledReceiver({})
  await expect(broken()).rejects.toThrow('unmask is not a function')
  const fixed = await bundledReceiver(MAIN_WEBSOCKET_DEFINES)
  await expect(fixed()).resolves.toBe('browser subscribe '.repeat(6))
})
