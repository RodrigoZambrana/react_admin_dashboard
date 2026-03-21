export type SignInCredential = {
    email: string
    password: string
    recaptchaToken?: string
}

export type SignInResponse = {
    token: string
    expiresAt: string
    user: {
        authority: string[]
        avatar: string
        email: string
        name?: string
        lastName?: string
        lang?: string
    }
}

export type SessionResponse = SignInResponse | null

export type SignUpResponse = SignInResponse

export type SignUpCredential = {
    name: string
    lastName?: string
    email: string
    password: string
}

export type ForgotPassword = {
    email: string
}

export type ResetPassword = {
    password: string
}
