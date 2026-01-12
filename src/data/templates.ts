export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  layout: 'centered' | 'left-aligned' | 'compact';
  type?: 'default' | 'custom';
  imageUrl?: string; // For custom uploaded templates
}

export const templates: Template[] = [];
