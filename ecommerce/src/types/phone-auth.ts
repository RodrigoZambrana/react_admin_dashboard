export type PhoneAuthStatus = "pending_verification" | "active" | "blocked";

export type PhoneAuthRegisterResponse = {
  ok: true;
  userId: number;
  phone: string | null;
  status: PhoneAuthStatus;
  verification: {
    phone: string;
    otpLength: number;
    expiresInSeconds: number;
  };
};

export type PhoneAuthRecoverResponse = {
  ok: true;
  method?: "sms" | "email";
  expiresInSeconds?: number;
  otpLength?: number;
};

export type PhoneAuthVerifyResponse = {
  ok: true;
  userId: number;
  status: PhoneAuthStatus;
};

export type PhoneAuthResetResponse = {
  ok: true;
};
