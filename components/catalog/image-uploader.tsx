'use client';

import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react';
import { uploadCatalogImages } from '@/lib/catalog-api';

interface ImageUploaderProps {
  images: string[];
  onChange: (next: string[]) => void;
}

export default function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setIsUploading(true);
      setError(null);

      const fileArray = Array.from(fileList);
      const next = images.slice();
      try {
        const results = await uploadCatalogImages(fileArray);
        for (const r of results) next.push(r.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload images';
        setError(message);
      }
      onChange(next);
      setIsUploading(false);
    },
    [images, onChange],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

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
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${
          isDragging
            ? 'border-accent bg-accent-soft text-text-primary'
            : 'border-border-color bg-bg-primary text-text-secondary'
        }`}
      >
        <p className="mb-2">Drag and drop images here, or click to browse</p>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary">
          <span>Choose files</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleInputChange} />
        </label>
        {isUploading && (
          <div className="mt-2 text-xs text-text-secondary">Uploading images...</div>
        )}
        {error && (
          <div className="mt-2 text-xs text-red-600">{error}</div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative overflow-hidden rounded-lg border border-border-color bg-bg-primary"
            >
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
