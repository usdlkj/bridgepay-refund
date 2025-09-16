import { reportType } from "../entities/report.entity";

export class CreateReportDto {
    date:string;
    type:reportType;
}