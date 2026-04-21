import { useState } from 'react';
import { cn } from '../../utils/cn';

interface ImageUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

export function ImageUpload({ files, onChange, maxFiles = 5 }: ImageUploadProps) {
  // We use this to change the border color when a user drags a file over the box
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelection = (newFiles: FileList | null) => {
    if (!newFiles) return;

    // 1. Convert FileList to an Array
    const incomingFiles = Array.from(newFiles);

    // 2. Filter for safety: Only .jpg and under 4MB
    const validFiles = incomingFiles.filter(file => {
      const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg';
      const isUnderLimit = file.size <= 4 * 1024 * 1024; // 4MB
      return isJpg && isUnderLimit;
    });

    // 3. Combine with existing files and respect the limit (max 5)
    const updated = [...files, ...validFiles].slice(0, maxFiles);
    onChange(updated);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Species Photos ({files.length}/{maxFiles})
      </label>
      
      {/* DRAG & DROP ZONE */}
      <div
        // Visual effects for dragging
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileSelection(e.dataTransfer.files);
        }}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer",
          isDragging 
            ? "border-cactus-500 bg-cactus-50/50 dark:bg-cactus-900/20" 
            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        )}
      >
        {/* Hidden file input that gets triggered when clicking the box */}
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => handleFileSelection(e.target.files)}
        />
        
        <div className="text-3xl mb-2">🌵</div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {files.length > 0 ? "Choose files or drag & drop to add more" : "Choose files or drag & drop it here"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Max 4MB per image. Recommended .jpg/.jpeg
        </p>
      </div>

      {/* IMAGE PREVIEW GRID */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
              <img 
                // URL.createObjectURL creates a temporary link to show the file on screen
                src={URL.createObjectURL(file)} 
                className="w-full h-full object-cover" 
                alt="preview" 
              />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}