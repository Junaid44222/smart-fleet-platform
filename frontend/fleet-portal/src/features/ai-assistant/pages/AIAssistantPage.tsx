import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  AutoAwesome,
  Route as RouteIcon,
  TrendingUp,
  WarningAmber,
} from '@mui/icons-material';
import { isAxiosError } from 'axios';
import PageHeader from '../../../components/PageHeader';
import { askAiAssistant } from '../../../api/aiApi';

const insightCards = [
  {
    title: 'Incident triage',
    description: 'Surface high-risk vehicles and overdue maintenance before they impact operations.',
    icon: <WarningAmber color="error" />,
  },
  {
    title: 'Route optimisation',
    description: 'Recommend efficient dispatch changes based on live fleet density and service windows.',
    icon: <RouteIcon color="primary" />,
  },
  {
    title: 'Consumption insights',
    description: 'Identify fuel anomalies and suggest corrective actions for underperforming units.',
    icon: <TrendingUp color="success" />,
  },
];

const prompts = [
  'Summarise urgent maintenance issues for the next 24 hours.',
  'Which vehicles are likely to exceed fuel budgets this month?',
  'Suggest the best dispatch plan for today’s active routes.',
];

const AIAssistantPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ severity: 'warning' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handlePromptSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse(null);
    setNotice(null);

    try {
      const result = await askAiAssistant({ message: prompt.trim() });
      if (!result.success) {
        setNotice({
          severity: 'warning',
          message: result.message || 'The AI assistant could not generate a response.',
        });
        return;
      }

      setResponse(result.data || result.message || 'No response received from the AI assistant.');
    } catch (error) {
      const serverMessage = isAxiosError<{ message?: string; title?: string }>(error)
        ? error.response?.data?.message ?? error.response?.data?.title
        : undefined;
      setNotice({
        severity: 'error',
        message: serverMessage || 'Unable to reach the AI assistant. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptChip = (value: string) => {
    setPrompt(value);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask for operational summaries, recommendations, and fleet risk alerts."
        onBack={() => navigate(-1)}
      />

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h3">Fleet copilot</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Use conversational prompts to accelerate planning and uncover operational issues.
              </Typography>
            </Box>
            <Chip icon={<AutoAwesome />} label="AI assistant" color="primary" />
          </Box>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Type a prompt or choose a quick example
            </Typography>

            <Box component="form" onSubmit={handlePromptSubmit} sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Ask the AI assistant"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                fullWidth
                helperText="Type a question about fleet operations or maintenance"
              />
              <Button type="submit" variant="contained" disabled={isLoading || !prompt.trim()}>
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              {prompts.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  variant="outlined"
                  onClick={() => handlePromptChip(option)}
                  clickable
                />
              ))}
            </Box>
          </Paper>

          {notice && (
            <Alert severity={notice.severity}>{notice.message}</Alert>
          )}

          {response && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Assistant response
              </Typography>
              <Typography>{response}</Typography>
            </Paper>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {insightCards.map((card) => (
          <Card key={card.title}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                {card.icon}
                <Typography variant="h3">{card.title}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {card.description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default AIAssistantPage;
