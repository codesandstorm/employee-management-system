import { message } from 'antd';

// Standardized notification duration (in seconds)
const DEFAULT_DURATION = 3.5;

export const notify = {
  success: (content: string, duration = DEFAULT_DURATION) => {
    message.success({
      content,
      duration,
      style: {
        marginTop: '8vh',
      },
    });
  },
  error: (content: string, duration = DEFAULT_DURATION) => {
    message.error({
      content,
      duration,
      style: {
        marginTop: '8vh',
      },
    });
  },
  warning: (content: string, duration = DEFAULT_DURATION) => {
    message.warning({
      content,
      duration,
      style: {
        marginTop: '8vh',
      },
    });
  },
  info: (content: string, duration = DEFAULT_DURATION) => {
    message.info({
      content,
      duration,
      style: {
        marginTop: '8vh',
      },
    });
  },
  loading: (content: string) => {
    return message.loading({
      content,
      duration: 0, // Keeps it visible until manual closure callback is called
      style: {
        marginTop: '8vh',
      },
    });
  }
};
