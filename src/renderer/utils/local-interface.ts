/** This custom build defaults to a local-provider interface; opt out at dev/build time. */
export function isLocalInterface(): boolean {
  return process.env.CHATBOX_LOCAL_UI !== '0'
}
