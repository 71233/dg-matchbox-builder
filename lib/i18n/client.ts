'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    resources: {
      ja: { translation: { workspace: '公開ベータ ワークスペース' } },
      en: { translation: { workspace: 'Public beta workspace' } },
    },
  });
}

export default i18n;
