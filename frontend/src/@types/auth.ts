export type SignInCredential = {
    email: string
    password: string
}

export type SignInResponse = {
    token: string
    user: {
        authority: string[]
        avatar: string
        email: string
        name?: string
        lastName?: string
    }
}

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
