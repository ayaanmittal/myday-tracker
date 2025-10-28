import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfHistoryEntry {
  id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  is_late?: boolean;
  device_info: string;
  modification_reason?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
}

export interface EmployeeInfo {
  name: string;
  email: string;
}

// Generic history entry type that accepts any with required fields
export type AnyHistoryEntry = {
  id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  is_late?: boolean;
  device_info: string;
  modification_reason?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
};

export async function generateWorkHistoryPDF(
  entries: AnyHistoryEntry[],
  employeeInfo: EmployeeInfo,
  startDate: string,
  endDate: string,
  logoUrl?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Set font to Helvetica (better sans-serif font)
  doc.setFont('helvetica');

  // Load logo if not provided
  let finalLogoUrl = logoUrl;
  if (!finalLogoUrl) {
    try {
      finalLogoUrl = await loadLogoForPdf();
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  // Add logo if available
  if (finalLogoUrl) {
    try {
      doc.addImage(finalLogoUrl, 'PNG', pageWidth - 45, 10, 30, 15);
    } catch (error) {
      console.warn('Could not add logo:', error);
    }
  }

  // Header with title and date
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Work History Report', 14, 25);

  // Subtitle
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Employee: ${employeeInfo.name}`, 14, 32);

  // Date range and generated date
  doc.setFontSize(10);
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 44);

  // Summary Stats in a better layout
  const totalDays = entries.length;
  const completedDays = entries.filter(e => e.status === 'completed').length;
  const totalWorkMinutes = entries
    .filter(e => e.total_work_time_minutes)
    .reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0);
  const averageWorkMinutes = completedDays > 0 ? totalWorkMinutes / completedDays : 0;
  const lateDays = entries.filter(e => e.is_late).length;
  
  // Draw summary boxes
  doc.setFillColor(240, 240, 240);
  doc.rect(14, 50, 180, 25, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Summary Statistics', 16, 57);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Days: ${totalDays}`, 20, 63);
  doc.text(`Completed Days: ${completedDays}`, 80, 63);
  doc.text(`Avg Work Time: ${formatTime(averageWorkMinutes)}`, 140, 63);
  
  doc.text(`Late Days: ${lateDays}`, 20, 69);

  // Prepare table data
  const tableData = entries.map(entry => {
    const checkIn = entry.check_in_at ? formatTimeOnly(entry.check_in_at) : 'N/A';
    const checkOut = entry.check_out_at ? formatTimeOnly(entry.check_out_at) : 'N/A';
    const workTime = entry.total_work_time_minutes ? formatTime(entry.total_work_time_minutes) : 'N/A';
    const lunchDuration = entry.lunch_break_start && entry.lunch_break_end 
      ? formatTime(calculateMinutes(entry.lunch_break_start, entry.lunch_break_end))
      : 'N/A';
    const status = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
    const lateMarker = entry.is_late ? ' ⚠ Late' : '';
    
    return [
      formatDate(entry.entry_date),
      checkIn,
      checkOut,
      workTime,
      lunchDuration,
      status + lateMarker,
      entry.device_info ?? 'Manual'
    ];
  });

  // Create table with better styling
  autoTable(doc, {
    startY: 82,
    head: [['Date', 'Check-in', 'Check-out', 'Work Time', 'Lunch', 'Status', 'Source']],
    body: tableData,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica',
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue color
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: {
      font: 'helvetica',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    margin: { top: 82, left: 14, right: 14 }
  });

  // Footer on each page
  const addPageNumbers = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        employeeInfo.name,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'right' }
      );
    }
  };

  addPageNumbers();

  // Save the PDF
  const fileName = `${employeeInfo.name.replace(/\s+/g, '_')}_Work_History_${startDate}_to_${endDate}.pdf`;
  doc.save(fileName);
}

// Helper function to load logo from public folder
async function loadLogoForPdf(): Promise<string | null> {
  try {
    // Load ercmax logo from public folder
    const logoPath = '/logo.png';
    
    const response = await fetch(logoPath);
    if (!response.ok) {
      console.warn('Logo not found at', logoPath);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading logo:', error);
    return null;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h ${mins}m`;
}

function calculateMinutes(start: string, end: string): number {
  const startTime = new Date(start);
  const endTime = new Date(end);
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

