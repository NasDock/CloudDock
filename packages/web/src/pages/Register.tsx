import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterInput } from '@/utils/validators';

export const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, isRegistering, registerError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await registerUser(data);
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
          <p className="text-gray-600 mt-1">创建账户开始使用</p>
        </div>

        <Card padding="lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">注册</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="用户名"
              placeholder="您的名称"
              error={errors.username?.message}
              {...register('username')}
            />

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
              hint="至少 8 个字符"
              {...register('password')}
            />

            {registerError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">
                  {registerError instanceof Error
                    ? registerError.message
                    : '注册失败，请稍后重试'}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isRegistering}>
              注册
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              已有账号？{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
