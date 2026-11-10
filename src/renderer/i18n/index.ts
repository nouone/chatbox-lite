import { translationResources } from '@chatbox/i18n'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { authErrorOverrides } from './auth-error-overrides'

i18n.use(initReactI18next).init({
  resources: {
    ...translationResources,
    'zh-Hans': {
      translation: { ...translationResources['zh-Hans'].translation, ...authErrorOverrides['zh-Hans'] },
    },
    'zh-Hant': {
      translation: { ...translationResources['zh-Hant'].translation, ...authErrorOverrides['zh-Hant'] },
    },
    en: {
      translation: { ...translationResources.en.translation, ...authErrorOverrides.en },
    },
  },
  fallbackLng: 'en',

  interpolation: {
    escapeValue: false,
  },

  detection: {
    caches: [],
  },
})

export default i18n
