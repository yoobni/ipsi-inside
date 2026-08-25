import { z } from 'zod';

const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;

/**
 * 비밀번호 규칙 — 가입·재설정·변경 세 경로가 모두 이걸 쓴다.
 *
 * 각자 적어두니 갈라졌다: 가입과 재설정은 영문+숫자를 요구하는데 [내 정보]의
 * 변경만 8자 검사뿐이라, 강한 비밀번호로 가입한 사람이 약한 걸로 바꿀 수 있었다.
 * 규칙을 두 곳에 적으면 반드시 갈라진다(자료 배부 audience와 같은 실수).
 */
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .regex(/[A-Za-z]/, '영문을 포함해야 합니다')
  .regex(/[0-9]/, '숫자를 포함해야 합니다');

/** 입력 칸 placeholder·안내 문구 — 규칙과 같이 움직여야 한다. */
export const PASSWORD_RULE_TEXT = '영문+숫자 포함 8자 이상';

const baseSignupSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: passwordSchema,
  passwordConfirm: z.string(),
  fullName: z.string().min(2, '이름을 입력해주세요').max(20),
  phone: z
    .string()
    .regex(phoneRegex, '올바른 휴대폰 번호 형식이 아닙니다 (010-0000-0000)'),
});

export const studentSignupSchema = baseSignupSchema
  .extend({
    role: z.literal('student'),
    school: z.string().min(2, '학교명을 입력해주세요').max(50),
    grade: z.coerce.number().int().min(1).max(3),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export const parentSignupSchema = baseSignupSchema
  .extend({
    role: z.literal('parent'),
    studentFullName: z.string().min(2, '자녀의 이름을 입력해주세요').max(20),
    studentPhone: z
      .string()
      .regex(phoneRegex, '자녀 휴대폰 번호 형식이 올바르지 않습니다'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export const signupSchema = z.discriminatedUnion('role', [
  studentSignupSchema.innerType(),
  parentSignupSchema.innerType(),
]);

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export type StudentSignup = z.infer<typeof studentSignupSchema>;
export type ParentSignup = z.infer<typeof parentSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
