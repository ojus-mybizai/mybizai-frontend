'use client';

import { useState, type ChangeEvent } from 'react';

interface ImageUploaderMockProps {
  images: string[];
  onChange: (next: string[]) => void;
}

export function ImageUploaderMock({ images, onChange }: ImageUploaderMockProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    setError(null);
    const next = [...images];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToDataUrl(file);
        next.push(dataUrl);
      } catch {
        setError('Failed to load image');
      }
    }
    onChange(next);
    setUploading(false);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleRemove = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = images.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFiles(e.target.files)}
        />
        <span>Upload images (mock)</span>
        {isUploading && <span className="text-xs text-text-secondary">Uploading…</span>}
      </label>
      {error && <div className="text-xs text-red-600">{error}</div>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-border-color bg-bg-primary">
              <img src={url} alt={`Image ${index + 1}`} className="h-24 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/50 px-1.5 py-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    className="rounded-sm bg-bg-secondary px-1 text-[10px] text-text-secondary hover:text-text-primary"
                    aria-label="Move image up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    className="rounded-sm bg-bg-secondary px-1 text-[10px] text-text-secondary hover:text-text-primary"
                    aria-label="Move image down"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="rounded-sm bg-bg-secondary px-1 text-[10px] text-text-secondary hover:text-text-primary"
                  aria-label={`Remove image ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
