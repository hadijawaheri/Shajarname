import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { TreePdfDto } from './dtos/tree-pdf.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller({ version: '1', path: 'export' })
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @UseGuards(JwtAuthGuard)
  @Post('tree-pdf')
  async exportTreePdf(@Body() dto: TreePdfDto, @Res() res: Response) {
    const pdf = await this.exportService.generateTreePdf(dto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="khandan-najaf-${dto.year}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
