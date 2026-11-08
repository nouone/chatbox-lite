import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import platform from '../platform'

function getInitialTime() {
  let initialTime = parseInt(localStorage.getItem('initial-time') || '')
  if (!initialTime) {
    initialTime = Date.now()
    localStorage.setItem('initial-time', `${initialTime}`)
  }

  return initialTime
}

export function isFirstDay(): boolean {
  const initialTime = getInitialTime()
  const today = dayjs()
  const installDay = dayjs(initialTime)

  // Compare only the date part (year, month, day) in user's local timezone
  // This ensures the comparison is based on the user's current timezone,
  // which is more intuitive for the user experience
  return today.isSame(installDay, 'day')
}

/** Read the installed version locally. Lite has no vendor update/review checks. */
export default function useVersion() {
  const [version, setVersion] = useState('')
  useEffect(() => {
    let active = true
    void platform
      .getVersion()
      .then((value) => {
        if (active) setVersion(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return { version, versionLoaded: !!version, isExceeded: false, isExceededResolved: true, needCheckUpdate: false }
}
