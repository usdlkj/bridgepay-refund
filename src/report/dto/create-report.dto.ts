import { reportType } from "../entities/report.entity";

export class CreateReportDto {
    date:number;
    type:reportType;
}