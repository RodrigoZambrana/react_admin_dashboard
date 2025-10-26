import { PrismaService } from '../prisma/prisma.service';
import { TableQueryDto } from './dto/table-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
export declare class CustomersController {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly defaultCountryCode;
    private readonly mailCategoryFolders;
    private extractPhoneCandidates;
    private normalizePhoneValue;
    private normalizePhoneList;
    private mergeEventMetadata;
    private serializeEventAttachments;
    private normalizeMailCategory;
    private buildInboxCategoryWhere;
    private resolveMailGroup;
    private extractNameFromEmail;
    private formatMailDate;
    private escapeHtml;
    private normalizeMessageMetadata;
    private resolvePreviewText;
    private buildHtmlFromText;
    private resolveAttachmentType;
    private formatAttachmentSize;
    private buildMailAttachments;
    private buildMetadataAttachments;
    private mapInboxMessageToMail;
    private extractUniqueConstraintTargets;
    private throwCustomerUniqueConstraint;
    dashboard(): Promise<{
        statisticData: {
            key: string;
            label: string;
            value: number;
            growShrink: number;
        }[];
        leadByRegionData: {
            name: string;
            value: number;
        }[];
        recentLeadsData: {
            id: number;
            name: string;
            avatar: string;
            status: number;
            createdTime: number;
            email: string;
            assignee: string;
        }[];
        emailSentData: {
            precent: number;
            opened: number;
            unopen: number;
            total: number;
        };
    }>;
    queryCustomers(dto: TableQueryDto): Promise<{
        data: {
            email: string;
            firstName: string;
            lastName: string;
            statusId: number | null;
            status: string;
            statusName: string;
            statusColor: string | null;
            hasPrimaryAddress: boolean;
            phoneNumber: string;
            phoneNumbers: string[];
            id: number;
            name: string;
            img: string | null;
            createdAt: Date;
            updatedAt: Date;
            location: string | null;
            title: string | null;
            birthday: Date | null;
            facebook: string | null;
            twitter: string | null;
            pinterest: string | null;
            linkedIn: string | null;
        }[];
        total: number;
    }>;
    putCustomer(dto: UpdateCustomerDto): Promise<any>;
    calendar(projectId?: string, createdById?: string, taskId?: string): Promise<{
        events: any[];
    }>;
    listCustomerMails(category?: string): Promise<{
        id: string;
        name: string;
        label: string;
        group: string;
        flagged: boolean;
        starred: boolean;
        from: string;
        avatar: string;
        title: string;
        subject: string;
        previewText: string | null;
        snippet: string | null;
        sentAt: string | null;
        receivedAt: string | null;
        headers: object | null | undefined;
        ccAddresses: string[];
        bccAddresses: string[];
        replyToAddresses: string[];
        mail: string[];
        message: {
            id: string;
            name: string;
            mail: string[];
            from: string;
            avatar: string;
            date: string;
            content: string;
            attachment: {
                file: string;
                size: string;
                type: string;
            }[];
        }[];
    }[]>;
    getCustomerMail(id?: string): Promise<{
        id: string;
        name: string;
        label: string;
        group: string;
        flagged: boolean;
        starred: boolean;
        from: string;
        avatar: string;
        title: string;
        subject: string;
        previewText: string | null;
        snippet: string | null;
        sentAt: string | null;
        receivedAt: string | null;
        headers: object | null | undefined;
        ccAddresses: string[];
        bccAddresses: string[];
        replyToAddresses: string[];
        mail: string[];
        message: {
            id: string;
            name: string;
            mail: string[];
            from: string;
            avatar: string;
            date: string;
            content: string;
            attachment: {
                file: string;
                size: string;
                type: string;
            }[];
        }[];
    }>;
    customerDetails(id: number): Promise<{
        id: string;
        name: string;
        firstName: string;
        lastName: string;
        email: string;
        img: string;
        role: string;
        lastOnline: number;
        status: string;
        phoneNumber: string;
        phoneNumbers: string[];
        personalInfo: {
            location: string;
            title: string;
            birthday: string;
            phoneNumber: string;
            phoneNumbers: string[];
            facebook: string;
            twitter: string;
            pinterest: string;
            linkedIn: string;
        };
        addresses: {
            number: string;
            id: number;
            country: string;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            customerId: number;
            street: string;
            corner: string | null;
            apartment: string | null;
            comments: string | null;
            isPrimary: boolean;
        }[];
        orders: {
            id: string;
            status: string;
            statusCode: number | undefined;
            amount: number;
            currency: string | undefined;
            date: number;
            itemCount: number;
        }[];
        budgets: {
            id: string;
            status: string;
            statusCode: number | undefined;
            amount: number;
            currency: string | undefined;
            date: number;
            itemCount: number;
        }[];
        activities: {
            id: string;
            title: string;
            description: string;
            type: string;
            color: string | null;
            startDate: number;
            endDate: number | null;
            allDay: boolean;
            location: string;
        }[];
    } | null>;
    listAddresses(customerId: number): Promise<{
        number: string;
        id: number;
        country: string;
        city: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: number;
        street: string;
        corner: string | null;
        apartment: string | null;
        comments: string | null;
        isPrimary: boolean;
    }[]>;
    private normalizeNullable;
    private trimOrEmpty;
    createAddress(customerId: number, body: any): Promise<{
        number: string;
        id: number;
        country: string;
        city: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: number;
        street: string;
        corner: string | null;
        apartment: string | null;
        comments: string | null;
        isPrimary: boolean;
    }>;
    updateAddress(customerId: number, id: number, body: any): Promise<{
        number: string;
        id: number;
        country: string;
        city: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: number;
        street: string;
        corner: string | null;
        apartment: string | null;
        comments: string | null;
        isPrimary: boolean;
    }>;
    setPrimaryAddress(customerId: number, id: number): Promise<boolean>;
    deleteAddress(customerId: number, id: number): Promise<boolean>;
    deleteCustomer(id: number): Promise<boolean>;
    customersStatistic(): Promise<{
        totalCustomers: {
            value: number;
        };
        activeCustomers: {
            value: number;
        };
        newCustomers: {
            value: number;
        };
    }>;
}
