import ResetPasswordForm from '@/views/auth/ResetPassword/ResetPasswordForm'
import PageContainer from '@/components/template/PageContainer'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Logo from '@/components/template/Logo'

const ResetPasswordInApp = () => {
    return (
        <PageContainer footer={false}>
            <div className="h-full">
                <Container className="flex flex-col flex-auto items-center justify-center min-w-0 h-full">
                    <Card className="min-w-[320px] md:min-w-[450px]" bodyClass="md:p-10">
                        <div className="text-center mb-6">
                            <Logo type="streamline" imgClass="mx-auto" />
                        </div>
                        <div className="text-center">
                            <ResetPasswordForm disableSubmit={false} showBackLink={false} />
                        </div>
                    </Card>
                </Container>
            </div>
        </PageContainer>
    )
}

export default ResetPasswordInApp
