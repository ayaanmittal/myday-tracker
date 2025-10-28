# PDF Design Guide

This guide explains how the work history PDF is designed and how to customize it further.

## Current Design Features

### 1. **Typography**
- **Font**: Helvetica (clean sans-serif)
- **Headers**: Bold, 20px size
- **Body text**: Regular weight, 10-14px sizes
- **Footer**: Italic, 8px size

### 2. **Layout**
- **Header Section**: 
  - Title: "Work History Report" (bold, large)
  - Employee name and email
  - Date range and generation date
  - Optional logo on the right side
  
- **Summary Box**: 
  - Gray background box containing:
    - Total Days
    - Completed Days
    - Average Work Time
    - Late Days

- **Data Table**:
  - Blue header (#3B82F6)
  - Striped rows (alternating colors)
  - Centered text alignment
  - Columns: Date, Check-in, Check-out, Work Time, Lunch, Status, Source

- **Footer**:
  - Page numbers (center)
  - Employee name (right)
  - Added to all pages automatically

### 3. **Color Scheme**
- Primary Blue: #3B82F6 (RGB: 59, 130, 246) - used for table headers
- Light Gray: RGB(240, 240, 240) - used for summary box
- Alternating rows: RGB(250, 250, 250)
- Text gray: RGB(100, 100, 100)

## Adding Your Logo

To add your company logo to the PDF, you have several options:

### Option 1: Using the Logo Helper

```typescript
import { loadLogoForPdf } from '@/utils/pdfLogoHelper';

// In your handlePrintPDF function:
const logoUrl = await loadLogoForPdf();
generateWorkHistoryPDF(entries, employeeInfo, startDate, endDate, logoUrl);
```

### Option 2: Hardcode Base64 Logo

1. Convert your logo to base64: https://www.base64-image.de/
2. Add to `src/utils/pdfLogoHelper.ts`:
```typescript
export const ZOOGOL_LOGO_BASE64 = 'data:image/png;base64,YOUR_BASE64_STRING_HERE';
```

### Option 3: Direct URL

If your logo is hosted:
```typescript
generateWorkHistoryPDF(entries, employeeInfo, startDate, endDate, 'https://yoursite.com/logo.png');
```

## Customizing the Design

### Change Colors

In `src/utils/pdfGenerator.ts`, modify these values:

```typescript
// Header color
headStyles: {
  fillColor: [59, 130, 246], // Change RGB values here
}

// Summary box color
doc.setFillColor(240, 240, 240); // Change RGB values
```

### Change Font Sizes

```typescript
doc.setFontSize(20); // Title size - modify this
doc.setFontSize(14); // Subtitle size
doc.setFontSize(10); // Body text size
```

### Adjust Logo Position

```typescript
doc.addImage(logoUrl, 'PNG', pageWidth - 45, 10, 30, 15);
// Parameters: (url, format, x, y, width, height)
```

### Modify Table Styling

In the `autoTable` function:
```typescript
styles: {
  fontSize: 9,        // Table font size
  cellPadding: 3,     // Cell padding
}
```

## File Location

The PDF generator is located at: `src/utils/pdfGenerator.ts`

To use it:
```typescript
import { generateWorkHistoryPDF } from '@/utils/pdfGenerator';
```

