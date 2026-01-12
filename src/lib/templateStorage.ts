/**
 * Template Storage Utility
 * Uses local server endpoints for storing custom template images
 */
import { getAuthToken } from "@/lib/auth";

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  uploadedAt: number;
  type: 'custom';
}

interface TemplateUploadPayload {
  name: string;
  description: string;
  imageData: string;
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    return payload?.error || `Request gagal (${response.status})`;
  } catch {
    return `Request gagal (${response.status})`;
  }
};

class TemplateStorageService {
  async uploadTemplate(payload: TemplateUploadPayload): Promise<CustomTemplate> {
    const token = getAuthToken();
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    return response.json();
  }

  async getTemplates(): Promise<CustomTemplate[]> {
    const token = getAuthToken();
    const response = await fetch('/api/templates', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  }

  async getTemplate(id: string): Promise<CustomTemplate | null> {
    const token = getAuthToken();
    const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return response.json();
  }

  async deleteTemplate(id: string): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
  }
}

export const templateStorage = new TemplateStorageService();
export type { CustomTemplate, TemplateUploadPayload };
