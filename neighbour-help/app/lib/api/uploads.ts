import { Job } from "@/app/types";
import { apiClient } from "./client";

export const uploadsService = {
  async uploadJobImage(file: File, targetId: string): Promise<Job> {
    const formData = new FormData();
    formData.append("File", file);
    formData.append("UploadType", "JobImage");
    formData.append("TargetId", targetId);

    return apiClient.postForm<Job>("/uploads", formData);
  },
};
