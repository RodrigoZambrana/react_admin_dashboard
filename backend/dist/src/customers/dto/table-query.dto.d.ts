declare class TableSortDto {
    key?: string;
    order?: 'asc' | 'desc' | '';
}
declare class TableFilterDto {
    statusId?: string | null;
}
export declare class TableQueryDto {
    pageIndex: number;
    pageSize: number;
    query?: string;
    sort?: TableSortDto;
    filterData?: TableFilterDto;
}
export {};
