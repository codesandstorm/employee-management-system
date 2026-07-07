import React from 'react';
import { Empty, Button } from 'antd';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  description,
  actionText,
  onAction,
  icon
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '48px 24px',
      background: 'var(--bg-card)',
      border: '1px dashed var(--border-color)',
      borderRadius: '12px',
      textAlign: 'center',
      width: '100%'
    }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        imageStyle={{ height: 60, color: 'var(--accent-color)' }}
        description={
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
            {description}
          </span>
        }
      >
        {actionText && onAction && (
          <Button 
            type="primary" 
            onClick={onAction}
            style={{ marginTop: '12px' }}
          >
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
};
