import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export const formatMessageTime = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  return format(date, 'MMM dd');
};

export const formatLastSeen = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  return formatDistanceToNow(date, { addSuffix: true });
};

export const getContactInitials = (name: string): string => {
  if (!name) return '?';
  
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

export const formatPhoneNumber = (phone: string): string => {
  // Remove WhatsApp suffixes
  const cleaned = phone.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '');
  
  // Format if it looks like a phone number
  if (/^\d+$/.test(cleaned) && cleaned.length >= 10) {
    // Basic international format
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 $2-$3-$4');
    }
    if (cleaned.length >= 12) {
      return '+' + cleaned;
    }
  }
  
  return cleaned;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-green-400';
    default:
      return 'text-text-secondary';
  }
};

export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'support':
      return 'text-blue-400';
    case 'sales':
      return 'text-green-400';
    case 'personal':
      return 'text-purple-400';
    case 'spam':
      return 'text-red-400';
    default:
      return 'text-text-secondary';
  }
};

export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};