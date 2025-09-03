import '@testing-library/jest-dom';

// Mock utils functions to avoid date formatting issues
vi.mock('../utils', () => ({
  formatMessageTime: vi.fn((timestamp) => '10:00'),
  formatLastSeen: vi.fn((timestamp) => '2 hours ago'),
  getContactInitials: vi.fn((name) => name ? name.charAt(0).toUpperCase() : '?'),
  formatPhoneNumber: vi.fn((phone) => phone),
  truncateText: vi.fn((text, length = 50) => text.length > length ? text.substring(0, length) + '...' : text),
  getPriorityColor: vi.fn((priority) => 'text-gray-500'),
  classNames: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  })),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});