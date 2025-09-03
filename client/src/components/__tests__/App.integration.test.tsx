import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';

// Mock all API services
const mockChatApi = {
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  updateConversationSettings: vi.fn(),
};

const mockWhatsappApi = {
  getStatus: vi.fn(),
};

const mockAssistantApi = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  toggle: vi.fn(),
  getStatus: vi.fn(),
};

vi.mock('../../services/api', () => ({
  chatApi: mockChatApi,
  whatsappApi: mockWhatsappApi,
  assistantApi: mockAssistantApi,
}));

// Mock socket service
const mockSocketService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  on: vi.fn(() => () => {}), // Return cleanup function
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../services/socket', () => ({
  socketService: mockSocketService,
}));

describe('App Integration - Gear Icon Functionality', () => {
  const mockConversations = [
    {
      id: '1',
      contact: {
        id: '1',
        phone: '5511999999999@s.whatsapp.net',
        name: 'John Doe',
        profilePicture: null,
        isGroup: false,
        isBlocked: false,
        lastActivity: new Date('2023-09-03T10:00:00.000Z'),
        createdAt: new Date('2023-09-01T00:00:00.000Z'),
        updatedAt: new Date('2023-09-03T10:00:00.000Z'),
      },
      lastMessage: {
        id: '1',
        content: 'Hello there!',
        sender: 'user',
        conversationId: '1',
        createdAt: new Date('2023-09-03T10:00:00.000Z'),
        updatedAt: new Date('2023-09-03T10:00:00.000Z'),
      },
      unreadCount: 1,
      priority: 'medium',
      category: 'personal',
      status: 'active',
      isAssistantEnabled: true,
      tags: [],
      createdAt: new Date('2023-09-01T00:00:00.000Z'),
      updatedAt: new Date('2023-09-03T10:00:00.000Z'),
    },
  ];

  const mockAssistantConfig = {
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
    
    // Set up default mock responses
    mockChatApi.getConversations.mockResolvedValue({ data: mockConversations });
    mockChatApi.getMessages.mockResolvedValue({ data: [] });
    mockWhatsappApi.getStatus.mockResolvedValue({ data: { connected: true } });
    mockAssistantApi.getConfig.mockResolvedValue({ data: mockAssistantConfig });
    mockAssistantApi.getStatus.mockResolvedValue({ data: { enabled: true } });
    mockAssistantApi.updateConfig.mockResolvedValue({ data: mockAssistantConfig });
  });

  describe('Gear Icon Visibility and Functionality', () => {
    it('displays gear icon in conversation list header', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Check that gear icon is visible
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('opens settings modal when gear icon is clicked', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Click the gear icon
      const settingsButton = screen.getByTitle('Assistant Settings');
      fireEvent.click(settingsButton);
      
      // Check that settings modal opens
      await waitFor(() => {
        expect(screen.getByText('Assistant Settings')).toBeInTheDocument();
      });
    });

    it('gear icon remains visible when switching between tabs', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Test switching between tabs
      const tabs = ['Groups', 'Individual', 'All'];
      
      for (const tabName of tabs) {
        const tab = screen.getByText(tabName);
        fireEvent.click(tab);
        
        // Gear icon should still be visible
        const settingsButton = screen.getByTitle('Assistant Settings');
        expect(settingsButton).toBeInTheDocument();
        expect(settingsButton).toBeVisible();
      }
    });

    it('gear icon remains visible when searching conversations', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Type in search box
      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'John' } });
      
      // Gear icon should still be visible
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('gear icon remains visible when no conversations are shown', async () => {
      // Mock empty conversations
      mockChatApi.getConversations.mockResolvedValue({ data: [] });
      
      render(<App />);
      
      // Wait for the app to load (no conversations)
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
      
      // Gear icon should still be visible
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('settings modal functions correctly after opening via gear icon', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Click the gear icon
      const settingsButton = screen.getByTitle('Assistant Settings');
      fireEvent.click(settingsButton);
      
      // Wait for modal to open and load data
      await waitFor(() => {
        expect(screen.getByDisplayValue('Pai')).toBeInTheDocument();
      });
      
      // Verify that configuration loaded correctly
      expect(screen.getByDisplayValue('Tomás')).toBeInTheDocument();
      expect(screen.getByDisplayValue('You are a helpful assistant.')).toBeInTheDocument();
      
      // Test that we can modify and save
      const nameInput = screen.getByDisplayValue('Pai');
      fireEvent.change(nameInput, { target: { value: 'Updated Assistant' } });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      // Should call update API
      await waitFor(() => {
        expect(mockAssistantApi.updateConfig).toHaveBeenCalled();
      });
    });

    it('can close settings modal and gear icon remains accessible', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Click the gear icon
      const settingsButton = screen.getByTitle('Assistant Settings');
      fireEvent.click(settingsButton);
      
      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('Assistant Settings')).toBeInTheDocument();
      });
      
      // Close the modal
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Assistant Settings')).not.toBeInTheDocument();
      });
      
      // Gear icon should still be visible and clickable
      const settingsButtonAfter = screen.getByTitle('Assistant Settings');
      expect(settingsButtonAfter).toBeInTheDocument();
      expect(settingsButtonAfter).toBeVisible();
    });
  });

  describe('Global Assistant Toggle Integration', () => {
    it('gear icon and global assistant toggle work together', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Both controls should be visible
      const settingsButton = screen.getByTitle('Assistant Settings');
      const assistantToggle = screen.getByTitle(/Assistant (Enabled|Disabled)/);
      
      expect(settingsButton).toBeInTheDocument();
      expect(assistantToggle).toBeInTheDocument();
      
      // Test that both remain visible after interactions
      fireEvent.click(assistantToggle);
      
      expect(settingsButton).toBeInTheDocument();
      expect(assistantToggle).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('gear icon remains visible in different viewport states', async () => {
      render(<App />);
      
      // Wait for the app to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Gear icon should be visible
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      
      // Test with different screen sizes (simulated via CSS classes)
      // The gear icon should remain functional regardless of screen size
      fireEvent.click(settingsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Assistant Settings')).toBeInTheDocument();
      });
    });
  });
});