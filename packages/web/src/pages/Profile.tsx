import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { updateUserInfo } from '@/api/auth';
import { changePasswordSchema } from '@/utils/validators';
import type { ChangePasswordInput, UpdateProfileInput } from '@/utils/validators';
import { formatDate } from '@/utils/formatters';

export const Profile = () => {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const profileForm = useForm<UpdateProfileInput>({
    defaultValues: {
      username: user?.username || '',
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onUpdateProfile: SubmitHandler<UpdateProfileInput> = async (data) => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateUserInfo(data);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      setUpdateError('更新失败，请稍后重试');
    } finally {
      setIsUpdating(false);
    }
  };

  const onChangePassword: SubmitHandler<ChangePasswordInput> = async (data) => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateUserInfo({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      setUpdateSuccess(true);
      passwordForm.reset();
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: any) {
      setUpdateError(err?.response?.data?.error?.message || '密码修改失败');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer title="个人设置" subtitle="管理您的账户信息">
            <div className="max-w-2xl space-y-6">
              {/* Profile Info */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">基本信息</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500">用户 ID</p>
                      <p className="font-mono text-sm mt-0.5">{user?.userId}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">套餐</p>
                      <p className="font-medium mt-0.5">
                        {user?.plan === 'free' ? '免费版' : user?.plan === 'pro' ? '专业版' : '企业版'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500">邮箱</p>
                    <p className="font-medium mt-0.5">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">注册时间</p>
                    <p className="font-medium mt-0.5">{user?.createdAt ? formatDate(user.createdAt) : '-'}</p>
                  </div>
                </div>
              </Card>

              {/* Update Profile */}
              <Card>
                <h3 className="text-lg font-semibold mb-4">修改用户名</h3>
                <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
                  <Input
                    label="用户名"
                    {...profileForm.register('username')}
                    error={profileForm.formState.errors.username?.message}
                  />
                  {updateError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm text-red-600">{updateError}</p>
                    </div>
                  )}
                  {updateSuccess && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <p className="text-sm text-green-600">更新成功</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={isUpdating}>
                      保存
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Change Password */}
              <Card>
                <h3 className="text-lg font-semibold mb-4">修改密码</h3>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                  <Input
                    label="当前密码"
                    type="password"
                    placeholder="••••••••"
                    {...passwordForm.register('oldPassword')}
                    error={passwordForm.formState.errors.oldPassword?.message}
                  />
                  <Input
                    label="新密码"
                    type="password"
                    placeholder="••••••••"
                    {...passwordForm.register('newPassword')}
                    error={passwordForm.formState.errors.newPassword?.message}
                  />
                  <Input
                    label="确认新密码"
                    type="password"
                    placeholder="••••••••"
                    {...passwordForm.register('confirmPassword')}
                    error={passwordForm.formState.errors.confirmPassword?.message}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={isUpdating}>
                      修改密码
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </PageContainer>
        </main>
      </div>
    </div>
  );
};
