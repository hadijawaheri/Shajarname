import { BadRequestException, Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { TreePdfDto } from './dtos/tree-pdf.dto';

@Injectable()
export class ExportService {
  async generateTreePdf(dto: TreePdfDto): Promise<Buffer> {
    if (
      !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dto.imageBase64)
    ) {
      throw new BadRequestException('تصویر خروجی معتبر نیست');
    }
    const isAr = dto.lang === 'ar';
    const dir = 'rtl';
    const rawTitle =
      dto.title || (isAr ? 'شجرة عائلة نجف' : 'شجره‌نامه خاندان نجف');
    const title = rawTitle.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character]!,
    );
    const subtitle = isAr ? `سنة ${dto.year}` : `سال ${dto.year}`;

    const html = `<!DOCTYPE html>
<html lang="${dto.lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A3 landscape; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #E0E5EC;
      direction: ${dir};
      padding: 16px;
    }
    h1 { text-align: center; color: #0F766E; font-size: 28px; margin-bottom: 8px; }
    h2 { text-align: center; color: #64748B; font-size: 16px; margin-bottom: 20px; font-weight: normal; }
    .tree-wrap { display: flex; justify-content: center; align-items: center; }
    img { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
    footer { text-align: center; margin-top: 16px; font-size: 11px; color: #94A3B8; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <h2>${subtitle}</h2>
  <div class="tree-wrap">
    <img src="${dto.imageBase64}" alt="family tree" />
  </div>
  <footer>Khandan Najaf — ${new Date().toISOString().split('T')[0]}</footer>
</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A3',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
