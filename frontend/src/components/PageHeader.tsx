import React, { useEffect } from 'react';
import { Breadcrumb, Space } from 'antd';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  title: React.ReactNode;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  extra
}) => {
  // Update browser document title
  useEffect(() => {
    document.title = `${title} | HR Enterprise`;
  }, [title]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
      {/* BREADCRUMBS */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb style={{ fontSize: '12px' }}>
          <Breadcrumb.Item>
            <Link to="/">Home</Link>
          </Breadcrumb.Item>
          {breadcrumbs.map((item, idx) => (
            <Breadcrumb.Item key={idx}>
              {item.path ? <Link to={item.path}>{item.title}</Link> : item.title}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}

      {/* HEADER ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {title}
          </h1>
          {description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0 0' }}>
              {description}
            </p>
          )}
        </div>
        {extra && (
          <Space className="mobile-stack-buttons">
            {extra}
          </Space>
        )}
      </div>
    </div>
  );
};
