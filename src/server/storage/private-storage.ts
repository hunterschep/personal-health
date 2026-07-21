export interface PrivateStorage {
  put(input: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
    contentType: string;
    size: number;
  }): Promise<{ storageKey: string; sha256: string }>;

  get(storageKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    size: number;
  }>;

  delete(storageKey: string): Promise<void>;
}
