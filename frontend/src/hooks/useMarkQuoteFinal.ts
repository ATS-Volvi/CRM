import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

export interface ApprovalFeedback {
  title: string;
  message: string;
}

export function useMarkQuoteFinal() {
  const queryClient = useQueryClient();
  const [approvalFeedback, setApprovalFeedback] = useState<ApprovalFeedback | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const markFinalMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiClient.post(`/api/v1/quotes/${quoteId}/mark-final`, {});
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-approvals"] });

      const data = res?.data || res;
      if (data?.approvalRequired) {
        setApprovalFeedback({
          title: "Approval Required from Manager",
          message: data.message || "This exceeds your approval limit and has been sent to your manager for approval."
        });
      } else {
        setStatusMessage("Marked as Final Agreed Quote & Delivered!");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    },
    onError: (err: any) => {
      alert("Failed to mark quote as final: " + (err?.response?.data?.error || err?.message || "Unknown error"));
    }
  });

  return {
    markFinal: (quoteId: string) => markFinalMutation.mutate(quoteId),
    isLoading: markFinalMutation.isPending,
    isPending: markFinalMutation.isPending,
    approvalFeedback,
    setApprovalFeedback,
    statusMessage,
    setStatusMessage
  };
}
