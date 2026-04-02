import {
  appLocaleStorageKey,
  defaultAppLocale,
  detectBrowserLocale,
  resolveSupportedLocale,
  type AppLocale
} from "@/lib/i18n/locales";
import {
  createBrowserConversationStore,
  isBrowserConversationStoreError,
  type ChatPreferenceRecord
} from "@/lib/chat/local-store";

export const languagePreferenceKey = "language";
export const lastSelectedModelConfigIdPreferenceKey = "lastSelectedModelConfigId";

export type BrowserPreferencesStore = {
  getLanguagePreference(): Promise<AppLocale | null>;
  setLanguagePreference(locale: AppLocale): Promise<void>;
  resolveLanguagePreference(): Promise<AppLocale>;
  getLastSelectedModelConfigId(): Promise<string | null>;
  setLastSelectedModelConfigId(modelConfigId: string | null): Promise<void>;
};

export function createBrowserPreferencesStore(userId: string): BrowserPreferencesStore {
  const store = createBrowserConversationStore(userId);

  async function getLanguagePreference() {
    const preferenceRecord = await readPreference<AppLocale>(store, languagePreferenceKey);
    return resolveSupportedLocale(preferenceRecord?.value ?? readMirroredLanguagePreference());
  }

  async function setLanguagePreference(locale: AppLocale) {
    await writePreference(store, createPreferenceRecord(languagePreferenceKey, locale));
    mirrorLanguagePreference(locale);
  }

  async function resolveLanguagePreference() {
    const savedLocale = await getLanguagePreference();
    return savedLocale ?? detectBrowserLocale();
  }

  async function getLastSelectedModelConfigId() {
    const preferenceRecord = await readPreference<string>(store, lastSelectedModelConfigIdPreferenceKey);
    return typeof preferenceRecord?.value === "string" && preferenceRecord.value.trim() !== ""
      ? preferenceRecord.value
      : null;
  }

  async function setLastSelectedModelConfigId(modelConfigId: string | null) {
    if (!modelConfigId) {
      await deletePreference(store, lastSelectedModelConfigIdPreferenceKey);
      return;
    }

    await writePreference(store, createPreferenceRecord(lastSelectedModelConfigIdPreferenceKey, modelConfigId));
  }

  return {
    getLanguagePreference,
    setLanguagePreference,
    resolveLanguagePreference,
    getLastSelectedModelConfigId,
    setLastSelectedModelConfigId
  };
}

function createPreferenceRecord<TValue extends ChatPreferenceRecord["value"]>(
  key: ChatPreferenceRecord<TValue>["key"],
  value: TValue
): ChatPreferenceRecord<TValue> {
  return {
    key,
    value,
    updatedAt: new Date().toISOString()
  };
}

async function readPreference<TValue extends ChatPreferenceRecord["value"]>(
  store: ReturnType<typeof createBrowserConversationStore>,
  key: string
): Promise<ChatPreferenceRecord<TValue> | null> {
  try {
    return await store.getPreference<TValue>(key);
  } catch (error) {
    if (isBrowserConversationStoreError(error)) {
      return null;
    }

    throw error;
  }
}

async function writePreference<TValue extends ChatPreferenceRecord["value"]>(
  store: ReturnType<typeof createBrowserConversationStore>,
  preference: ChatPreferenceRecord<TValue>
) {
  try {
    await store.savePreference(preference);
  } catch (error) {
    if (!isBrowserConversationStoreError(error)) {
      throw error;
    }
  }
}

async function deletePreference(store: ReturnType<typeof createBrowserConversationStore>, key: string) {
  try {
    await store.deletePreference(key);
  } catch (error) {
    if (!isBrowserConversationStoreError(error)) {
      throw error;
    }
  }
}

function readMirroredLanguagePreference(): AppLocale | null {
  if (typeof window === "undefined") {
    return defaultAppLocale;
  }

  return resolveSupportedLocale(window.localStorage.getItem(appLocaleStorageKey));
}

function mirrorLanguagePreference(locale: AppLocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(appLocaleStorageKey, locale);
}
