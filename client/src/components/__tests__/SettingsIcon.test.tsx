import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsIcon from '../SettingsIcon';

describe('SettingsIcon', () => {
  it('renders the settings icon button', () => {
    const mockOnClick = vi.fn();
    render(<SettingsIcon onClick={mockOnClick} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Assistant Settings');
  });

  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn();
    render(<SettingsIcon onClick={mockOnClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    const mockOnClick = vi.fn();
    const customClass = 'custom-test-class';
    render(<SettingsIcon onClick={mockOnClick} className={customClass} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(customClass);
  });

  it('has correct base CSS classes', () => {
    const mockOnClick = vi.fn();
    render(<SettingsIcon onClick={mockOnClick} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('p-2');
    expect(button).toHaveClass('text-text-secondary');
    expect(button).toHaveClass('hover:text-text-primary');
    expect(button).toHaveClass('hover:bg-chat-hover');
    expect(button).toHaveClass('rounded-full');
    expect(button).toHaveClass('transition-colors');
  });

  it('contains the gear/cog icon', () => {
    const mockOnClick = vi.fn();
    render(<SettingsIcon onClick={mockOnClick} />);
    
    // Check for the SVG icon (Cog6ToothIcon)
    const svgIcon = screen.getByRole('button').querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveClass('h-5', 'w-5');
  });
});