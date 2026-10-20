import { apiClient } from './apiClient';
import type { ApiResponse } from './types';

export interface AiChatRequest {
  message: string;
  context?: string;
}

export interface AiActionPlan {
  action: 'none' | 'scheduleTrip' | 'createMaintenance';
  assistantMessage: string;
  trip?: {
    vehicleNumber?: string | null;
    driverEmail?: string | null;
    source?: string | null;
    destination?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  maintenance?: {
    vehicleNumber?: string | null;
    serviceType?: string | null;
    description?: string | null;
    scheduledDate?: string | null;
    cost?: number | null;
    vendor?: string | null;
  } | null;
}

export const askAiAssistant = async (request: AiChatRequest) => {
  const response = await apiClient.post<ApiResponse<string>>('/ai/AiAssistant/chat', request);
  return response.data;
};

export const planAiAction = async (request: AiChatRequest) => {
  const response = await apiClient.post<AiActionPlan>('/ai/AiAssistant/plan-action', request);
  return response.data;
};
