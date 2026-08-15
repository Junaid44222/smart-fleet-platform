import { apiClient } from './apiClient';
import type { ApiResponse } from './types';

export interface AiChatRequest {
  message: string;
  context?: string;
}

export const askAiAssistant = async (request: AiChatRequest) => {
  const response = await apiClient.post<ApiResponse<string>>('/ai/AiAssistant/chat', request);
  return response.data;
};
