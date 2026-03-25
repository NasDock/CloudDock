import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginInput } from '@/utils/validators';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoggingIn, loginError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      await login(data);
    } catch {
      // Error handled by useAuth
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="CloudDock" className="w-12 h-12 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">CloudDock</h1>
          <p className="text-gray-600 mt-1">安全访问家庭内部服务</p>
        </div>

        <Card padding="lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">登录</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="邮箱"
              type="email"
              placeholder="your@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="密码"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {loginError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">
                  {loginError instanceof Error
                    ? loginError.message
                    : '登录失败，请检查邮箱和密码'}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoggingIn}>
              登录
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              还没有账号？{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
