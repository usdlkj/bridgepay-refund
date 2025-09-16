import { Controller,Get, Post, Body,Headers,Query, Param  } from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('/api/v2/report')
export class ReportController {
    constructor(
        private readonly reportService: ReportService,
    ) {}

    @Get('/')
    async reportList(@Body('query') query){
        return this.reportService.list(query)
    }

    @Post("/create")
    async createReport(@Body() createReportDto:CreateReportDto){
        return this.reportService.create(createReportDto)
    }
}
