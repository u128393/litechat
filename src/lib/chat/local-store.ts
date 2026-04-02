const DATABASE_NAME = "litechat-browser-store";
const DATABASE_VERSION = 1;

const CONVERSATIONS_STORE = "conversations";
const MESSAGES_STORE = "messages";
const DRAFTS_STORE = "drafts";
const UI_STATE_STORE = "ui_state";
const PREFERENCES_STORE = "preferences";

const USER_ID_INDEX = "byUserId";
const USER_CONVERSATION_INDEX = "byUserConversation";

type StoreName =
  | typeof CONVERSATIONS_STORE
  | typeof MESSAGES_STORE
  | typeof DRAFTS_STORE
  | typeof UI_STATE_STORE
  | typeof PREFERENCES_STORE;

type UserScopeKey = [userId: string, entityId: string];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ChatConversationRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export type ChatMessageRecord = {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatDraftRecord = {
  conversationId: string;
  text: string;
  updatedAt: string;
};

export type ChatUiStateKey = string & {};

export type ChatUiStateRecord<TValue extends JsonValue = JsonValue> = {
  key: ChatUiStateKey;
  value: TValue;
  updatedAt: string;
};

export type ChatPreferenceKey = "language" | "lastSelectedModelConfigId" | (string & {});

export type ChatPreferenceRecord<TValue extends JsonValue = JsonValue> = {
  key: ChatPreferenceKey;
  value: TValue;
  updatedAt: string;
};

type ScopedConversationRecord = ChatConversationRecord & {
  userId: string;
};

type ScopedMessageRecord = ChatMessageRecord & {
  userId: string;
};

type ScopedDraftRecord = ChatDraftRecord & {
  userId: string;
};

type ScopedUiStateRecord = ChatUiStateRecord & {
  userId: string;
};

type ScopedPreferenceRecord = ChatPreferenceRecord & {
  userId: string;
};

type ScopedRecord =
  | ScopedConversationRecord
  | ScopedMessageRecord
  | ScopedDraftRecord
  | ScopedUiStateRecord
  | ScopedPreferenceRecord;

export type BrowserConversationStoreErrorCode =
  | "unavailable"
  | "open_failed"
  | "transaction_failed"
  | "request_failed";

export class BrowserConversationStoreError extends Error {
  readonly code: BrowserConversationStoreErrorCode;
  readonly cause: unknown;

  constructor(code: BrowserConversationStoreErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "BrowserConversationStoreError";
    this.code = code;
    this.cause = cause;
  }
}

export type BrowserConversationStore = {
  listConversations(): Promise<ChatConversationRecord[]>;
  getConversation(conversationId: string): Promise<ChatConversationRecord | null>;
  saveConversation(conversation: ChatConversationRecord): Promise<ChatConversationRecord>;
  deleteConversation(conversationId: string): Promise<void>;
  listMessages(conversationId: string): Promise<ChatMessageRecord[]>;
  saveMessage(message: ChatMessageRecord): Promise<ChatMessageRecord>;
  saveMessages(messages: ChatMessageRecord[]): Promise<ChatMessageRecord[]>;
  deleteMessage(messageId: string): Promise<void>;
  getDraft(conversationId: string): Promise<ChatDraftRecord | null>;
  saveDraft(draft: ChatDraftRecord): Promise<ChatDraftRecord>;
  deleteDraft(conversationId: string): Promise<void>;
  getUiState<TValue extends JsonValue = JsonValue>(key: ChatUiStateKey): Promise<ChatUiStateRecord<TValue> | null>;
  saveUiState<TValue extends JsonValue = JsonValue>(state: ChatUiStateRecord<TValue>): Promise<ChatUiStateRecord<TValue>>;
  deleteUiState(key: ChatUiStateKey): Promise<void>;
  getPreference<TValue extends JsonValue = JsonValue>(key: ChatPreferenceKey): Promise<ChatPreferenceRecord<TValue> | null>;
  savePreference<TValue extends JsonValue = JsonValue>(preference: ChatPreferenceRecord<TValue>): Promise<ChatPreferenceRecord<TValue>>;
  deletePreference(key: ChatPreferenceKey): Promise<void>;
  listPreferences(): Promise<ChatPreferenceRecord[]>;
};

let openDatabasePromise: Promise<IDBDatabase> | null = null;

export function createBrowserConversationStore(userId: string): BrowserConversationStore {
  return {
    async listConversations() {
      const records = await getByUserId<ScopedConversationRecord>(CONVERSATIONS_STORE, userId);
      return records.map(toConversationRecord).sort(sortByUpdatedAtDesc);
    },
    async getConversation(conversationId) {
      const record = await getRecord<ScopedConversationRecord>(CONVERSATIONS_STORE, scopedKey(userId, conversationId));
      return record ? toConversationRecord(record) : null;
    },
    async saveConversation(conversation) {
      const record: ScopedConversationRecord = {
        ...conversation,
        userId
      };

      await putRecord(CONVERSATIONS_STORE, record);

      return conversation;
    },
    async deleteConversation(conversationId) {
      await deleteConversationRecords(userId, conversationId);
    },
    async listMessages(conversationId) {
      const records = await getByUserConversation<ScopedMessageRecord>(MESSAGES_STORE, userId, conversationId);
      return records.map(toMessageRecord).sort(sortByCreatedAtAsc);
    },
    async saveMessage(message) {
      const record: ScopedMessageRecord = {
        ...message,
        userId
      };

      await putRecord(MESSAGES_STORE, record);

      return message;
    },
    async saveMessages(messages) {
      await runTransaction([MESSAGES_STORE], "readwrite", async (transaction) => {
        const store = transaction.objectStore(MESSAGES_STORE);

        for (const message of messages) {
          await requestToPromise(store.put({
            ...message,
            userId
          } satisfies ScopedMessageRecord));
        }
      });

      return messages;
    },
    async deleteMessage(messageId) {
      await deleteRecord(MESSAGES_STORE, scopedKey(userId, messageId));
    },
    async getDraft(conversationId) {
      const record = await getRecord<ScopedDraftRecord>(DRAFTS_STORE, scopedKey(userId, conversationId));
      return record ? toDraftRecord(record) : null;
    },
    async saveDraft(draft) {
      const record: ScopedDraftRecord = {
        ...draft,
        userId
      };

      await putRecord(DRAFTS_STORE, record);

      return draft;
    },
    async deleteDraft(conversationId) {
      await deleteRecord(DRAFTS_STORE, scopedKey(userId, conversationId));
    },
    async getUiState<TValue extends JsonValue = JsonValue>(key: ChatUiStateKey) {
      const record = await getRecord<ScopedUiStateRecord>(UI_STATE_STORE, scopedKey(userId, key));
      return record ? (toUiStateRecord(record) as ChatUiStateRecord<TValue>) : null;
    },
    async saveUiState<TValue extends JsonValue = JsonValue>(state: ChatUiStateRecord<TValue>) {
      const record: ScopedUiStateRecord = {
        ...state,
        userId
      };

      await putRecord(UI_STATE_STORE, record);

      return state;
    },
    async deleteUiState(key) {
      await deleteRecord(UI_STATE_STORE, scopedKey(userId, key));
    },
    async getPreference<TValue extends JsonValue = JsonValue>(key: ChatPreferenceKey) {
      const record = await getRecord<ScopedPreferenceRecord>(PREFERENCES_STORE, scopedKey(userId, key));
      return record ? (toPreferenceRecord(record) as ChatPreferenceRecord<TValue>) : null;
    },
    async savePreference<TValue extends JsonValue = JsonValue>(preference: ChatPreferenceRecord<TValue>) {
      const record: ScopedPreferenceRecord = {
        ...preference,
        userId
      };

      await putRecord(PREFERENCES_STORE, record);

      return preference;
    },
    async deletePreference(key) {
      await deleteRecord(PREFERENCES_STORE, scopedKey(userId, key));
    },
    async listPreferences() {
      const records = await getByUserId<ScopedPreferenceRecord>(PREFERENCES_STORE, userId);
      return records.map(toPreferenceRecord).sort((left, right) => left.key.localeCompare(right.key));
    }
  };
}

export function isBrowserConversationStoreError(error: unknown): error is BrowserConversationStoreError {
  return error instanceof BrowserConversationStoreError;
}

function getIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new BrowserConversationStoreError(
      "unavailable",
      "IndexedDB is unavailable in the current runtime."
    );
  }

  return indexedDB;
}

async function openDatabase() {
  if (openDatabasePromise) {
    return openDatabasePromise;
  }

  try {
    const indexedDb = getIndexedDb();

    openDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        const upgradeTransaction = request.transaction;

        if (!upgradeTransaction) {
          reject(new BrowserConversationStoreError("open_failed", "Chat storage upgrade transaction was unavailable."));
          return;
        }

        const conversationsStore = createObjectStore(database, upgradeTransaction, CONVERSATIONS_STORE, ["userId", "id"]);
        createIndex(conversationsStore, USER_ID_INDEX, "userId");

        const messagesStore = createObjectStore(database, upgradeTransaction, MESSAGES_STORE, ["userId", "id"]);
        createIndex(messagesStore, USER_ID_INDEX, "userId");
        createIndex(messagesStore, USER_CONVERSATION_INDEX, ["userId", "conversationId"]);

        const draftsStore = createObjectStore(database, upgradeTransaction, DRAFTS_STORE, ["userId", "conversationId"]);
        createIndex(draftsStore, USER_ID_INDEX, "userId");

        const uiStateStore = createObjectStore(database, upgradeTransaction, UI_STATE_STORE, ["userId", "key"]);
        createIndex(uiStateStore, USER_ID_INDEX, "userId");

        const preferencesStore = createObjectStore(database, upgradeTransaction, PREFERENCES_STORE, ["userId", "key"]);
        createIndex(preferencesStore, USER_ID_INDEX, "userId");
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          openDatabasePromise = null;
        };
        resolve(database);
      };

      request.onerror = () => {
        reject(new BrowserConversationStoreError("open_failed", "Failed to open the chat storage database.", request.error));
      };

      request.onblocked = () => {
        reject(new BrowserConversationStoreError("open_failed", "Chat storage database upgrade was blocked."));
      };
    });
  } catch (error) {
    openDatabasePromise = null;
    throw toStoreError(error, "open_failed", "Failed to initialize the chat storage database.");
  }

  return openDatabasePromise.catch((error) => {
    openDatabasePromise = null;
    throw error;
  });
}

async function getByUserId<TRecord extends ScopedRecord>(storeName: StoreName, userId: string): Promise<TRecord[]> {
  return runTransaction([storeName], "readonly", async (transaction) => {
    const index = transaction.objectStore(storeName).index(USER_ID_INDEX);
    return requestToPromise(index.getAll(userId)) as Promise<TRecord[]>;
  });
}

async function getByUserConversation<TRecord extends ScopedRecord>(
  storeName: typeof MESSAGES_STORE,
  userId: string,
  conversationId: string
): Promise<TRecord[]> {
  return runTransaction([storeName], "readonly", async (transaction) => {
    const index = transaction.objectStore(storeName).index(USER_CONVERSATION_INDEX);
    return requestToPromise(index.getAll(scopedKey(userId, conversationId))) as Promise<TRecord[]>;
  });
}

async function getRecord<TRecord extends ScopedRecord>(storeName: StoreName, key: UserScopeKey): Promise<TRecord | null> {
  return runTransaction([storeName], "readonly", async (transaction) => {
    const result = await requestToPromise<TRecord | undefined>(transaction.objectStore(storeName).get(key));
    return result ?? null;
  });
}

async function putRecord(storeName: StoreName, record: ScopedRecord): Promise<void> {
  await runTransaction([storeName], "readwrite", async (transaction) => {
    await requestToPromise(transaction.objectStore(storeName).put(record));
  });
}

async function deleteRecord(storeName: StoreName, key: UserScopeKey): Promise<void> {
  await runTransaction([storeName], "readwrite", async (transaction) => {
    await requestToPromise(transaction.objectStore(storeName).delete(key));
  });
}

async function deleteConversationRecords(userId: string, conversationId: string): Promise<void> {
  await runTransaction([CONVERSATIONS_STORE, MESSAGES_STORE, DRAFTS_STORE], "readwrite", async (transaction) => {
    await requestToPromise(transaction.objectStore(CONVERSATIONS_STORE).delete(scopedKey(userId, conversationId)));
    await requestToPromise(transaction.objectStore(DRAFTS_STORE).delete(scopedKey(userId, conversationId)));
    await deleteConversationScopedRecords(transaction.objectStore(MESSAGES_STORE), userId, conversationId);
  });
}

async function deleteConversationScopedRecords(
  store: IDBObjectStore,
  userId: string,
  conversationId: string
): Promise<void> {
  const index = store.index(USER_CONVERSATION_INDEX);

  await new Promise<void>((resolve, reject) => {
    const request = index.openKeyCursor(scopedKey(userId, conversationId));

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve();
        return;
      }

      const deleteRequest = store.delete(cursor.primaryKey);
      deleteRequest.onsuccess = () => {
        cursor.continue();
      };
      deleteRequest.onerror = () => {
        reject(
          new BrowserConversationStoreError(
            "request_failed",
            "Failed to delete a conversation-scoped record from chat storage.",
            deleteRequest.error
          )
        );
      };
    };

    request.onerror = () => {
      reject(
        new BrowserConversationStoreError(
          "request_failed",
          "Failed to scan conversation-scoped records in chat storage.",
          request.error
        )
      );
    };
  });
}

async function runTransaction<T>(storeNames: StoreName[], mode: IDBTransactionMode, work: (transaction: IDBTransaction) => Promise<T>) {
  const database = await openDatabase();

  const transaction = database.transaction(storeNames, mode);
  const completion = waitForTransaction(transaction);

  try {
    const result = await work(transaction);
    await completion;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Ignore abort errors when the transaction has already finished.
    }

    throw toStoreError(error, "transaction_failed", "Chat storage transaction failed.");
  }
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(new BrowserConversationStoreError("transaction_failed", "Chat storage transaction failed.", transaction.error));
    };

    transaction.onabort = () => {
      reject(new BrowserConversationStoreError("transaction_failed", "Chat storage transaction was aborted.", transaction.error));
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new BrowserConversationStoreError("request_failed", "A chat storage request failed.", request.error));
    };
  });
}

function createObjectStore(
  database: IDBDatabase,
  transaction: IDBTransaction,
  storeName: StoreName,
  keyPath: string[]
) {
  if (!database.objectStoreNames.contains(storeName)) {
    return database.createObjectStore(storeName, { keyPath });
  }

  return transaction.objectStore(storeName);
}

function createIndex(store: IDBObjectStore, indexName: string, keyPath: string | string[]) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, { unique: false });
  }
}

function toConversationRecord(record: ScopedConversationRecord): ChatConversationRecord {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toMessageRecord(record: ScopedMessageRecord): ChatMessageRecord {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toDraftRecord(record: ScopedDraftRecord): ChatDraftRecord {
  return {
    conversationId: record.conversationId,
    text: record.text,
    updatedAt: record.updatedAt
  };
}

function toUiStateRecord(record: ScopedUiStateRecord): ChatUiStateRecord {
  return {
    key: record.key,
    value: record.value,
    updatedAt: record.updatedAt
  };
}

function toPreferenceRecord(record: ScopedPreferenceRecord): ChatPreferenceRecord {
  return {
    key: record.key,
    value: record.value,
    updatedAt: record.updatedAt
  };
}

function sortByUpdatedAtDesc(left: { updatedAt: string }, right: { updatedAt: string }) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function sortByCreatedAtAsc(left: { createdAt: string }, right: { createdAt: string }) {
  return left.createdAt.localeCompare(right.createdAt);
}

function scopedKey(userId: string, entityId: string): UserScopeKey {
  return [userId, entityId];
}

function toStoreError(error: unknown, code: BrowserConversationStoreErrorCode, message: string) {
  if (error instanceof BrowserConversationStoreError) {
    return error;
  }

  return new BrowserConversationStoreError(code, message, error);
}
