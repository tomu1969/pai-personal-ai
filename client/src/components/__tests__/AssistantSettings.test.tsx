import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssistantSettings from '../AssistantSettings';

// Mock the API
const mockApi = {
  assistantApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
  },
};

vi.mock('../../services/api', () => mockApi);

describe('AssistantSettings', () => {
  const mockOnClose = vi.fn();
  
  const mockConfig = {
    enabled: true,
    assistantName: 'Pai',
    ownerName: 'Tomás',
    systemPrompt: 'You are a helpful assistant.',
    autoResponseTemplate: 'Hi {{contact_name}}! This is {{owner_name}}\'s AI assistant.',
    messageTypes: {
      text: true,
      image: true,
      audio: false,
      video: false,
      document: true,
    },
    settings: {
      cooldownMinutes: 30,
      maxTokens: 500,
      temperature: 0.7,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.assistantApi.getConfig.mockResolvedValue({ data: mockConfig });
    mockApi.assistantApi.updateConfig.mockResolvedValue({ data: mockConfig });
  });

  describe('Modal Rendering', () => {
    it('renders modal when isOpen is true', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Assistant Settings')).toBeInTheDocument();
      });
    });

    it('does not render modal when isOpen is false', () => {
      render(<AssistantSettings isOpen={false} onClose={mockOnClose} />);
      
      expect(screen.queryByText('Assistant Settings')).not.toBeInTheDocument();
    });

    it('loads and displays configuration data', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Pai')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Tomás')).toBeInTheDocument();
        expect(screen.getByDisplayValue('You are a helpful assistant.')).toBeInTheDocument();
      });
      
      expect(mockApi.assistantApi.getConfig).toHaveBeenCalledOnce();
    });
  });

  describe('Form Interactions', () => {
    it('updates assistant name field', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Pai')).toBeInTheDocument();
      });
      
      const nameInput = screen.getByDisplayValue('Pai');
      fireEvent.change(nameInput, { target: { value: 'Assistant' } });
      
      expect(screen.getByDisplayValue('Assistant')).toBeInTheDocument();
    });

    it('updates owner name field', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Tomás')).toBeInTheDocument();
      });
      
      const ownerInput = screen.getByDisplayValue('Tomás');
      fireEvent.change(ownerInput, { target: { value: 'John' } });
      
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    });

    it('updates system prompt textarea', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('You are a helpful assistant.')).toBeInTheDocument();
      });
      
      const promptTextarea = screen.getByDisplayValue('You are a helpful assistant.');
      fireEvent.change(promptTextarea, { target: { value: 'Updated prompt' } });
      
      expect(screen.getByDisplayValue('Updated prompt')).toBeInTheDocument();
    });

    it('toggles message type preferences', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Message Types')).toBeInTheDocument();
      });
      
      // Find text message toggle (should be enabled by default)
      const textToggle = screen.getByLabelText(/Text Messages/i);
      expect(textToggle).toBeChecked();
      
      // Click to toggle it off
      fireEvent.click(textToggle);
      expect(textToggle).not.toBeChecked();
    });
  });

  describe('Save and Close Actions', () => {
    it('saves configuration when Save button is clicked', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockApi.assistantApi.updateConfig).toHaveBeenCalled();
      });
    });

    it('calls onClose when Cancel button is clicked', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when X button is clicked', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      });
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('closes modal after successful save', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Pai')).toBeInTheDocument();
      });
      
      // Clear required field
      const nameInput = screen.getByDisplayValue('Pai');
      fireEvent.change(nameInput, { target: { value: '' } });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Assistant name is required/i)).toBeInTheDocument();
      });
    });

    it('prevents saving with invalid configuration', async () => {
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Tomás')).toBeInTheDocument();
      });
      
      // Clear required field
      const ownerInput = screen.getByDisplayValue('Tomás');
      fireEvent.change(ownerInput, { target: { value: '' } });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      // Should not call API with invalid data
      await waitFor(() => {
        expect(mockApi.assistantApi.updateConfig).not.toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching configuration', () => {
      // Mock a pending promise
      mockApi.assistantApi.getConfig.mockImplementation(() => new Promise(() => {}));
      
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows saving state while updating configuration', async () => {
      // Mock a slow save operation
      mockApi.assistantApi.updateConfig.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: mockConfig }), 1000))
      );
      
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      // Should show saving state
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles configuration load error gracefully', async () => {
      mockApi.assistantApi.getConfig.mockRejectedValue(new Error('Network error'));
      
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText(/error loading configuration/i)).toBeInTheDocument();
      });
    });

    it('handles save error gracefully', async () => {
      mockApi.assistantApi.updateConfig.mockRejectedValue(new Error('Save failed'));
      
      render(<AssistantSettings isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error saving configuration/i)).toBeInTheDocument();
      });
    });
  });
});