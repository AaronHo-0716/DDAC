import { UploadImageResponse } from "@/app/types";
import { apiClient } from "./client";

export const uploadsService = {
  async uploadJobImage(file: File): Promise<UploadImageResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient.postForm<UploadImageResponse>("/uploads/job-image", formData);
  },
};
