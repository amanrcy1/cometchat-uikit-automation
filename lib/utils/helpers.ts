import path from 'path';
import fs from 'fs';

/** Generate a unique name with prefix + timestamp + random suffix */
export function uniqueName(prefix = 'Test'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

/** Resolve a test-data file path and assert it exists */
export function testDataPath(filename: string): string {
  const p = path.resolve(__dirname, '..', '..', 'test-data', filename);
  if (!fs.existsSync(p)) {
    throw new Error(`Test data file not found: ${p}`);
  }
  return p;
}

/**
 * Media file paths.
 * @deprecated Use TestConfig.testData instead — this is kept for backward compatibility.
 */
export const MEDIA = {
  image: () => testDataPath('sample-image.jpg'),
  video: () => testDataPath('sample-video.mp4'),
  audio: () => testDataPath('sample-audio.mp3'),
  pdf:   () => testDataPath('sample-file.pdf'),
};

/** Test user data from env */
export const USERS = {
  get primary()   { return process.env.PRIMARY_UID || 'cometchat-uid-1'; },
  get secondary()  { return process.env.SECONDARY_UID || 'cometchat-uid-2'; },
  get chatTarget() { return process.env.CHAT_TARGET_USER || 'George Alan'; },
};

// ─── Media Type & File Helper (merged from file-helper.ts) ───

export type MediaType = 'image' | 'video' | 'audio' | 'pdf';

/**
 * Returns the absolute file path for a given media type.
 * Throws if the file doesn't exist so tests fail fast with a clear message.
 */
export function getTestFilePath(type: MediaType): string {
  const pathMap: Record<MediaType, string> = {
    image: testDataPath('sample-image.jpg'),
    video: testDataPath('sample-video.mp4'),
    audio: testDataPath('sample-audio.mp3'),
    pdf: testDataPath('sample-file.pdf'),
  };

  const filePath = pathMap[type];

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Test data file not found: ${filePath}\n` +
        `Please place your ${type} file in the test-data/ folder.`
    );
  }

  return filePath;
}
