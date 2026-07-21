/**
 * src/lib/cloudinary.ts
 * Cloudinary upload and fetch utilities for JSON archival.
 * Config is read from environment variables via env.ts.
 */
import { CLOUDINARY_CONFIG } from './firebase';

const { cloudName, uploadPreset, folderPrefix } = CLOUDINARY_CONFIG;

/**
 * Upload a JSON-serializable object to Cloudinary as a raw file.
 * Returns the secure URL of the uploaded file.
 */
export async function uploadJSONToCloudinary(filename: string, data: unknown): Promise<string> {
  const jsonString = JSON.stringify(data);
  const blob = new Blob([jsonString], { type: 'application/json' });

  const publicId = `${folderPrefix}${filename.replace('.json', '')}`;

  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('upload_preset', uploadPreset);
  formData.append('public_id', publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const result = await response.json();
  return result.secure_url as string;
}

/**
 * Fetch and parse a JSON file from Cloudinary.
 * Returns null if the file does not exist (404).
 */
export async function fetchJSONFromCloudinary(filename: string): Promise<unknown> {
  // Cache-bust with timestamp to always get the latest version
  const url = `https://res.cloudinary.com/${cloudName}/raw/upload/v1/${folderPrefix}${filename}?t=${Date.now()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Cloudinary fetch failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Cloudinary] fetch error:', error);
    return null;
  }
}
