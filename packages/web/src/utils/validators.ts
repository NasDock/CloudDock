import { z } from 'zod';

export const emailSchema = z.string().email('请输入有效的邮箱地址');

export const passwordSchema = z
  .string()
  .min(8, '密码至少8个字符')
  .max(128, '密码最多128个字符');

export const usernameSchema = z
  .string()
  .min(1, '用户名不能为空')
  .max(100, '用户名最多100个字符');

export const localAddressSchema = z
  .string()
  .min(1, '本地地址不能为空')
  .max(255, '地址格式不正确')
  .regex(/^[^\s:]+:\d+$/, '格式应为 host:port，如 192.168.1.100:5000');

export const tunnelNameSchema = z
  .string()
  .min(1, '隧道名称不能为空')
  .max(100, '名称最多100个字符');

export const ipWhitelistSchema = z
  .preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (Array.isArray(val)) return val;
      return String(val).split(',').map((s) => s.trim()).filter(Boolean);
    },
    z.array(z.string().ip({ message: '请输入有效的 IP 地址' })).optional()
  );

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码'),
});

export const createTunnelSchema = z.object({
  name: tunnelNameSchema,
  protocol: z.enum(['http', 'tcp', 'udp']),
  localAddress: localAddressSchema,
  localHostname: z.string().max(255).optional(),
  clientId: z.string().min(1).max(64).optional(),
  ipWhitelist: ipWhitelistSchema,
});

export const updateTunnelSchema = z.object({
  name: tunnelNameSchema.optional(),
  localAddress: localAddressSchema.optional(),
  localHostname: z.string().max(255).optional(),
  ipWhitelist: ipWhitelistSchema,
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入当前密码'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  username: usernameSchema,
});

export const bindDeviceSchema = z.object({
  bindToken: z.string().min(1, '请输入绑定码'),
  deviceName: z.string().min(1, '请输入设备名称').max(100),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTunnelInput = z.infer<typeof createTunnelSchema>;
export type UpdateTunnelInput = z.infer<typeof updateTunnelSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type BindDeviceInput = z.infer<typeof bindDeviceSchema>;
