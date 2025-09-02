import React from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { classNames } from '../utils';

interface Props {
  onClick: () => void;
  className?: string;
}

const SettingsIcon: React.FC<Props> = ({ onClick, className }) => {
  return (
    <button 
      className={classNames(
        'p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full transition-colors',
        className
      )}
      onClick={onClick}
      title="Assistant Settings"
    >
      <Cog6ToothIcon className="h-5 w-5" />
    </button>
  );
};

export default SettingsIcon;