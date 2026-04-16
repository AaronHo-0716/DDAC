import { apiClient } from "./client";

export const uploadsService = {
  async uploadJobImage(file: File, targetId: string): Promise<void> {
    const formData = new FormData();
    formData.append("File", file);
    formData.append("UploadType", "JobImage");
    formData.append("TargetId", targetId);

    await apiClient.postForm<unknown>("/uploads", formData);
  },
};
