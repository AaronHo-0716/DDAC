import { apiClient } from "./client";

interface RawCheckoutSessionResponse {
  checkoutUrl?: string | null;
  sessionId?: string | null;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export const paymentsService = {
  async createCheckoutSession(jobId: string): Promise<CheckoutSessionResponse> {
    const response = await apiClient.post<RawCheckoutSessionResponse>(
      `/payments/jobs/${jobId}/checkout-session`,
      {}
    );

    const checkoutUrl = response.checkoutUrl ?? "";
    const sessionId = response.sessionId ?? "";

    if (!checkoutUrl || !sessionId) {
      throw new Error("Invalid payment session response from server.");
    }

    return {
      checkoutUrl,
      sessionId,
    };
  },
};
