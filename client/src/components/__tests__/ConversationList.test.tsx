import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ConversationList from '../ConversationList';
import { Conversation } from '../../types';

// Mock conversations data
const mockConversations: Conversation[] = [
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
    unreadCount: 2,
    priority: 'medium',
    category: 'personal',
    status: 'active',
    isAssistantEnabled: true,
    tags: [],
    createdAt: new Date('2023-09-01T00:00:00.000Z'),
    updatedAt: new Date('2023-09-03T10:00:00.000Z'),
  },
  {
    id: '2',
    contact: {
      id: '2',
      phone: '5511888888888-123456789@g.us',
      name: 'Work Group',
      profilePicture: null,
      isGroup: true,
      isBlocked: false,
      lastActivity: new Date('2023-09-03T09:00:00.000Z'),
      createdAt: new Date('2023-09-01T00:00:00.000Z'),
      updatedAt: new Date('2023-09-03T09:00:00.000Z'),
    },
    lastMessage: {
      id: '2',
      content: 'Meeting at 3 PM',
      sender: 'user',
      conversationId: '2',
      createdAt: new Date('2023-09-03T09:00:00.000Z'),
      updatedAt: new Date('2023-09-03T09:00:00.000Z'),
    },
    unreadCount: 0,
    priority: 'high',
    category: 'business',
    status: 'active',
    isAssistantEnabled: false,
    tags: [],
    createdAt: new Date('2023-09-01T00:00:00.000Z'),
    updatedAt: new Date('2023-09-03T09:00:00.000Z'),
  },
];

describe('ConversationList', () => {
  const mockProps = {
    conversations: mockConversations,
    selectedConversation: null,
    onConversationSelect: vi.fn(),
    onToggleAssistant: vi.fn(),
    onOpenSettings: vi.fn(),
    globalAssistantEnabled: true,
    onToggleGlobalAssistant: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Settings Icon (Gear Icon) Visibility', () => {
    it('renders settings icon in header on initial load', () => {
      render(<ConversationList {...mockProps} />);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible when switching to "All" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      // Click on "All" tab (should be active by default but let's click it)
      const allTab = screen.getByText('All');
      fireEvent.click(allTab);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible when switching to "Groups" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      // Click on "Groups" tab
      const groupsTab = screen.getByText('Groups');
      fireEvent.click(groupsTab);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible when switching to "Individual" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      // Click on "Individual" tab
      const individualTab = screen.getByText('Individual');
      fireEvent.click(individualTab);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible across all tab switches', () => {
      render(<ConversationList {...mockProps} />);
      
      // Test all tab combinations
      const tabs = ['Groups', 'Individual', 'All'];
      
      tabs.forEach(tabName => {
        const tab = screen.getByText(tabName);
        fireEvent.click(tab);
        
        const settingsButton = screen.getByTitle('Assistant Settings');
        expect(settingsButton).toBeInTheDocument();
        expect(settingsButton).toBeVisible();
      });
    });

    it('keeps settings icon visible when searching', () => {
      render(<ConversationList {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'John' } });
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible when no conversations match search', () => {
      render(<ConversationList {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });

    it('keeps settings icon visible with empty conversations list', () => {
      render(<ConversationList {...mockProps} conversations={[]} />);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toBeVisible();
    });
  });

  describe('Settings Icon Functionality', () => {
    it('calls onOpenSettings when settings icon is clicked', () => {
      render(<ConversationList {...mockProps} />);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      fireEvent.click(settingsButton);
      
      expect(mockProps.onOpenSettings).toHaveBeenCalledOnce();
    });

    it('settings icon has correct styling', () => {
      render(<ConversationList {...mockProps} />);
      
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toHaveClass('p-2');
      expect(settingsButton).toHaveClass('text-text-secondary');
      expect(settingsButton).toHaveClass('hover:text-text-primary');
      expect(settingsButton).toHaveClass('hover:bg-chat-hover');
      expect(settingsButton).toHaveClass('rounded-full');
      expect(settingsButton).toHaveClass('transition-colors');
    });
  });

  describe('Header Structure', () => {
    it('renders header with global assistant toggle and settings icon', () => {
      render(<ConversationList {...mockProps} />);
      
      // Check for global assistant toggle
      const assistantToggle = screen.getByTitle(/Assistant (Enabled|Disabled)/);
      expect(assistantToggle).toBeInTheDocument();
      
      // Check for settings icon
      const settingsButton = screen.getByTitle('Assistant Settings');
      expect(settingsButton).toBeInTheDocument();
      
      // Check for conversation count
      const conversationCount = screen.getByText('2 of 2');
      expect(conversationCount).toBeInTheDocument();
    });

    it('maintains header layout when changing tabs', () => {
      render(<ConversationList {...mockProps} />);
      
      const tabs = ['Groups', 'Individual', 'All'];
      
      tabs.forEach(tabName => {
        const tab = screen.getByText(tabName);
        fireEvent.click(tab);
        
        // All header elements should still be present
        expect(screen.getByTitle(/Assistant (Enabled|Disabled)/)).toBeInTheDocument();
        expect(screen.getByTitle('Assistant Settings')).toBeInTheDocument();
        expect(screen.getByText(/\d+ of \d+/)).toBeInTheDocument();
      });
    });
  });

  describe('Global Assistant Toggle', () => {
    it('shows correct state when assistant is enabled', () => {
      render(<ConversationList {...mockProps} globalAssistantEnabled={true} />);
      
      const assistantToggle = screen.getByTitle('Assistant Enabled - Click to disable');
      expect(assistantToggle).toBeInTheDocument();
      expect(assistantToggle).toHaveClass('text-whatsapp-green-500');
    });

    it('shows correct state when assistant is disabled', () => {
      render(<ConversationList {...mockProps} globalAssistantEnabled={false} />);
      
      const assistantToggle = screen.getByTitle('Assistant Disabled - Click to enable');
      expect(assistantToggle).toBeInTheDocument();
      expect(assistantToggle).toHaveClass('text-text-secondary');
    });

    it('calls onToggleGlobalAssistant when clicked', () => {
      render(<ConversationList {...mockProps} globalAssistantEnabled={true} />);
      
      const assistantToggle = screen.getByTitle('Assistant Enabled - Click to disable');
      fireEvent.click(assistantToggle);
      
      expect(mockProps.onToggleGlobalAssistant).toHaveBeenCalledWith(false);
    });
  });

  describe('Tab Filtering', () => {
    it('shows all conversations on "All" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      const allTab = screen.getByText('All');
      fireEvent.click(allTab);
      
      // Should show both individual and group conversations
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Work Group')).toBeInTheDocument();
    });

    it('shows only group conversations on "Groups" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      const groupsTab = screen.getByText('Groups');
      fireEvent.click(groupsTab);
      
      // Should show only group conversation
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Work Group')).toBeInTheDocument();
    });

    it('shows only individual conversations on "Individual" tab', () => {
      render(<ConversationList {...mockProps} />);
      
      const individualTab = screen.getByText('Individual');
      fireEvent.click(individualTab);
      
      // Should show only individual conversation
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Work Group')).not.toBeInTheDocument();
    });
  });
});