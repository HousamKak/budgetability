import { useState, useRef } from "react";
import { Upload, Link, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paperTheme } from "@/styles";
import { cn } from "@/lib/utils";
import { dataService } from "@/lib/data-service";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  className?: string;
}

/**
 * Image uploader supporting both URL paste and file upload
 */
export function ImageUploader({ value, onChange, className }: ImageUploaderProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const url = await dataService.uploadSavingsGoalImage(file);
      onChange(url);
    } catch (err) {
      setError("Failed to upload image");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;

    // Basic URL validation
    try {
      new URL(urlInput);
      onChange(urlInput);
      setUrlInput("");
      setError(null);
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const handleRemove = async () => {
    if (value && !value.startsWith("data:") && !value.startsWith("http")) {
      // It's a Supabase storage path, delete it
      try {
        await dataService.deleteSavingsGoalImage(value);
      } catch (err) {
        console.error("Failed to delete image:", err);
      }
    }
    onChange(undefined);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Preview */}
      {value && (
        <div className="relative group">
          <img
            src={value}
            alt="Goal preview"
            className={cn(
              "w-full h-40 object-cover rounded-lg",
              paperTheme.colors.borders.amber
            )}
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Upload/URL toggle */}
      {!value && (
        <>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "upload" ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1",
                mode === "upload" && "bg-amber-500 hover:bg-amber-600"
              )}
              onClick={() => setMode("upload")}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
            <Button
              type="button"
              variant={mode === "url" ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1",
                mode === "url" && "bg-amber-500 hover:bg-amber-600"
              )}
              onClick={() => setMode("url")}
            >
              <Link className="w-4 h-4 mr-1" />
              URL
            </Button>
          </div>

          {mode === "upload" ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer",
                "hover:bg-amber-50/50 transition-colors",
                paperTheme.colors.borders.amber
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              {uploading ? (
                <div className="space-y-2">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-stone-500">Uploading...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImageIcon className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm text-stone-500">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-stone-400">PNG, JPG up to 5MB</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg border text-sm",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
              <Button
                type="button"
                onClick={handleUrlSubmit}
                className="bg-amber-500 hover:bg-amber-600"
                disabled={!urlInput.trim()}
              >
                Add
              </Button>
            </div>
          )}
        </>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default ImageUploader;
