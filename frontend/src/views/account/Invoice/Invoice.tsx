import Container from '@/components/shared/Container'
import InvoiceContent from './components/InvoiceContent'
import Card from '@/components/ui/Card'
import type { SalesDocumentResource } from '@/services/SalesService'

type InvoiceProps = {
    resource?: SalesDocumentResource
}

const Invoice = ({ resource = 'orders' }: InvoiceProps) => {
    return (
        <Container className="h-full">
            <Card className="h-full" bodyClass="h-full">
                <InvoiceContent resource={resource} />
            </Card>
        </Container>
    )
}

export default Invoice
