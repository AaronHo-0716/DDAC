"use client";

import { Upload, X } from "lucide-react";
import { useRef } from "react";

interface ImageUploaderProps {
  files: File[];
  onChange: (next: File[]) => void;
  maxFiles?: number;
}

export default function ImageUploader({
  files,
  onChange,
  maxFiles = 5,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleAdd = (incoming: FileList | null) => {
    if (!incoming) return;
    const selected = Array.from(incoming);
    const merged = [...files, ...selected].slice(0, maxFiles);
    onChange(merged);
  };

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-[#E5E7EB] rounded-2xl p-10 text-center hover:border-[#0B74FF] hover:bg-blue-50/20 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-9 h-9 text-[#9CA3AF] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#111827] mb-1">Drag and drop photos here</p>
        <p className="text-xs text-[#6B7280] mb-4">
          PNG, JPG or HEIC · up to 10 MB each · max {maxFiles} files
        </p>
        <button
          type="button"
          className="inline-flex items-center justify-center px-4 py-2 border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#111827] hover:bg-[#F7F8FA] transition-colors"
        >
          Browse Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleAdd(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-xl px-3 py-2"
            >
              <p className="text-sm text-[#374151] truncate pr-3">{file.name}</p>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="w-7 h-7 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
