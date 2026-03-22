import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-primary-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">页面未找到</h1>
        <p className="text-gray-600 mb-8">抱歉，您访问的页面不存在或已被移除。</p>
        <Link to="/dashboard">
          <Button>返回首页</Button>
        </Link>
      </div>
    </div>
  );
};
