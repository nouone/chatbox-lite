// ws optional native accelerators can become empty module stubs in the bundled
// Electron main process. Keep its supported pure-JavaScript implementation.
export const MAIN_WEBSOCKET_DEFINES = {
  'process.env.WS_NO_BUFFER_UTIL': JSON.stringify('1'),
  'process.env.WS_NO_UTF_8_VALIDATE': JSON.stringify('1'),
}
