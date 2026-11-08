import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

app.setName('Wao')

const explicitProfile = app.commandLine.getSwitchValue('user-data-dir')
const appData = app.getPath('appData')
const waoProfile = path.join(appData, 'Wao')
const legacyProfile = path.join(appData, 'xyz.chatboxapp.ce')

// Prefer the renamed profile when both exist. Otherwise keep using the old
// profile in place, so upgrading does not require copying or moving any data.
let profile = waoProfile
if (explicitProfile) {
  profile = path.resolve(explicitProfile)
} else if (
  !statSync(waoProfile, { throwIfNoEntry: false }) &&
  statSync(legacyProfile, { throwIfNoEntry: false })?.isDirectory()
) {
  profile = legacyProfile
}

mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
